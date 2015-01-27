var util = require('util');
var mysql = require('mysql');
var Joi = require('joi');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var Sites = {
    findById: function (site_id, callback) {
        var query = "SELECT * FROM sites WHERE site_id = " + mysql.escape(site_id);

        return queryHandler(query , callback);
    },
    
    insert: function(site, callback) {
        var values = [];
        
        var requiredValues = [
            "project_id",
            "name",
            "lat",
            "lon",
            "alt"
        ];
        
        site.site_type_id = 2; // mobile recorder
        
        for(var i in requiredValues) {
            if(typeof site[requiredValues[i]] === "undefined")
                return callback(new Error("required field '"+ requiredValues[i] + "' missing"));
        }
        
        for(var j in site) {
            if(j !== 'id') {
                site[j] = mysql.escape(site[j]);
                
                values.push(util.format('`%s`=%s', j, site[j]));
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

                values.push(util.format('`%s`=%s', key, mysql.escape(value)));
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
                            project_id: 1,
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
    }
};

module.exports = Sites;
