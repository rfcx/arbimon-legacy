var Users     = require('../../model/users');
var Projects  = require('../../model/projects');
var sha256    = require('../../utils/sha256');
var async     = require('async');
var prompt    = require('prompt');

var user, user_data;

async.waterfall([
    function ask_user_data(next){
        prompt.start();
         prompt.get({properties:{
            login     : {
                type: 'string',
                required: true                        // If true, value entered must be         
            },
            password  : {
                type: 'string',                 // Specify the type of input to expect.
                hidden: true,                        // If true, characters entered will not be output to console.
                required: true                        // If true, value entered must be         
            },
            retype_password  : {
                type: 'string',                 // Specify the type of input to expect.
                hidden: true,                        // If true, characters entered will not be output to console.
                required: true                        // If true, value entered must be         
            }
        }}, next);
    },
    function get_user_data(data, next){
        if(data.password != data.retype_password){
            next(new Error("typed passwords do not match."));
        } else {            
            data.password = sha256(data.password);
            user_data = data;
            user = user_data.login;
            next();
        }
    },
    function fetch_user_id_by_login(next){
        Users.findByUsername(user, next);
    },
    function get_user_id(data){
        var next = arguments[arguments.length-1];
        if(!data){
            next(new Error("Cannot find user '"+user_data.login+"'."));
        } else {
            user_data.id = data[0].user_id;
            next();
        }
    },
    function update_user_pwd(next){        
        Users.update({
            user_id : user_data.id,
            password : user_data.password
        }, next);
    }, 
], function(err, result){
    if(err){
        console.log("User password change failed : ", err);
    } else {
        console.log("User ", user, " (id:"+user_data.id+")'s password was successfully changed.");
    }
    process.exit(1);
})
