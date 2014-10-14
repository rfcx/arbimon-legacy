var util = require('util');
var mysql = require('mysql');

module.exports = function(queryHandler) {
    return {
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
            
            for( var i in site) {
                if(i !== 'id') {
                    site[i] = mysql.escape(site[i]);
                    
                    values.push(util.format('`%s`=%s', i, site[i]));
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
                site.site_id = site.id
                delete site.id;
            
            if(typeof site.site_id === "undefined")
                return callback(new Error("required field 'site_id' missing"));
            
            var tableFields = [
                "project_id",
                "name",
                "lat",
                "lon",
                "alt",
                "site_type_id"
            ];
            
            for( var i in tableFields) {
                if(site[tableFields[i]]) {
                    var key = tableFields[i];
                    var value = site[key] 

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
                if(err)
                    return callback(err);
                
                callback(null, rows[0].count > 0);
            });     
        },
        
        remove: function(sites, callback) {
            
            sites = '(' + mysql.escape(sites) + ')';
                
            var q = 'DELETE FROM sites \n'+
                    'WHERE site_id IN %s';
                    
            q = util.format(q, sites);
            queryHandler(q, callback);
        }
    };
};
