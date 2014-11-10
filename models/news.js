var util = require('util');
var mysql = require('mysql');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var Users = require('./users.js');


var Species = {
    newsTypesFormat: function(callback) {
        var q = "SELECT news_type_id AS id,\n"+
                "       message_format \n"+
                "FROM project_news_types";
                
        queryHandler(q, callback);
    },
    
    userFeed: function(user_id, callback) {
        Users.projectList(user_id, function(err, rows){
            if(err) return callback(err);
            
            if(!rows.length)
                return callback(null, []);
            
            var project_ids = rows.map(function(row) {
                return row.id;
            });
            
            var q = "SELECT n.data, \n"+
                    "       u.login AS username, \n"+
                    "       u.email, \n"+
                    "       n.timestamp, \n"+
                    "       p.name AS project, \n"+
                    "       n.news_type_id AS type\n"+
                    "FROM project_news AS n \n"+
                    "JOIN users AS u ON u.user_id = n.user_id \n"+
                    "JOIN projects AS p ON n.project_id = p.project_id \n"+
                    "WHERE n.project_id IN ( %s ) \n"+
                    "ORDER BY n.timestamp DESC";

            
            q = util.format(q, mysql.escape(project_ids));
        	queryHandler(q, callback);
        })
    }
};

module.exports = Species;
