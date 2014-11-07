// dependencies
var mysql        = require('mysql');
var async        = require('async');
var joi          = require('joi');
var im           = require('imagemagick');
var AWS          = require('aws-sdk');
var fs           = require('fs');
var config       = require('../config'); 
var tmpfilecache = require('../utils/tmpfilecache');
var util         = require('util');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var Recordings   = require('./recordings');
var Projects     = require('./projects');
// local variables
var s3;
var queryHandler = dbpool.queryHandler;

// exports
var TrainingSets = {
    /** Finds training sets, given a (non-empty) query.
     * @param {Object} query
     * @param {Object} query.id      find training sets with the given id.
     * @param {Object} query.project find training sets associated to the given project id.
     * @param {Object} query.name    find training sets with the given name (must also provide a project id);
     * @param {Function} callback called back with the queried results.
     */

    findName: function(set_id, callback) {
        var q = "SELECT name \n"+
                "FROM training_sets \n"+
                "WHERE training_set_id = " + mysql.escape(set_id);
                
            queryHandler(q, callback);
    },
    
    find: function (query, callback) {
        var constraints = [];

        if (query) {
            if (query.id) {
                constraints.push('TS.training_set_id = ' + mysql.escape(query.id));
            } else if (query.project) {
                constraints.push('TS.project_id = ' + mysql.escape(query.project));
                if (query.name) {
                    constraints.push('TS.name = ' + mysql.escape(query.name));
                }
            }
        }

        if(constraints.length == 0){
            callback(new Error("TrainingSets.find called with invalid query."));
        }

        return dbpool.queryHandler(
            "SELECT TS.training_set_id as id, TS.name, TS.date_created, TST.identifier as type, \n" +
            "    TSRS.species_id as TT_roi_set_TT_species, TSRS.songtype_id as TT_roi_set_TT_songtype , TS.project_id \n" +
            "FROM training_sets TS \n" +
            "JOIN training_set_types TST ON TS.training_set_type_id = TST.training_set_type_id \n" +
            "LEFT JOIN training_sets_roi_set TSRS ON TS.training_set_id = TSRS.training_set_id \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND "
        ), function(err, data, fields){
            if(!err && data){
                var ttfields=[];
                fields.forEach(function(fielddef){
                    var m = /TT_(\w+)_TT_(\w+)/.exec(fielddef.name);
                    if(m){
                        ttfields.push([m[0], m[1], m[2]]);
                    }
                })
                data.forEach(function(item){
                    var tt = item['type'];
                    ttfields.forEach(function(ttfield){
                        var val = item[ttfield[0]];
                        delete item[ttfield[0]];
                        if(tt == ttfield[1]){
                            item[ttfield[2]] = val;
                        }
                    })
                });
            }
            callback(err, data);
        });
    },
    
    nameInUse: function(project_id, set_name, callback) {
        var q = "SELECT count(*) as count \n"+
                "FROM training_sets \n"+
                "WHERE name = %s \n" + 
                "AND project_id = %s";
        
        q = util.format(q, mysql.escape(set_name), mysql.escape(project_id));
        queryHandler(q, callback);
    },
    
    /** Finds training sets, given a (non-empty) query.
     * @param {Object} data
     * @param {Object} data.project id of the project associated to this training set.
     * @param {Object} data.name   name given to this training set.
     * @param {Object} data.type   type of training set to insert.
     * @param {Function} callback called back with the newly inserted training set, or with errors.
     */
    insert: function (data, callback) {
        if(!data.project_id){
            callback(new Error("Project id is missing."));
            return;
        }
        if(!data.name){
            callback(new Error("Training set name is missing."));
            return;
        }
        var typedef = TrainingSets.types[data.type];
        if(!data.type || !typedef){
            callback(new Error("Training set type " + data.type + " is invalid."));
            return;
        }
        
        var typedef_action = typedef.insert;
        var scope={};
        var tasks = [];
        if(typedef_action && typedef_action.validate){
            tasks.push(function perform_typedef_extra_validation(cb){
                typedef_action.validate(data, cb);
            });
        };
        tasks.push(dbpool.getConnection);
        tasks.push(function begin_transaction(connection, cb){
            scope.connection = connection;
            scope.connection.beginTransaction(cb);
        });
        tasks.push(function run_insert_query(){
            var cb = Array.prototype.pop.call(arguments);
            scope.in_transaction = true;
            scope.connection.query(
                "INSERT INTO training_sets (project_id, name, date_created, training_set_type_id) \n" +
                "VALUES ("+mysql.escape(data.project_id)+", "+mysql.escape(data.name)+", NOW(), "+ mysql.escape(typedef.id)+")",
            cb);
        });
        tasks.push(function get_insert_id(result){
            var cb = Array.prototype.pop.call(arguments);
            scope.insert_id = result.insertId;
            cb();
        });
        if(typedef_action && typedef_action.extras){
            tasks.push(function perform_typedef_extra_validation(){
                var cb = Array.prototype.pop.call(arguments);
                typedef_action.extras(scope.connection, scope.insert_id, data, cb);
            });
        }
        tasks.push(function commit_transaction() {
            var cb = Array.prototype.pop.call(arguments);
            scope.connection.commit(cb);
        });
        tasks.push(function transaction_commited() {
            var cb = Array.prototype.pop.call(arguments);
            scope.in_transaction = false;
            cb();
        });
        tasks.push(function fetch_newly_inserted_object(result) {
            var cb = Array.prototype.pop.call(arguments);
            TrainingSets.find({id:scope.insert_id}, cb);
        });
        async.waterfall(tasks, function(err, tset){
            if(scope.connection){
                scope.connection.release();
            }
            callback(err, tset);
        });
    },

    /** Adds data to the given training set.
     * @param {Object}  training_set  training set object as returned by find().
     * @param {Object}  data data to add to the training set. The properties in
     *                  allowed in this object depend on the type of training set.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    addData: function (training_set, data, callback) {
        TrainingSets.types[training_set.type].add_data(training_set, data, callback);
    },

    /** Fetches a training set's data, optionally using a query.
     * @param {Object}  training_set  training set object as returned by find().
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
     * @param {Function} callback(err, path) function to call back with the results.
     */
    fetchData: function (training_set, query, callback) {
        if(query instanceof Function) {
            callback = query;
            query = null;
        }
        if(!query) {
            query = {};
        }
        
        var typedef = TrainingSets.types[training_set.type];

        return typedef.get_data(training_set, query, callback);
    },
    
    /** Fetches a training set's rois
     *  @param {Object}  training_set
     */
    fetchRois: function (training_set, callback) {
        var typedef = TrainingSets.types[training_set.type];
        return typedef.get_rois(training_set, callback);
    },
   
    removeRoi: function (roi_id, callback) {
        var typedef = TrainingSets.types['roi_set'];
        return typedef.remove_roi(roi_id, callback);
    },
     
    /** Fetches a training set's species and songtype
     *  @param {Object}  training_set
     */
    fetchSpecies: function (training_set, callback) {
        var typedef = TrainingSets.types[training_set.type];
        return typedef.get_species(training_set, callback);
    },
    
    /** Fetches the available training set types.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    getTypes: function (callback) {
        return queryHandler(
            "SELECT training_set_type_id as id, name, identifier, description \n" +
            "FROM training_set_types \n", callback);
    },
    /** Type-specific training set function implementations.
     */
    types: {}
};

