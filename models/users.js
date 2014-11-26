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
    findByEmail: function(email, callback) {
        var q = 'SELECT * ' +
                'FROM users ' +
                'WHERE email=%s';
        q = util.format(q, mysql.escape(email))
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
            if(i !== 'user_id' && typeof userData[i] !== 'undefined') {
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
    }
    ,
    newAccountRequest : function(data,hash,callback)
    {
        var q = 'INSERT INTO `user_account_support_request` ' +
                ' ( `support_type_id`, `hash`, `params`, `consumed`,  ' +
                ' `timestamp`, `expires`) VALUES (1,\''+hash+'\',\''+JSON.stringify(data)+'\',0, ' +
                ' now(),(SELECT FROM_UNIXTIME( UNIX_TIMESTAMP( now( ) ) ' +
                ' + (SELECT `max_lifetime` FROM `user_account_support_type` ' + 
                ' WHERE `account_support_type_id` = 1) ) as expiresin)) ';

        queryHandler(q, callback);
    }
    ,
    accountSupportExistsByEmail : function(email,callback)
    {
        var q = 'SELECT * FROM `user_account_support_request` WHERE `params` like \'%'+email+'%\''
        
        queryHandler(q, callback);
    }
    ,removeRequest : function(id,callback)
    {
        var q = 'delete FROM `user_account_support_request` WHERE `support_request_id` = \''+id+'\''
        
        queryHandler(q, callback);
    }
    ,
    accountRequestExists : function(hash,callback)
    {
        var q = 'SELECT * FROM `user_account_support_request` WHERE `hash` = \''+hash+'\''
        
        queryHandler(q, callback); 
    }
    ,
    newUser : function(data,callback)
    {
        data = JSON.parse(data)
        var q= "INSERT INTO `users`( `login`, `password`, `firstname`, `lastname`, `email`, `is_super`) "+
                " VALUES ('"+data.username+"','"+data.password+"','"+data.first_name+"','"+data.last_name+"','"+data.email+"',0)"
        
        queryHandler(q, callback); 
    }
};

module.exports = Users;
