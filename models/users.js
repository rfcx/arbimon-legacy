var util = require('util');
var validator = require('validator');

module.exports = function(queryHandler) {
    return {
        findByUsername: function(username, callback) {
            var q = 'SELECT * ' +
                    'FROM users ' + 
                    'WHERE login="%s"';
            q = util.format(q, validator.escape(username))
            queryHandler(q, callback)
        },
        
        findById: function(user_id, callback) {
            var q = 'SELECT * ' +
                    'FROM users ' + 
                    'WHERE user_id="%s"';
            q = util.format(q, validator.escape(user_id))
            queryHandler(q, callback)
        },
        
        update: function(userData, callback) {
            if(typeof userData.id === 'undefined') {
                callback(new Error("userData does not contain an id"));
                return;
            }
            
            var values = [];
            
            // process values to be updated
            for( var i in userData) {
                if(i !== 'id') {
                    userData[i] = validator.escape(userData[i]);
                    
                    if(typeof userData[i] === 'string') {
                        userData[i] = util.format('"%s"', userData[i]);
                    } 
                    values.push(util.format('`%s`=%s', i, userData[i]));
                }
            }
            
            var q = 'UPDATE users \n'+
                    'SET %s \n'+
                    'WHERE user_id=%s';
            
            q = util.format(q, values.join(", "), userData.id);
            
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
                if(i !== 'id') {
                    userData[i] = validator.escape(userData[i]);
                    
                    if(typeof userData[i] === 'string') {
                        userData[i] = util.format('"%s"', userData[i]);
                    } 
                    values.push(util.format('`%s`=%s', i, userData[i]));
                }
            }
            
            var q = 'INSERT INTO users \n'+
                    'SET %s';
                    
            q = util.format(q, values.join(", "));
            
            queryHandler(q, callback)
        }
    };
}
