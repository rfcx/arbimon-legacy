var debug = require('debug')('arbimon2:model:projects');
var util = require('util');
var mysql = require('mysql');
var async = require('async');
var joi = require('joi');
var sprintf = require("sprintf-js").sprintf;
var AWS = require('aws-sdk');


var s3 = new AWS.S3();
var config = require('../config');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var species = require('./species');
var songtypes = require('./songtypes');
var s3;

var Projects = {
    
    listAll: function(callback) {
        var q = "SELECT name, url, description, is_private, is_enabled \n"+
                "FROM projects";

        queryHandler(q, callback);
    },
    
    findById: function (project_id, callback) {
        var query = "SELECT * FROM projects WHERE project_id = " + mysql.escape(project_id);

        return queryHandler(query , callback);
    },
    
    findByUrl: function (project_url, callback) {
        var query = "SELECT * FROM projects WHERE url = " + mysql.escape(project_url);

        return queryHandler(query , callback);
    },

    findByName: function (project_name, callback) {
        var query = "SELECT * FROM projects WHERE name = " + mysql.escape(project_name);

        return queryHandler(query , callback);
    },

    getProjectSites: function(project_id, callback){
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));
        
        var q = "SELECT s.site_id as id, \n"+
                "       s.name, \n"+
                "       s.lat, \n"+
                "       s.lon, \n"+
                "       s.alt, \n"+
                "       s.published, \n"+
                "       COUNT( r.recording_id ) as rec_count, \n"+
                "       s.project_id != %1$s AS imported, \n"+
                "       s.token_created_on \n" +
                "FROM sites AS s \n"+
                "LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = %1$s \n"+
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id \n"+
                "WHERE (s.project_id = %1$s \n"+
                "OR pis.project_id = %1$s) \n"+
                "GROUP BY s.site_id";
        
        q = sprintf(q, mysql.escape(project_id));
        return queryHandler(q , callback);
    },
    
    /**
     * creates a project and add the creator to the project as owner
     * @param {Object} project 
     * @param {String} project.name
     * @param {String} project.url
     * @param {String} project.description
     * @param {Number} project.owner_id - creator id
     * @param {Number} project.project_type_id
     * @param {Boolean} project.is_private 
     * @param {Function} callback(err, projectId)
    */
    create: function(project, callback) {
        var values = [];

        var schema = {
            name: joi.string(),
            url: joi.string(),
            description: joi.string(),
            owner_id: joi.number(),
            project_type_id: joi.number(),
            is_private: joi.boolean()
        };
        
        var result = joi.validate(project, schema, {
            stripUnknown: true,
            presence: 'required',
        });
        
        if(result.error) {
            return callback(result.error);
        }
        
        project = result.value;
        
        for(var i in project) {
            if(i !== 'id') {
                values.push(util.format('%s = %s', 
                    mysql.escapeId(i), 
                    mysql.escape(project[i])
                ));
            }
        }

        var q = 'INSERT INTO projects \n'+
                'SET %s';

        q = util.format(q, values.join(", "));

        queryHandler(q, function(err, result) {
            if(err) return callback(err);

            var projectId = result.insertId;

            Projects.addUser({
                user_id: project.owner_id,
                project_id: projectId,
                role_id: 4 // owner role id
            }, function(err) {
                if(err) return callback(err);
                
                callback(null, projectId);
            });
        });
    },

    update: function(project, callback) {
        
        var schema = {
            project_id: joi.number().required(),
            name: joi.string(),
            url: joi.string(),
            description: joi.string(),
            owner_id: joi.number(),
            project_type_id: joi.number(),
            is_private: [joi.number().valid(0,1), joi.boolean()],
            is_enabled: [joi.number().valid(0,1), joi.boolean()],
            recording_limit: joi.number()
        };
        
        joi.validate(project, schema, function(err, projectInfo){
            if(err) return callback(err);
            
            var values = [];
            
            for( var i in projectInfo) {
                if(i !== 'project_id' && i !== 'recording_limit') {
                    values.push(util.format('%s = %s', 
                        mysql.escapeId(i), 
                        mysql.escape(projectInfo[i])
                    ));
                }
            }
            
            var q = 'UPDATE projects \n'+
                    'SET %s \n'+
                    'WHERE project_id = %s';

            q = util.format(q, values.join(", "), projectInfo.project_id);
            queryHandler(q, callback);
        });
    },
    
    insertNews: function(news, callback) {
        
        var schema = {
            user_id: joi.number().required(), 
            project_id: joi.number().required(), 
            data: joi.string().required(), 
            news_type_id: joi.number().required()
        };
        
        joi.validate(news, schema, function(err, newsVal) {
            if(err) {
                if(callback) {
                    return callback(err);
                } else {
                    // throw err; // note[gio]: this could possibly kill the thread, do we want this?
                    return console.error(err);
                }
            }
            
            var q = 'INSERT INTO project_news \n'+
                    'SET user_id = %s, '+
                    'project_id = %s, '+
                    'data = %s, '+
                    'news_type_id = %s';

            q = util.format(q, 
                mysql.escape(newsVal.user_id), 
                mysql.escape(newsVal.project_id), 
                mysql.escape(newsVal.data), 
                mysql.escape(newsVal.news_type_id)
            );
            
            queryHandler(q, function(err, result) {
                if(callback) {
                    if(err) return callback(err);
                    
                    return callback(null, result);
                } else {
                    if(err) {
                        // throw err; // note[gio]: this could possibly kill the thread, do we want this?
                        return console.error(err);
                    }
                }
            });
            
        });
    },

    /** Fetches a project's classes.
     * @param {{Object}} project project object.
     * @param {{Integer}} project.project_id
     * @param {{Integer}} class_id (optional) limit the query to this class
     * @param {{Callback}} callback
     */
    getProjectClasses: function(project_id, class_id, callback){
        if(class_id instanceof Function){
            callback = class_id;
            class_id = null;
        }
        var sql = (
            "SELECT pc.project_class_id as id, \n"+
            "       pc.species_id as species, \n"+
            "       pc.songtype_id as songtype, \n"+
            "       st.taxon, \n"+
            "       sp.scientific_name as species_name, \n"+
            "       so.songtype as songtype_name \n"+
            "FROM project_classes AS pc \n"+
            "JOIN species AS sp on sp.species_id = pc.species_id \n"+
            "JOIN songtypes AS so on so.songtype_id = pc.songtype_id \n" +
            "JOIN species_taxons AS st ON st.taxon_id = sp.taxon_id \n" +
            "WHERE pc.project_id = " + mysql.escape(project_id) +
            (class_id ? "\n  AND pc.project_class_id = " + (class_id|0) : '') +
            " ORDER BY st.taxon, sp.scientific_name"
        );

        return queryHandler(sql , callback);
    },

    insertClass: function(project_class, callback) {
        var schema = {
            species: joi.string().required(),
            songtype: joi.string().required(),
            project_id: joi.number().required() 
        };

        joi.validate(project_class, schema, function(err, value) {
            if(err) return callback(err);

            async.auto({
                findSpecies: function(cb) {
                    species.findByName(value.species, function(err, rows) {
                        if(err) return cb(err);

                        if(!rows.length)
                            return cb(new Error(util.format("species '%s' not in system", value.species)));

                        cb(null, rows);
                    });
                },
                findSong: function(cb) {
                    songtypes.findByName(value.songtype, function(err, rows) {
                        if(err) return cb(err);

                        if(!rows.length)
                            return cb(new Error(util.format("songtype '%s' not in system", value.songtype)));

                        cb(null, rows);
                    });
                },

                classExists: ['findSpecies', 'findSong', function(cb, results){
                    
                    var q = "SELECT count(*) as count \n"+
                            "FROM project_classes \n"+
                            "WHERE project_id = %s \n"+
                            "AND species_id = %s \n"+
                            "AND songtype_id = %s";

                    var species_id = results.findSpecies[0].id;
                    var songtype_id = results.findSong[0].id;
                    var project_id = value.project_id;

                    q = util.format(q, project_id, species_id, songtype_id);
                    queryHandler(q , function(err, rows) {
                        if(err) return cb(err);

                        cb(null, rows[0].count > 0);
                    });
                }],

                insert: ['classExists', function(cb, results){

                    if(results.classExists)
                        return cb(null, { error: "class already in project" });
                    
                    var q = 'INSERT INTO project_classes \n'+
                            'SET project_id = %s, species_id = %s, songtype_id = %s';

                    var species_id = results.findSpecies[0].id;
                    var songtype_id = results.findSong[0].id;
                    var project_id = value.project_id;

                    q = util.format(q, project_id, species_id, songtype_id);
                    queryHandler(q , function(err, row) {
                        if(err) return cb(err);

                        cb(null, row);
                    });
                }]
            },
            function(err, results) {
                if(err) return callback(err);

                callback(null, results.insert);
            });
        });
    },

    removeClasses: function(project_classes, callback) {
        var schema = joi.array().min(1).items(joi.number());

        joi.validate(project_classes, schema, function(err, value) {
            if(err) return callback(err);

            value = '(' + mysql.escape(value) + ')';

            var q = "DELETE FROM project_classes \n"+
                    "WHERE project_class_id IN %s";

            q = util.format(q, value);
            queryHandler(q, callback);
        });
    },
    
    getUsers: function(project_id, callback){ 
        
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));
        
        var q = "SELECT u.login AS username, \n"+
                "       u.user_id AS id, \n"+
                "       u.email, \n"+
                "       r.name AS rolename \n"+
                "FROM users AS u \n"+
                "JOIN user_project_role AS upr ON u.user_id = upr.user_id \n"+
                "JOIN roles AS r on upr.role_id = r.role_id \n"+
                "WHERE upr.project_id = %s";
        
        q = util.format(q, project_id);
        queryHandler(q, callback);
    },
    
    addUser: function(userProjectRole, callback) {
        var schema = {
            user_id: joi.number().required(),
            project_id: joi.number().required(),
            role_id: joi.number().required()
        };
        
        joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);
            
            var user_id = mysql.escape(upr.user_id);
            var project_id = mysql.escape(upr.project_id);
            var role_id = mysql.escape(upr.role_id);
            
            var q = 'INSERT INTO user_project_role \n'+
                    'SET user_id = %s, role_id = %s, project_id = %s';
            
            q = util.format(q, user_id, role_id, project_id);
            queryHandler(q, callback);
        });

    },
    
    changeUserRole: function(userProjectRole, callback) {
        var schema = {
            user_id: joi.number().required(),
            project_id: joi.number().required(),
            role_id: joi.number().required()
        };
            
        joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);
            
            var user_id = mysql.escape(upr.user_id);
            var project_id = mysql.escape(upr.project_id);
            var role_id = mysql.escape(upr.role_id);
            
            var q = "UPDATE user_project_role \n"+
                    "SET role_id = %s \n"+
                    "WHERE user_id = %s \n"+
                    "AND project_id = %s";
            
            q = util.format(q, role_id, user_id, project_id);
            queryHandler(q, callback);
        });
    },

    modelList: function(project_url, callback) {
        var q = "SELECT m.model_id, \n"+
                "   CONCAT(UCASE(LEFT(m.name, 1)), \n"+
                "   SUBSTRING(m.name, 2)) as mname, \n"+
                "   UNIX_TIMESTAMP( m.`date_created` )*1000 as date, \n"+
                "   CONCAT( \n"+
                "       CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)), \n"+
                "       ' ', \n"+
                "       CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) \n"+
                "   ) as muser, \n" + 
                "   mt.name as mtname, \n"+
                "   mt.enabled \n"+
                "FROM `models` as m,  \n"+
                "   `model_types` as mt,  \n"+
                "   `users` as u , `projects` as p \n"+
                "WHERE p.url = " + mysql.escape(project_url)+
                "AND m.`model_type_id` = mt.`model_type_id` \n"+
                "AND m.user_id = u.user_id \n"+
                "AND p.project_id = m.project_id \n"+
                "AND m.deleted = 0";

            queryHandler(q, callback);
    },
       
    classifications: function(project_url, callback) {
            var q = "SELECT UNIX_TIMESTAMP( j.`date_created` )*1000  as date "+
                    "  , j.`job_id`  , pl.`name` as playlistName,"+
                     " CONCAT(UCASE(LEFT(mode.`name`, 1)), SUBSTRING(mode.`name`, 2))  as modname  " +         
                    " , CONCAT(UCASE(LEFT(jpc.`name`, 1)), SUBSTRING(jpc.`name`, 2))  as cname  "+
                    " , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,"+
                    "  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser " + 
                    " from  `playlists`  as pl, `models` as mode , `jobs` as j ,`job_params_classification` as jpc , `projects` as p , `users` as u "+
                    " WHERE pl.`playlist_id` = jpc.`playlist_id` and mode.`model_id` = jpc.`model_id` and p.url  = "+mysql.escape(project_url)+" and j.`project_id` = p.`project_id`  and "+
                    " j.`job_id` = jpc.`job_id` and j.`job_type_id` = 2 and j.`completed` = 1 and u.`user_id` = j.`user_id`";

        queryHandler(q, callback);
    },
    
    // TODO move classification method to its own model file
    classificationName: function(cid, callback) {
        var q = "select  REPLACE(lower(c.`name`),' ','_')  as name , j.`project_id` as pid  "+
                " from   `job_params_classification`  c , `jobs` j where c.`job_id` = j.`job_id` and c.`job_id` = "+mysql.escape(cid);

        queryHandler(q, callback);
    },
    
    classificationDelete: function(classificationId, callback) {
        
        var cid = mysql.escape(classificationId);
        var modUri;
        var q;
        var allToDelete;
        
        async.waterfall([
            function(cb) {
                q = "SELECT `uri` FROM `models` WHERE `model_id` = "+
                    "(SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = "+cid+")";
                queryHandler(q, cb);
            },
            function(data, fields, cb) {
                if(!data.length) return callback(new Error('Classification not found'));
                
                modUri = data[0].uri.replace('.mod','');
                q = "SELECT `uri` FROM `recordings` WHERE `recording_id` in "+
                "(SELECT `recording_id` FROM `classification_results` WHERE `job_id` = "+cid+")";
                queryHandler(q, cb);
            },
            function(data, fields, cb) {
                allToDelete = [];
                async.each(data, function (elem, next) {
                    var uri = elem.uri.split("/");
                    uri = uri[uri.length-1];
                    allToDelete.push({Key:modUri+'/classification_'+cid+'_'+uri+'.vector'});
                    next();
                }, cb);
            },
            function(cb) {
                if(allToDelete.length === 0) {
                    cb();
                }
                else {
                    var params = {
                        Bucket: config('aws').bucketName,
                        Delete: { 
                            Objects: allToDelete
                        }
                    };
                    
                    s3.deleteObjects(params, function() {
                        cb();
                    });
                }
            },
            function(cb) {
                var q = "DELETE FROM `classification_results` WHERE `job_id` = "+cid;
                // console.log('exc quer 1');
                queryHandler(q, cb);
            },
            function(result, fields, cb) {
                q = "DELETE FROM `classification_stats` WHERE `job_id` = "+cid ;
                // console.log('exc quer 2');
                queryHandler(q, cb);
            },
            function(result, fields, cb) {
                q = "DELETE FROM `job_params_classification` WHERE `job_id` = "+cid;
                // console.log('exc quer 3');
                queryHandler(q, cb);
            }
        ], function(err) {
            if(err) return callback(err);
            
            callback(null, { data:"Classification deleted succesfully" });
        });
    },
    
    classificationCsvData: function(cid, callback) {
        var q = "SELECT extract(year from r.`datetime`) year , "+
                "extract(month from r.`datetime`) month , "+
                "extract(day from r.`datetime`) day , "+
                "extract(hour from r.`datetime`) hour , "+
                "extract(minute from r.`datetime`) min ,  "+
                " m.`threshold` , "+
                " m.`uri` , "+
                " r.`uri` ruri  , "+
		" cr.`max_vector_value` as mvv ," +
                "SUBSTRING_INDEX(r.`uri` ,'/',-1 ) rec , cr.`present` , s.`name` , sp.`scientific_name` , st.`songtype` "+
                "FROM `models` m , `job_params_classification`  jpc, `species` sp, `classification_results` cr, `recordings` r, `sites` s, `songtypes` st "+
                "WHERE cr.`job_id` ="+mysql.escape(cid)+" "+
                "AND jpc.`job_id` = cr.`job_id` "+
                "AND jpc.`model_id` = m.`model_id` "+
                "AND cr.`recording_id` = r.`recording_id` "+
                "AND s.`site_id` = r.`site_id` "+
                "AND sp.`species_id` = cr.`species_id` "+
                "AND cr.`songtype_id` = st.`songtype_id`  ";

        queryHandler(q, callback);
    },
    
    classificationErrorsCount: function(project_url,cid, callback) {
        var q = "SELECT count(*) AS count \n"+
                "FROM recordings_errors \n"+ 
                "WHERE job_id = " + mysql.escape(cid);

        queryHandler(q, callback);
    },
    
    classificationDetail: function(project_url, cid, callback) {
        var q = "SELECT c.`species_id`, \n"+
                "       c.`songtype_id`, \n"+
                "       c.`present`, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(st.`songtype`, 1)), \n"+
                "           SUBSTRING(st.`songtype`, 2) \n"+
                "       ) as songtype, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n"+
                "           SUBSTRING(s.`scientific_name`, 2) \n"+
                "       ) as scientific_name, \n"+
                "       mm.`threshold` as th \n"+
                "FROM  `models` mm, \n"+
                "      `job_params_classification`jpc, \n"+
                "      `classification_results` c, \n"+
                "      `species` as s , \n"+
                "      `songtypes` as st \n"+
                "WHERE c.`job_id` = " + mysql.escape(cid) +"\n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND jpc.`job_id` = c.`job_id` \n"+
                "AND mm.`model_id` = jpc.`model_id`";

        queryHandler(q, callback);
    },
    
    classificationDetailMore: function(project_url, cid, from, total, callback) {
        var q = "SELECT cs.`json_stats`, \n"+
                "       c.`species_id`, \n"+
                "       c.`songtype_id`, \n"+
                "       c.`present` as present, \n"+
                "       c.`recording_id`, \n"+
                "       SUBSTRING_INDEX( \n"+
                "           SUBSTRING_INDEX( r.`uri` , '.', 1 ), \n"+
                "           '/', \n"+
                "           -1  \n"+
                "        ) as recname, \n"+
                "       CONCAT( \n"+
                "           SUBSTRING_INDEX( r.`uri` , '.', 1 ), \n"+
                "           '.thumbnail.png' \n"+
                "       ) as uri, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(st.`songtype`, 1)), \n"+
                "           SUBSTRING(st.`songtype`, 2) \n"+
                "        ) as songtype , \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n"+
                "           SUBSTRING(s.`scientific_name`, 2) \n"+
                "       ) as scientific_name \n"+
                "FROM `classification_stats`  cs , \n"+
                "     `recordings` r, \n"+
                "     `classification_results` c, \n"+
                "     `species` as s , \n"+
                "     `songtypes` as st \n"+
                "WHERE c.`job_id` = " + mysql.escape(cid) + "\n"+
                "AND c.`job_id` = cs.`job_id` \n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND r.`recording_id` = c.`recording_id` \n"+
                "ORDER BY present DESC LIMIT " + parseInt(from) + "," + parseInt(total);
        
        queryHandler(q, callback);
    },
    
    classificationVector: function(c12nId, recId, callback) {
        var q = "SELECT CONCAT( \n"+
                "           SUBSTRING_INDEX(m.uri, '.', 1), \n"+
                "           '/classification_', \n"+
                "           cr.job_id, \n"+
                "           '_', \n"+
                "           SUBSTRING_INDEX(r.uri, '/', -1), \n"+
                "           '.vector' \n"+
                "       ) as vect \n"+
                "FROM classification_results AS cr \n"+
                "JOIN job_params_classification AS jpc ON jpc.job_id = cr.job_id \n"+
                "JOIN models AS m ON m.model_id = jpc.model_id \n"+
                "JOIN recordings AS r ON r.recording_id = cr.recording_id \n"+
                "WHERE cr.job_id = ? \n"+
                "AND r.recording_id = ? ";
        
        q = mysql.format(q, [c12nId, recId, callback]);
        
        queryHandler(q, callback);
    },
   
    trainingSets: function(project_url, callback) {
        var q = "SELECT (select count(x1) from  `training_set_roi_set_data` tsrsd where tsrsd.`training_set_id` = ts.`training_set_id`) as count ,"+
                " ts.`training_set_id` , CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as name "+
                " , ts.`date_created` , CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype "+
                " , CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name " +
                " , tsrs.`species_id` , tsrs.`songtype_id` " +
                " FROM `training_sets` ts, `projects` p ,`training_sets_roi_set` tsrs , `songtypes` st , `species` s" +
                " where ts.`training_set_id` = tsrs.`training_set_id` and "+
                " st.`songtype_id` = tsrs.`songtype_id` and s.`species_id`  = tsrs.`species_id` " +  	
                " and ts.`project_id` = p.`project_id` and p.`url` = " + mysql.escape(project_url);

        queryHandler(q, callback);
    },

    validationSets: function(project_url, callback) {
        var q = "SELECT `validation_set_id` , ts.`name` \n" +
                "FROM `validation_set` ts, `projects` p \n" +
                "WHERE ts.`project_id` = p.`project_id` \n" +
                "AND p.`url` = " + mysql.escape(project_url);
        queryHandler(q, callback);
    },
   
    validationsStats: function(project_url,species,songtype, callback) {
        var q = "select * from "+
            " (SELECT count(*) as total FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = "+mysql.escape(project_url)+" and `species_id` = "+mysql.escape(species)+" and `songtype_id` = "+mysql.escape(songtype)+" ) a, "+
            " (SELECT count(*) as present FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = "+mysql.escape(project_url)+" and `species_id` = "+mysql.escape(species)+" and `songtype_id` = "+mysql.escape(songtype)+"  and present = 1) b , "+
            " (SELECT count(*) as absent FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = "+mysql.escape(project_url)+" and `species_id` = "+mysql.escape(species)+"and `songtype_id` = "+mysql.escape(songtype)+"  and present = 0) c ";
        queryHandler(q, callback);
    },
    
    validationsCount: function(project_id, callback) {
        var q = "SELECT count(*) AS count \n"+
                "FROM recording_validations AS rv\n"+
                "WHERE rv.project_id = " + mysql.escape(project_id);
        queryHandler(q, callback);
    },
    
    modelValidationUri: function(model_id, callback) {
        var q = "SELECT vs.`uri` FROM `validation_set` vs, `models` m \n"+
                "WHERE m.`validation_set_id` = vs.`validation_set_id` \n"+
                "AND m.`model_id` = "+ mysql.escape(model_id);
        
        queryHandler(q, callback);      
    },

    removeUser: function(user_id, project_id, callback) {
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));
        
        if(typeof user_id !== 'number')
            return callback(new Error("invalid type for 'user_id'"));
        
        var q = "DELETE FROM user_project_role \n"+
                "WHERE user_id = %s AND project_id = %s";
        
        q = util.format(q, mysql.escape(user_id), mysql.escape(project_id));
        queryHandler(q, callback);
    },
    
    availableRoles: function(callback) {
        var q = "SELECT role_id as id, name, description \n"+
                "FROM roles \n"+
                "WHERE name != 'Owner' order by level";
                
        queryHandler(q, callback);
    },
    
    // this includes recordings processing
    totalRecordings: function(project_id, callback) {
        var q = "SELECT count(*) as count \n"+
                "FROM ( \n"+
                "    (SELECT upload_id as id \n"+
                "    FROM uploads_processing  \n"+
                "    WHERE project_id = %1$s) \n"+
                "    UNION \n"+
                "    (SELECT recording_id as id \n"+
                "    FROM recordings AS r \n"+
                "    JOIN sites AS s ON s.site_id = r.site_id \n"+
                "    WHERE s.project_id = %1$s) \n"+
                ") as t";
        
        q = sprintf(q, mysql.escape(project_id));
        queryHandler(q, callback);
    },
    
    // this includes recordings processing
    getStorageUsage: function(project_id, callback) {
        var q = "SELECT COALESCE(sum(t.duration)/60, 0) as min_usage  \n"+
                "FROM ( \n"+
                "    (SELECT u.duration \n"+
                "    FROM uploads_processing as u \n"+
                "    WHERE project_id = ?) \n"+
                "    UNION ALL \n"+
                "    (SELECT r.duration \n"+
                "    FROM recordings AS r \n"+
                "    JOIN sites AS s ON s.site_id = r.site_id \n"+
                "    WHERE s.project_id = ?) \n"+
                ") as t;";
        
        q = mysql.format(q, [project_id, project_id]);
        queryHandler(q, callback);
    },
};


module.exports = Projects;
