var util = require('util');
var AWS   = require('aws-sdk');
var joi = require('joi');
var q = require('q');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');

var s3;
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var site_log_processor = require('../utils/site_log_processor');

var Sites = {
    findById: function (site_id, callback) {
        var query = "SELECT * FROM sites WHERE site_id = " + dbpool.escape(site_id);

        return queryHandler(query , callback);
    },

    findByIdAsync: function(site_id) {
        let find = util.promisify(this.findById)
        return find(site_id)
    },

    insert: function(site, callback) {
        var values = [];

        var schema = {
            project_id: joi.number(),
            name: joi.string(),
            lat: joi.number(),
            lon: joi.number(),
            alt: joi.number(),
            site_type_id: joi.number().optional().default(2), // default mobile recorder
            legacy: joi.boolean().optional().default(true), // wheter this site belongs to Arbimon (true) or RFCx platform (false)
        };

        var result = joi.validate(site, schema, {
            stripUnknown: true,
            presence: 'required',
        });

        if(result.error) {
            return callback(result.error);
        }

        site = result.value;

        for(var j in site) {
            if(j !== 'id') {
                values.push(util.format('%s = %s',
                    dbpool.escapeId(j),
                    dbpool.escape(site[j])
                ));
            }
        }

        var q = 'INSERT INTO sites \n'+
                'SET %s';

        q = util.format(q, values.join(", "));
        queryHandler(q, callback);
    },

    insertAsync: function(site) {
        let insert = util.promisify(this.insert)
        return insert(site)
    },

    update: function(site, callback) {
        var values = [];

        if(site.id)
            site.site_id = site.id;
            delete site.id;

        if(typeof site.site_id === "undefined")
            return callback(new Error("required field 'site_id' missing"));

        var tableFields = [
            "project_id",
            "name",
            "lat",
            "lon",
            "alt",
            "published",
            "site_type_id"
        ];

        for( var i in tableFields) {
            if(site[tableFields[i]] !== undefined) {
                var key = tableFields[i];
                var value = site[key];

                values.push(util.format('%s = %s',
                    dbpool.escapeId(key),
                    dbpool.escape(value)
                ));
            }
        }

        var q = 'UPDATE sites \n'+
                'SET %s \n'+
                'WHERE site_id = %s';

        q = util.format(q, values.join(", "), site.site_id);

        queryHandler(q, callback);
    },

    exists: function(site_name, project_id, callback) {
        var q = 'SELECT count(*) as count \n'+
                'FROM sites \n'+
                'WHERE name = %s \n'+
                'AND project_id = %s';

        q = util.format(q,
            dbpool.escape(site_name),
            dbpool.escape(project_id)
        );

        queryHandler(q, function(err, rows){
            if(err) return callback(err);

            callback(null, rows[0].count > 0);
        });
    },

    removeFromProject: function(site_id, project_id, callback) {
        if(!site_id || !project_id)
            return callback(new Error("required field missing"));

        Sites.findById(site_id, function(err, rows) {
            if(err) return callback(err);

            if(!rows.length) return callback(new Error("invalid site"));

            site = rows[0];

            if(site.project_id === project_id) {
                Sites.haveRecordings(site_id, function(err, result) {
                    if(result) {
                        Sites.update({
                            id: site_id,
                            project_id: config('trash-project').id,
                            published: false
                        }, callback);
                    }
                    else {
                        var q = 'DELETE FROM sites \n'+
                                'WHERE site_id = %s';

                        q = util.format(q, dbpool.escape(site_id));
                        queryHandler(q, callback);
                    }
                });
            }
            else {
                var q = 'DELETE FROM project_imported_sites \n'+
                        'WHERE site_id = %s \n'+
                        'AND project_id = %s';

                q = util.format(q, dbpool.escape(site_id), dbpool.escape(project_id));
                queryHandler(q, callback);
            }
        });
    },

    listPublished: function(callback) {
        var q = "SELECT p.name AS project_name, \n"+
                "       p.project_id, \n"+
                "       u.login AS username, \n"+
                "       s.name, \n"+
                "       s.lat, \n"+
                "       s.lon, \n"+
                "       s.site_id AS id, \n"+
                "       count( r.recording_id ) as rec_count \n"+
                "FROM sites AS s \n"+
                "JOIN projects AS p ON s.project_id = p.project_id \n"+
                "JOIN users AS u ON p.owner_id = u.user_id \n"+
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id \n"+
                "WHERE s.published = 1 \n"+
                "GROUP BY s.site_id";

        queryHandler(q, callback);
    },

    haveRecordings: function(site_id, callback) {
        var q = "SELECT COUNT( r.recording_id ) as rec_count\n"+
                "FROM sites AS s \n"+
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id  \n"+
                "WHERE s.site_id = %s\n"+
                "GROUP BY s.site_id";

        q = util.format(q, dbpool.escape(site_id));

        queryHandler(q, function(err, rows) {
            if(err) return callback(err);

            callback(null, rows[0].rec_count > 0);
        });
    },

    importSiteToProject: function(site_id, project_id, callback) {
        if(!site_id || !project_id)
            return callback(new Error("required field missing"));

        Sites.findById(site_id, function(err, rows) {
            if(err) return callback(err);

            if(!rows.length) return callback(new Error("invalid site"));

            var site = rows[0];

            if(site.project_id === project_id) {
                return callback(new Error("cant import site to it own project"));
            }

            var q = "INSERT INTO project_imported_sites(site_id, project_id) \n"+
                    "VALUES (%s,%s)";

            q = util.format(q, dbpool.escape(site_id), dbpool.escape(project_id));
            queryHandler(q, callback);
        });
    },

    generateToken: function(site, callback){
        var payload = {
            project: site.project_id,
            site: site.site_id
        };
        var token = jsonwebtoken.sign(payload, config('tokens').secret, config('tokens').options);
        var iat = jsonwebtoken.decode(token).iat;

        queryHandler(
            "UPDATE sites \n" +
            "SET token_created_on = "+dbpool.escape(iat)+" \n" +
            "WHERE site_id = " + dbpool.escape(site.site_id),
            function(err){
                if(err){
                    callback(err);
                } else {
                    callback(null, {
                        type : "A2Token",
                        name: site.name,
                        created: iat,
                        expires: 0,
                        token: token
                    });
                }
            }
        );
    },

    revokeToken: function(site, callback){
        queryHandler(
            "UPDATE sites \n" +
            "SET token_created_on = NULL \n" +
            "WHERE site_id = " + dbpool.escape(site.site_id),
        callback);
    },

    /** Uploads a log file of a recorder associated to this site.
     * @param {Object}  site - an object representing the site.
     * @param {Integer} site.project_id - id of the site's project.
     * @param {Integer} site.site_id - id of the given site.
     * @param {Object}  log - an object representing the log file.
     * @param {Integer} log.recorder - uuid representing the recorder whose log is being uploaded
     * @param {Integer} log.from     - datetime at which this log was started.
     * @param {Integer} log.to       - datetime at which this log was ended.
     * @param {Integer} log.file     - file containing the log's data.
     * @param {Callback} callback    - callback function
     */
    uploadLogFile: function(site, log, callback){
        if(!s3){
            s3 = new AWS.S3();
        }

        var dbconn;

        var key = ('project_' + (site.project_id | 0) +
                  '/site_'  + (site.site_id | 0) +
                  '/logs/recorder_' + (log.recorder + '') +
                  '/' + (log.from | 0) + '-' + (log.to | 0) + '.txt');
        return q.ninvoke(s3, 'putObject', {
            Bucket : config('aws').bucketName,
            Key    : key,
            Body   : log.file
        }).then(function(data){
            return q.nfcall(queryHandler,
                "INSERT INTO site_log_files(site_id, log_start, log_end, uri) \n" +
                "VALUES ("+
                    (site.site_id|0)+", " +
                    "FROM_UNIXTIME("+Math.abs(log.from/1000.0)+"), " +
                    "FROM_UNIXTIME("+Math.abs(log.to  /1000.0)+"), " +
                    dbpool.escape(key) +
                ")"
            );
        }).then(function(){
            return q.ninvoke(dbpool, 'getConnection');
        }).then(function(dbconn){
            return site_log_processor.process_site_logs(
                {file:log.filepath},
                site.site_id | 0,
                dbconn
            ).finally(function(){
                dbconn.release();
            });
        }).nodeify(callback);
    },

    /** Returns the site's data log.
     * @param {Object}  site - an object representing the site.
     * @param {Integer} site.site_id - id of the given site.
     * @param {Object}  options - options object.
     * @param {bool}  options.only_dates - show the dates with logged data instead of the logs.
     * @param {String}  options.quantize - aggregate entries by the specified time interval.
     *                    Format is a number plus an unit (min(s), hour(s), day(s) or week(s))
     * @param {Date}  options.from - limit returned data to entries after or at this date
     * @param {Date}  options.to   - limit returned data to entries before or at this date
     * @param {Date}  options.stat - limit returned data to the given stats
     * @param {Callback} callback    - callback function
     */
    getDataLog: function(site, options, callback){
        dbpool.getConnection(function(err, dbconn){
            var m;
            if(err){
                callback(err);
                return;
            }
            var site_id = site.site_id | 0;

            var sql, params=[site_id];
            if (options.only_dates) {
                sql = {sql:"SELECT DATE(SDL.datetime) as dates, COUNT(*) as count\n" +
                "FROM site_data_log SDL\n" +
                "WHERE site_id = ?\n" +
                "GROUP BY DATE(SDL.datetime)",
                typeCast: function (field, next) {
                    if (field.type !== 'DATE') return next(); // 1 = true, 0 = false
                    return field.string();
                }};
            } else {
                var fields = [['SDL.datetime', 'datetime']];
                var stats  = [['SDL.power', 'power'], ['SDL.temp', 'temp'], ['SDL.voltage', 'voltage'],
                              ['SDL.battery', 'battery'], ['SDL.status', 'status'], ['SDLPT.type', 'plug_type'], ['SDLHT.type', 'health'],
                              ['SDLTT.type', 'bat_tech']];
                if(options.stat){
                    var options_stats={};
                    options.stat.forEach(function(s){options_stats[s]=true;});
                    stats.forEach(function(s){
                        if(options_stats[s[1]]){
                            fields.push(s);
                        }
                    });
                } else {
                    fields.push.apply(fields, stats);
                }
                var group_clause;

                if(options.quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(options.quantize))){
                    var scale=m[1]|0, qfunc = {
                        min   : 'FLOOR(UNIX_TIMESTAMP(SDL.datetime)/60)',
                        hour  : 'FLOOR(UNIX_TIMESTAMP(SDL.datetime)/3600)',
                        day   : 'FLOOR(UNIX_TIMESTAMP(SDL.datetime)/86400)',
                        week  : 'FLOOR(UNIX_TIMESTAMP(SDL.datetime)/604800)',
                    }[m[2]];
                    if(scale != 1){
                        qfunc = 'FLOOR('+qfunc+'/'+scale+')*'+scale;
                    }
                    var dtfield = fields.shift(); // remove datetime
                    // var mins = fields.map(function(f){ return ['MIN('+f[0]+')', 'min_'+f[1]];});
                    // var maxs = fields.map(function(f){ return ['MAX('+f[0]+')', 'max_'+f[1]];});
                    // var means = fields.map(function(f){ return ['AVG('+f[0]+')', 'mean_'+f[1]];});
                    // fields.push.apply(fields, mins);
                    // fields.push.apply(fields, maxs);
                    // fields.push.apply(fields, means);
                    fields.forEach(function(f){ f[0] = 'AVG('+f[0]+')';});
                    fields.unshift(dtfield); // add datetime
                    // fields.push([qfunc, m[2]]);
                    group_clause = qfunc;
                }

                sql = "SELECT " + fields.map(function(field){
                    return field[0] + ' as `'+ field[1] +'`';
                }).join(", ")+ " \n" +
                "FROM site_data_log SDL\n" +
                "JOIN site_data_log_plug_types SDLPT ON SDL.plug_type = SDLPT.plug_type_id \n" +
                "JOIN site_data_log_health_types SDLHT ON SDL.health = SDLHT.health_type_id \n" +
                "LEFT JOIN site_data_log_tech_types SDLTT ON SDL.bat_tech = SDLTT.tech_type_id \n" +
                "WHERE site_id = ?";
                if (options.dates) {
                    sql += " AND DATE(SDL.datetime) IN (?)";
                    params.push(options.dates);
                }
                if (options.from) {
                    if(options.to){
                        sql += " AND SDL.datetime BETWEEN ? AND ?";
                        params.push(options.from, options.to);
                    } else {
                        sql += " AND SDL.datetime >= ?";
                        params.push(options.from);
                    }
                } else if(options.to){
                    sql += " AND SDL.datetime <= ?";
                    params.push(options.to);
                }
                if(group_clause){
                    sql += " \nGROUP BY " + group_clause;
                }
            }

            var resultstream = dbconn.query(sql, params).stream({highWaterMark:5});
            resultstream.on('error', function(err) {
                callback(err);
            });
            resultstream.on('fields',function(fields,i) {
              callback(null, resultstream, fields);
            });
            resultstream.on('end', function(){
                dbconn.release();
            });
        });
    },

    /** Returns the site's upload stats.
     * @param {Object}  site - an object representing the site.
     * @param {Integer} site.site_id - id of the given site.
     * @param {Object}  options - options object.
     * @param {String}  options.quantize - aggregate entries by the specified time interval.
     *                    Format is a number plus an unit (min(s), hour(s), day(s) or week(s))
     * @param {Date}  options.from - limit returned data to entries after or at this date
     * @param {Date}  options.to   - limit returned data to entries before or at this date
     * @param {Callback} callback    - callback function
     */
    getUploadStats: function(site, options, callback){
        dbpool.getConnection(function(err, dbconn){
            var m;
            if(err){
                callback(err);
                return;
            }
            var site_id = site.site_id | 0;

            var sql, params=[site_id];
            var group_clause;

            if(options.quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(options.quantize))){
                var scale=m[1]|0, qfunc = {
                    min   : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/60)',
                    hour  : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/3600)',
                    day   : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/86400)',
                    week  : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/604800)',
                }[m[2]];
                if(scale != 1){
                    qfunc = 'FLOOR('+qfunc+'/'+scale+')*'+scale;
                }
                group_clause = qfunc;
            }

            sql = "SELECT R.upload_time AS datetime, COUNT(*) AS uploads \n" +
            "FROM recordings R\n" +
            "WHERE site_id = ?";
            if (options.dates) {
                sql += " AND DATE(R.upload_time) IN (?)";
                params.push(options.dates);
            }
            if (options.from) {
                if(options.to){
                    sql += " AND R.upload_time BETWEEN ? AND ?";
                    params.push(options.from, options.to);
                } else {
                    sql += " AND R.upload_time >= ?";
                    params.push(options.from);
                }
            } else if(options.to){
                sql += " AND R.upload_time <= ?";
                params.push(options.to);
            }
            if(group_clause){
                sql += " \nGROUP BY " + group_clause;
            }

            var resultstream = dbconn.query(sql, params).stream({highWaterMark:5});
            resultstream.on('error', function(err) {
                callback(err);
            });
            resultstream.on('fields',function(fields,i) {
              callback(null, resultstream, fields);
            });
            resultstream.on('end', function(){
                dbconn.release();
            });
        });
    },

        /** Returns the site's upload stats.
         * @param {Object}  site - an object representing the site.
         * @param {Integer} site.site_id - id of the given site.
         * @param {Object}  options - options object.
         * @param {String}  options.quantize - aggregate entries by the specified time interval.
         *                    Format is a number plus an unit (min(s), hour(s), day(s) or week(s))
         * @param {Date}  options.from - limit returned data to entries after or at this date
         * @param {Date}  options.to   - limit returned data to entries before or at this date
         * @param {Callback} callback    - callback function
         */
    getRecordingStats: function(site, options, callback){
            dbpool.getConnection(function(err, dbconn){
                var m;
                if(err){
                    callback(err);
                    return;
                }
                var site_id = site.site_id | 0;

                var sql, params=[site_id];
                var group_clause;

                if(options.quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(options.quantize))){
                    var scale=m[1]|0, qfunc = {
                        min   : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/60)',
                        hour  : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/3600)',
                        day   : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/86400)',
                        week  : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/604800)',
                    }[m[2]];
                    if(scale != 1){
                        qfunc = 'FLOOR('+qfunc+'/'+scale+')*'+scale;
                    }
                    group_clause = qfunc;
                }

                sql = "SELECT R.datetime AS datetime, COUNT(*) AS count \n" +
                "FROM recordings R\n" +
                "WHERE site_id = ?";
                if (options.dates) {
                    sql += " AND DATE(R.datetime) IN (?)";
                    params.push(options.dates);
                }
                if (options.from) {
                    if(options.to){
                        sql += " AND R.datetime BETWEEN ? AND ?";
                        params.push(options.from, options.to);
                    } else {
                        sql += " AND R.datetime >= ?";
                        params.push(options.from);
                    }
                } else if(options.to){
                    sql += " AND R.datetime <= ?";
                    params.push(options.to);
                }
                if(group_clause){
                    sql += " \nGROUP BY " + group_clause;
                }

                var resultstream = dbconn.query(sql, params).stream({highWaterMark:5});
                resultstream.on('error', function(err) {
                    callback(err);
                });
                resultstream.on('fields',function(fields,i) {
                  callback(null, resultstream, fields);
                });
                resultstream.on('end', function(){
                    dbconn.release();
                });
            });
        },


    /** Returns the list of uploaded log files.
     * @param {Object}  site - an object representing the site.
     * @param {Integer} site.project_id - id of the site's project.
     * @param {Integer} site.site_id - id of the given site.
     * @param {Callback} callback    - callback function
     */
    getLogFileList: function(site, callback){
        queryHandler(
            "SELECT site_log_file_id as id, UNIX_TIMESTAMP(log_start) as `from`, UNIX_TIMESTAMP(log_end) as `to`\n" +
            "FROM site_log_files \n" +
            "WHERE site_id = " + (site.site_id | 0),
        callback);
    }
};

module.exports = Sites;
