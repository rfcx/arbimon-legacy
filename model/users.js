var util = require('util');
var mysql = require('mysql');
var Joi = require('joi');
var sprintf = require("sprintf-js").sprintf;

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;


var Users = {
    findByUsername: function(username, callback) {
        var q = 'SELECT * \n' +
                'FROM users \n' +
                'WHERE login = %s';
        q = util.format(q, mysql.escape(username));
        queryHandler(q, callback);
    },
    
    findByEmail: function(email, callback) {
        var q = 'SELECT * \n' +
                'FROM users \n' +
                'WHERE email = %s';
        q = util.format(q, mysql.escape(email));
        queryHandler(q, callback);
    },
    
    findById: function(user_id, callback) {
        var q = 'SELECT * \n' +
                'FROM users \n' +
                'WHERE user_id = %s';
        q = util.format(q, mysql.escape(user_id));
        queryHandler(q, callback);
    },
    
    loginTry: function(ip, user, msg, callback) {
        
        var q = 'INSERT INTO invalid_logins(`ip`, `user`, `reason`) \n'+
                'VALUES ('+
                mysql.escape(ip) +',' + 
                mysql.escape(user) + ',' + 
                mysql.escape(msg) + ')';
                
        queryHandler(q, callback);
    },
    
    invalidLogins: function(ip, callback) {
        var q = 'SELECT COUNT(ip) as tries \n'+
                'FROM invalid_logins \n'+
                'WHERE ip = %s \n'+
                'AND `time` BETWEEN (NOW() - interval 1 hour) and NOW()';
        q = util.format(q, mysql.escape(ip));
        queryHandler(q, callback);
    },
    
    removeLoginTries: function(ip, callback) {
        var q = 'DELETE ' +
                'FROM `invalid_logins` ' +
                'WHERE ip = %s';
        q = util.format(q, mysql.escape(ip));
        queryHandler(q, callback);
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
            if(i !== 'user_id' && typeof userData[i] !== 'undefined') {
                values.push(util.format('%s = %s', 
                    mysql.escapeId(i), 
                    mysql.escape(userData[i])
                ));
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

        for(i in userData) {
            if(i !== 'user_id') {
                values.push(util.format('%s = %s', 
                    mysql.escapeId(i), 
                    mysql.escape(userData[i])
                ));
            }
        }

        var q = 'INSERT INTO users \n'+
                'SET %s';

        q = util.format(q, values.join(", "));
        queryHandler(q, callback);
    },

    projectList: function(user_id, callback) {
        var q = "SELECT p.project_id AS id, name, url, description, is_private, is_enabled \n"+
                "FROM projects as p \n"+
                "LEFT JOIN user_project_role as upr on (p.project_id = upr.project_id) \n"+
                "WHERE p.is_private = 0 \n"+
                "OR upr.user_id = %s \n"+
                "GROUP BY p.project_id";

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
    },
    
    ownedProjectsQty: function(user_id, callback) {
        var q = "SELECT COUNT(p.project_id) as count \n"+
                "FROM projects as p \n"+
                "WHERE p.owner_id = %s";
        
        q = util.format(q, mysql.escape(user_id));
        queryHandler(q, callback);
    },
    
    newAccountRequest: function(params, hash, callback){
        var q = 'INSERT INTO user_account_support_request'+
                '(support_type_id, hash, params, expires) \n'+
                'VALUES (1,' + 
                mysql.escape(hash) + ','+ 
                mysql.escape(JSON.stringify(params))+ ','+
                '(\n'+
                '    SELECT FROM_UNIXTIME( \n'+
                '        UNIX_TIMESTAMP(now()) +\n' +
                '        (SELECT max_lifetime \n'+
                '         FROM user_account_support_type\n' + 
                '         WHERE account_support_type_id = 1)\n'+
                '    ) as expiresin \n'+
                '))';

        queryHandler(q, callback);
    },
    
    newPasswordResetRequest: function(user_id, hash, callback) {
        var q = 'INSERT INTO user_account_support_request'+
                '(support_type_id, user_id, hash, expires) \n'+
                'VALUES (2,' + 
                mysql.escape(user_id) + ','+
                mysql.escape(hash) + ','+
                '(\n'+
                '    SELECT FROM_UNIXTIME( \n'+
                '        UNIX_TIMESTAMP(now()) +\n' +
                '        (SELECT max_lifetime \n'+
                '         FROM user_account_support_type\n' + 
                '         WHERE account_support_type_id = 2)\n'+
                '    ) as expiresin \n'+
                '))';

        queryHandler(q, callback);
    },
    
    removeRequest : function(id, callback) {
        var q = 'DELETE FROM user_account_support_request \n'+ 
                'WHERE support_request_id = '+ mysql.escape(id);
        
        queryHandler(q, callback);
    },
    
    findAccountSupportReq: function(hash, callback) {
        var q = 'SELECT * \n'+
                'FROM user_account_support_request \n'+
                'WHERE hash = ' + mysql.escape(hash);
        
        queryHandler(q, callback);
    },
    
    usernameInUse: function(username, callback) {
        var q = "SELECT (SELECT count(*) as count \n"+
            "FROM user_account_support_request \n"+
            "WHERE params LIKE %1$s) \n+\n"+
            "(SELECT count(*) as count \n"+
            "FROM users AS u \n"+
            "WHERE login = %2$s) as count";
        
        q = sprintf(q, mysql.escape('%"'+username+'"%'), mysql.escape(username));
        queryHandler(q, function(err, rows){
            if(err) return callback(err);
            
            callback(null, rows[0].count > 0);
        });
    },
    
    emailInUse: function(username, callback) {
        var q = "SELECT (SELECT count(*) as count \n"+
            "FROM user_account_support_request \n"+
            "WHERE params LIKE %1$s) \n+\n"+
            "(SELECT count(*) as count \n"+
            "FROM users AS u \n"+
            "WHERE email = %2$s) as count";
        
        q = sprintf(q, mysql.escape('%"'+username+'"%'), mysql.escape(username));
        queryHandler(q, function(err, rows){
            if(err) return callback(err);
            
            callback(null, rows[0].count > 0);
        });
    },
    
    list: function(callback) {
        var q = 'SELECT user_id AS id, \n' +
                'login AS username, \n' +
                'firstname, \n' +
                'lastname, \n' +
                'email, \n' +
                'last_login, \n' +
                'is_super, \n' +
                'project_limit, \n' +
                'created_on, \n' +
                'disabled_until \n' +
                'FROM users';
        
        queryHandler(q, callback);
    },
    
    countCreatedToday: function(callback) {
        var q = 'SELECT count(*) AS count \n'+
                'FROM `users` \n'+
                'WHERE DATE(created_on) = DATE(NOW())';
        
        queryHandler(q, callback);
    },
};

module.exports = Users;