TrainingSets.types.roi_set = {
    id    : 1,
    table : 'training_set_roi_set_data TSD',
    primary_key : 'TSD.roi_set_data_id',
    fields: ['TSD.recording_id as recording', 'TSD.species_id as species', 'TSD.songtype_id as songtype', 'TSD.x1', 'TSD.y1', 'TSD.x2', 'TSD.y2'],
    insert : {
        validate : function(data, callback){
            if (data.extras && data.extras.class) {
                Projects.getProjectClasses( data.project_id, data.extras.class, function(err, classes){
                    if(err) {
                        callback(err);
                    } else if(!classes || !classes.length) {
                        callback(new Error("Project class is invalid."));
                    } else {
                        data.species  = classes[0].species;
                        data.songtype = classes[0].songtype;
                        callback();
                    }
                });
            } else if (data.extras && data.extras.species && data.extras.songtype) {
                data.species  = data.extras.species;
                data.songtype = data.extras.songtype;
            } else {
                callback(new Error("Project class is invalid."));
            }
        },
        extras   : function(connection, tset_id, data, callback){
            connection.query(
                "INSERT INTO training_sets_roi_set (training_set_id, species_id, songtype_id) \n" +
                "VALUES ("+mysql.escape([tset_id, data.species, data.songtype])+")",
            callback);
        }
    },
    data_schema : joi.object().keys({
        species   : joi.number().integer().default(joi.ref('$species')),
        songtype  : joi.number().integer().default(joi.ref('$songtype')),
        recording : joi.number().integer(),
        roi : joi.object().keys({
            x1 : joi.number().unit('seconds'),
            y1 : joi.number().unit('hertz'),
            x2 : joi.number().unit('seconds'),
            y2 : joi.number().unit('hertz')
        })
    }),
    /** Creates a roi image
     * @param {Object} input.recording_id
     * @param {Object} input.training_set_id
     * @param {Object} input.project_id
     * @param {Object} input.roi_id
     * @param {Object} input.x1
     * @param {Object} input.x2
     * @param {Object} input.y1
     * @param {Object} input.y2
     */
    create_roi_image : function (input,roiData,cb){
        var roiUri = 'project_'+input.project_id+'/training_sets/'+input.training_set_id+'/'+input.roi_id+'.png'
        var rec_data ;
        var rec_stats ;
        var spec_data;
        async.waterfall(
        [
            function (next)
            {
                Recordings.findByUrlMatch(input.recording_id,0, {limit:1},next );
            },
            function (data,next)
            {
                rec_data = data[0];
                Recordings.fetchInfo(rec_data, next);
            },
            function(data,next)
            {
                rec_stats = data                
                Recordings.fetchSpectrogramFile(rec_data,next );  
            },
            function(data, next){
                spec_data = data
                im.identify(spec_data.path, next);
            },
            function (spectro_info,next)
            {
                roiDuration = input.x2-input.x1;
                px2sec = rec_stats.stats.duration    / spectro_info.width ;
                roiWidth = Math.ceil(roiDuration/px2sec);
                roiBanwdwith = input.y2-input.y1;
                max_freq = rec_stats.stats.sample_rate / 2;
                px2hz  = max_freq / spectro_info.height;
                roiHeight = Math.ceil(roiBanwdwith/px2hz);
                roiStartX = Math.floor(input.x1/px2sec);
                roiStartY = spectro_info.height-Math.floor(input.y2/px2hz);
                var roi_file = tmpfilecache.key2File(roiUri);
                im.convert([
                    spec_data.path,
                    '-colorspace', 'RGB',
                    '-crop',
                    roiWidth+'x'+roiHeight+'+'+roiStartX+'+'+roiStartY,
                    '+repage',
                    '-colorspace', 'RGB',
                    roi_file
                ], function(err){
                    if(err) { next(err); return; }
                    console.log("file created:",roi_file)
                    if(!s3){
                        s3 = new AWS.S3();
                    }
                    var params = { 
                        Bucket: config('aws').bucketName, 
                        Key: roiUri,
                        ACL: 'public-read',
                        Body: fs.createReadStream(roi_file)
                    };

                    s3.putObject(params, function(err, data) {
                        if (err)  next(null,err);
                        dbpool.queryHandler(
                            "update training_set_roi_set_data set uri = '"+roiUri+"' where roi_set_data_id = "+input.roi_id,
                            next
                        );                        
                    });      
                    
                });
            }
        ],
        function(){cb(roiData);}
        );
    },
    get_rois : function(training_set, callback) {
        return queryHandler(
            "SELECT TSD.roi_set_data_id as id, TSD.recording_id as recording,\n"+
            "   TSD.species_id as species, TSD.songtype_id as songtype,  \n" +
            "   TSD.x1,  ROUND(TSD.y1,0) as y1, TSD.x2,  ROUND(TSD.y2,0) as y2 , \n"+
            "   ROUND(TSD.x2-TSD.x1,1) as dur , \n"+
            "   CONCAT('https://s3.amazonaws.com/','"+config('aws').bucketName+"','/',TSD.uri) as uri \n" +
            " FROM training_set_roi_set_data TSD \n"+
            " WHERE TSD.training_set_id = " + mysql.escape(training_set.id),
            callback
        );
    },
    get_species : function(training_set, callback) {
        return queryHandler(
            "SELECT  S.scientific_name as species  , SG.songtype \n"+
            " FROM  songtypes SG , species S , training_sets_roi_set TRS \n"+
            " WHERE TRS.training_set_id = " + mysql.escape(training_set.id) + " \n"+
            " and TRS.species_id = S.species_id and TRS.songtype_id = SG.songtype_id ",
            callback
        );
    },
    remove_roi : function(roi_id, callback) {
        return queryHandler(
            "delete from training_set_roi_set_data where roi_set_data_id = "+roi_id,
            callback
        );
    },
    /** Fetches a training set's data, optionally using a query.
     * @param {Object}  training_set  training set object as returned by find(), must be of type roi_set.
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
     * @param {Object}  query.id        limit tset data to the row with the given id.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    get_data : function(training_set, query, callback) {
        var constraints = ['TSD.training_set_id = ' + mysql.escape(training_set.id)];
        var tables = ['training_set_roi_set_data TSD'];

        if(query.id){
            constraints.push('TSD.roi_set_data_id = ' + mysql.escape(query.id));
        } else if(query.recording){
            var req_query = Recordings.parseUrlQuery(query.recording);
            constraints.push.apply(constraints, sqlutil.compile_query_constraints(
                Recordings.parseUrlQuery(query.recording),
                Recordings.QUERY_FIELDS
            ));
            tables.push(
                'recordings R ON TSD.recording_id = R.recording_id',
                'sites S ON R.site_id = S.site_id'
            );
        }
        return queryHandler(
            "SELECT TSD.roi_set_data_id as id, TSD.recording_id as recording,\n"+
            "   TSD.species_id as species, TSD.songtype_id as songtype,  \n" +
            "   TSD.x1, TSD.y1, TSD.x2, TSD.y2 , \n"+
            "   CONCAT('https://s3.amazonaws.com/','"+config('aws').bucketName+"','/',TSD.uri) as uri \n" +
            "FROM "   + tables.join(" \n" +
            "JOIN ")+ " \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND "), callback);
    },
    /** Adds data to a training set.
     * @param {Object}  training_set  training set object as returned by find(), must be of type roi_set.
     * @param {Object}  data data to add, follows the schema in data_schema.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    add_data : function(training_set, data, callback){
        async.waterfall([
            (function(cb){
                // console.log('joi.validate(data:',data,', schema:', this.data_schema,', {context:',training_set,'},cb);');
                joi.validate(data, this.data_schema, {context:training_set},cb);
            }).bind(this), 
            function(vdata, cb){
                var x1 = Math.min(vdata.roi.x1, vdata.roi.x2), y1 = Math.min(vdata.roi.y1, vdata.roi.y2);
                var x2 = Math.max(vdata.roi.x1, vdata.roi.x2), y2 = Math.max(vdata.roi.y1, vdata.roi.y2);
                                
                dbpool.queryHandler(
                    "INSERT INTO training_set_roi_set_data(training_set_id, recording_id, species_id, songtype_id, x1, y1, x2, y2) \n" +
                    "VALUES ("+mysql.escape([
                        training_set.id, vdata.recording, vdata.species, vdata.songtype, 
                        x1, y1, x2, y2
                    ])+")",
                    cb
                );
            }, 
            (function(result, fields, cb){
                this.get_data(training_set, {id:result.insertId}, function(err, rows){
                    err ? cb(err) : cb(null, {tset:training_set, roi:rows && rows[0]});
                });
            }).bind(this),
            (function (roiData,cb) {
                this.create_roi_image({recording_id:roiData.roi.recording,
                                       training_set_id:roiData.tset.id,
                                       project_id:roiData.tset.project_id,
                                       roi_id:roiData.roi.id,
                                       x1:roiData.roi.x1,
                                       x2:roiData.roi.x2,
                                       y1:roiData.roi.y1,
                                       y2:roiData.roi.y2
                                      },roiData,cb);
            }).bind(this)
        ], function(data){callback(null,data.roi)});
    },

}

module.exports = TrainingSets;
