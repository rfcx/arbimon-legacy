var q = require('q');
var util = require('util');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var Users = require('./users.js');


var News = {
    getNewsTypeFormats: function() {
        return dbpool.query(
            "SELECT news_type_id AS id,\n"+
            "       message_format \n"+
            "FROM project_news_types"
        );
    },
    
    getFor: function(options) {
        options = options || {};
        var where=[], data=[];
        var page = options.page | 0;
        var pageSize = (options.pageSize | 0) || 10;
        
        if(options.project){
            where.push("n.project_id IN (?)");
            data.push(options.project);
        }
        
        data.push(page * pageSize, pageSize);
        
        return dbpool.query(
            "SELECT n.data, \n"+
            "       u.login AS username, \n"+
            "       u.email, \n"+
            "       n.timestamp, \n"+
            "       n.project_id, \n"+
            "       p.name AS project, \n"+
            "       n.news_type_id AS type\n"+
            "FROM project_news AS n \n"+
            "JOIN users AS u ON u.user_id = n.user_id \n"+
            "JOIN projects AS p ON n.project_id = p.project_id \n"+
            (where.length ? "WHERE (" + where.join(") AND (") + ")\n" : "") +
            "ORDER BY n.timestamp DESC \n"+
            "LIMIT ?, ?", 
            data
        );
    },

    
    userFeed: function(user_id, page, callback) {
        return Users.projectList(user_id).then(function(projects){
            return projects.map(function(row) {
                return row.id;
            });
        }).then(function(project_ids){
            return project_ids.length ? News.getFor({project:project_ids, page:page, pageCount:10}) : [];
        }).nodeify(callback);
    },
    
    list: function(page, callback) {
        return News.getFor({page:page, pageCount:10}).nodeify(callback);
    },
    
    countProjectsCreatedToday: function(callback) {
        var q = 'SELECT COUNT(*) AS count  \n'+
                'FROM `project_news`  \n'+
                'WHERE news_type_id = 1 \n'+
                'AND DATE(timestamp) = DATE(NOW())';
        queryHandler(q, callback); 
    },
};

module.exports = News;
