var util = require('util');
var mysql = require('mysql');
var async = require('async');
var Joi = require('joi');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var species = require('./species');
var songtypes = require('./songtypes');

var Projects = {
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
        
        var schema = {
            project_id: Joi.number(),
            name: Joi.string().optional(),
            url: Joi.string().optional(),
            description: Joi.string().optional(),
            owner_id: Joi.number().optional(),
            project_type_id: Joi.number().optional(),
            is_private: Joi.number().optional(),
            is_enabled: Joi.number().optional()
        }
        
        Joi.validate(project, schema, function(err, projectInfo){
            if(err) return callback(err);
            
            var values = [];
            
            for( var i in projectInfo) {
                if(i !== 'project_id') {
                    projectInfo[i] = mysql.escape(projectInfo[i]);
                    values.push(util.format('`%s`=%s', i, projectInfo[i]));
                }
            }
            
            var q = 'UPDATE projects \n'+
                    'SET %s \n'+
                    'WHERE project_id = %s';

            q = util.format(q, values.join(", "), projectInfo.project_id);
            queryHandler(q, callback);
        });
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
            "SELECT pc.project_class_id as id, \n"+
                "pc.species_id as species, \n"+
                "pc.songtype_id as songtype, \n"+
                "sp.scientific_name as species_name, \n"+
                "so.songtype as songtype_name \n"+
            "FROM project_classes AS pc \n"+
            "JOIN species AS sp on sp.species_id = pc.species_id \n"+
            "JOIN songtypes AS so on so.songtype_id = pc.songtype_id \n" +
            "WHERE pc.project_id = " + mysql.escape(project.project_id) +
            (class_id ? "\n  AND pc.project_class_id = " + (class_id|0) : '')
        );

        return queryHandler(sql , callback);
    },

    insertClass: function(project_class, callback) {
        var schema = {
            species: Joi.string(),
            songtype: Joi.string(),
            project_id: Joi.number()
        }

        Joi.validate(project_class, schema, function(err, value) {
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

                    console.log(results);
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

                    console.log(results);
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
        })
    },

    removeClasses: function(project_classes, callback) {
        var schema = Joi.array().min(1).includes(Joi.number());

        Joi.validate(project_classes, schema, function(err, value) {
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
            user_id: Joi.number(),
            project_id: Joi.number(),
            role_id: Joi.number()
        };
        
        Joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);
            
            var user_id = mysql.escape(upr.user_id);
            var project_id = mysql.escape(upr.project_id);
            var role_id = mysql.escape(upr.role_id);
            
            var q = 'INSERT INTO user_project_role \n'+
                    'SET user_id = %s, role_id = %s, project_id = %s';
            
            q = util.format(q, user_id, role_id, project_id);
            queryHandler(q, callback);
        })

    },
    
    changeUserRole: function(userProjectRole, callback) {
        var schema = {
            user_id: Joi.number(),
            project_id: Joi.number(),
            role_id: Joi.number()
        };
            
        Joi.validate(userProjectRole, schema, function(err, upr){
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
    
    removeUser: function(user_id, project_id, callback){
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
                "WHERE name != 'Owner'";
                
        queryHandler(q, callback);
    }
};

module.exports = Projects;
