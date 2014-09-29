var util = require('util');
var mysql = require('mysql');

module.exports = function(queryHandler) {
    return {
        findByUrl: function (project_url, callback) {
            var query = "select * from projects where url = " + mysql.escape(project_url);
            
            return queryHandler(query , callback);
        }
    };
}
    
