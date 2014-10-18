var util = require('util');
var mysql = require('mysql');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var Users = {
    findByUsername: function(username, callback) {
        var q = 'SELECT * ' +
                'FROM users ' +
                'WHERE login=%s';
        q = util.format(q, mysql.escape(username))
        queryHandler(q, callback)
    },

    findById: function(user_id, callback) {
        var q = 'SELECT * ' +
                'FROM users ' +
                'WHERE user_id=%s';
        q = util.format(q, mysql.escape(user_id))
        queryHandler(q, callback)
    },
    
    search: function(query, callback) {
        query = mysql.escape('%'+query+'%');
        
        var q = "SELECT user_id AS id, \n"+
                "       email, \n"+
                "       login AS username \n"+
                "FROM users \n"+
                "WHERE login LIKE %s \n"+
                "OR email LIKE %s";
        
        q = util.format(q, query, query);
        queryHandler(q, callback);
    },

    update: function(userData, callback) {
        if(typeof userData.user_id === 'undefined') {
            callback(new Error("userData does not contain an user_id"));
            return;
        }

        var values = [];

        // process values to be updated
        for( var i in userData) {
            if(i !== 'user_id') {
                userData[i] = mysql.escape(userData[i]);

                values.push(util.format('`%s`=%s', i, userData[i]));
            }
        }

        var q = 'UPDATE users \n'+
                'SET %s \n'+
                'WHERE user_id=%s';

        q = util.format(q, values.join(", "), mysql.escape(userData.user_id));

        queryHandler(q, callback);
    },

    insert: function(userData, callback) {
        var values = [];

        var requiredValues = [
            "login",
            "password",
            "firstname",
            "lastname",
            "email"
        ];

        for(var i in requiredValues) {
            if(typeof userData[requiredValues[i]] === "undefined")
                return callback(new Error("required field '"+ requiredValues[i] + "' missing"));
        }

        for( var i in userData) {
            if(i !== 'user_id') {
                userData[i] = mysql.escape(userData[i]);

                values.push(util.format('`%s`=%s', i, userData[i]));
            }
        }

        var q = 'INSERT INTO users \n'+
                'SET %s';

        q = util.format(q, values.join(", "));
        queryHandler(q, callback);
    },

    projectList: function(user_id, callback) {
        var q = "SELECT name, url, description, is_private, is_enabled "+
                "FROM projects as p "+
                "LEFT JOIN user_project_role as upr on (p.project_id = upr.project_id) "+
                "WHERE p.is_private = 0 "+
                "OR upr.user_id = %s";

        q = util.format(q, mysql.escape(user_id));
        queryHandler(q, callback);
    },

    getPermissions : function(user_id, project_id, callback) {
        var q = 'SELECT p.permission_id AS id, p.name \n'+
                'FROM user_project_role AS upr \n'+
                'JOIN roles AS r ON upr.role_id = r.role_id \n'+
                'JOIN role_permissions AS rp ON rp.role_id = upr.role_id \n'+
                'JOIN permissions AS p ON p.permission_id = rp.permission_id \n'+
                'WHERE upr.user_id = %s \n'+
                'AND upr.project_id = %s';

        q = util.format(q, mysql.escape(user_id), mysql.escape(project_id));
        queryHandler(q, callback);
    }
};

module.exports = Users;
