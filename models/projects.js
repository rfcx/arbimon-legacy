var util = require('util');
var mysql = require('mysql');
var dbpool = require('../utils/dbpool');

var queryHandler = dbpool.queryHandler;
module.exports = {
        findByUrl: function (project_url, callback) {
            var query = "SELECT * FROM projects WHERE url = " + mysql.escape(project_url);

            return queryHandler(query , callback);
        },

        findByName: function (project_name, callback) {
            var query = "SELECT * FROM projects WHERE name = " + mysql.escape(project_name);

            return queryHandler(query , callback);
        },

        getProjectSites: function(project_id, callback){
            var query = (
                "SELECT S.site_id as id, S.name, S.lat, S.lon, S.alt \n" +
                "FROM sites S \n" +
                "WHERE S.project_id = " + mysql.escape(project_id)
            );

            return queryHandler(query , callback);
        },

        /** Fetches a project's classes.
         * @param {{Object}} project project object.
         * @param {{Integer}} project.project_id
         * @param {{Integer}} class_id (optional) limit the query to this class
         * @param {{Callback}} callback
         */
        getProjectClasses: function(project, class_id, callback){
            if(class_id instanceof Function){
                callback = class_id;
                class_id = null;
            }
            var sql = (
                "SELECT PC.project_class_id as id, PC.species_id as species, PC.songtype_id as songtype \n" +
                "FROM project_classes PC \n" +
                "WHERE PC.project_id = " + mysql.escape(project.project_id) +
                (class_id ? "\n  AND PC.project_class_id = " + (class_id|0) : '')
            );

            return queryHandler(sql , callback);
        },

        insert: function(project, callback) {
            var values = [];

            var requiredValues = [
                "name",
                "url",
                "description",
                "owner_id",
                "project_type_id",
                "is_private"
            ];

            for(var i in requiredValues) {
                if(typeof project[requiredValues[i]] === "undefined")
                    return callback(new Error("required field '"+ requiredValues[i] + "' missing"));
            }

            for( var i in project) {
                if(i !== 'id') {
                    project[i] = mysql.escape(project[i]);
                    values.push(util.format('`%s`=%s', i, project[i]));
                }
            }

            var q = 'INSERT INTO projects \n'+
                    'SET %s';

            q = util.format(q, values.join(", "));

            queryHandler(q, callback);
        },

        update: function(project, callback) {
            var values = [];

            if(typeof project["project_id"] === "undefined")
                return callback(new Error("required field 'project_id' missing"));

            for( var i in project) {
                if(i !== 'project_id') {
                    project[i] = mysql.escape(project[i]);
                    values.push(util.format('`%s`=%s', i, project[i]));
                }
            }

            var q = 'UPDATE projects \n'+
                    'SET %s \n'+
                    'WHERE site_id = %s';

            q = util.format(q, values.join(", "), project.site_id);

            queryHandler(q, callback);
        },

        addUser: function(row, callback) {

            var user_id = mysql.escape(row.user_id);
            var project_id = mysql.escape(row.project_id);
            var role_id = mysql.escape(row.role_id);

            var q = 'INSERT INTO user_project_role \n'+
                    'SET user_id = %s, role_id = %s, project_id = %s';

            q = util.format(q, user_id, role_id, project_id);
            queryHandler(q, callback);
        },

        insertNews: function(news) {
            var user_id = mysql.escape(news.user_id);
            var project_id = mysql.escape(news.project_id);
            var description = mysql.escape(news.description);
            var news_type_id = mysql.escape(news.news_type_id);

            var q = 'INSERT INTO project_news \n'+
                    'SET user_id = %s, '+
                    'project_id = %s, '+
                    'description = %s, '+
                    'news_type_id = %s';

            q = util.format(q, user_id, project_id, description, news_type_id);
            queryHandler(q, function(err) {
                if(err) throw err;
            });
        }
};
