var util = require('util');
var mysql = require('mysql');
var AWS   = require('aws-sdk');
var joi = require('joi');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');

var s3;
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var Sites = {
    findById: function (site_id, callback) {
        var query = "SELECT * FROM sites WHERE site_id = " + mysql.escape(site_id);

        return queryHandler(query , callback);
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
                    mysql.escapeId(j), 
                    mysql.escape(site[j])
                ));
            }
        }
        
        var q = 'INSERT INTO sites \n'+
                'SET %s';
        
        q = util.format(q, values.join(", "));
        queryHandler(q, callback);
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
                    mysql.escapeId(key), 
                    mysql.escape(value)
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
            mysql.escape(site_name),
            mysql.escape(project_id)
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
                                
                        q = util.format(q, mysql.escape(site_id));
                        queryHandler(q, callback);
                    }
                });
            }
            else {
                var q = 'DELETE FROM project_imported_sites \n'+
                        'WHERE site_id = %s \n'+
                        'AND project_id = %s';
                        
                q = util.format(q, mysql.escape(site_id), mysql.escape(project_id));
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
                
        q = util.format(q, mysql.escape(site_id));
        
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
                    
            q = util.format(q, mysql.escape(site_id), mysql.escape(project_id));
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
            "SET token_created_on = "+mysql.escape(iat)+" \n" + 
            "WHERE site_id = " + mysql.escape(site.site_id), 
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
            "WHERE site_id = " + mysql.escape(site.site_id), 
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
        
        var key = ('project_' + (site.project_id | 0) + 
                  '/site_'  + (site.site_id | 0) + 
                  '/logs/recorder_' + (log.recorder + '') +
                  '/' + (log.from | 0) + '-' + (log.to | 0) + '.txt');
        
        s3.putObject({
            Bucket : config('aws').bucketName,
            Key    : key,
            Body   : log.file
        }, function(err, data){
            if(err) { 
                callback(err);
            } else {
                callback();
            }
        });        
    }

};

module.exports = Sites;
