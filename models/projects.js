var util = require('util');
var mysql = require('mysql');

module.exports = function(queryHandler) {
    return {
        findByUrl: function (project_url, callback) {
            var query = "select * from projects where url = " + mysql.escape(project_url);
            
            return queryHandler(query , callback);
        },
        
        getProjectSites: function(project_id, callback){
            var query = (
                "SELECT S.site_id as id, S.name, S.lat, S.lon, S.site_type_id as type \n" +
                "FROM sites S \n" +
                "WHERE S.project_id = " + mysql.escape(project_id)
            );
            
            return queryHandler(query , callback);
        }
    };
}
    
