var Users     = require('../../models/users');
var Projects  = require('../../models/projects');
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
            firstname : {
                type: 'string',                 // Specify the type of input to expect.
                required: true                        // If true, value entered must be         
            },
            lastname  : {
                type: 'string',                 // Specify the type of input to expect.
                required: true                        // If true, value entered must be         
            },
            email     : {
                type: 'string',                 // Specify the type of input to expect.
                required: true                        // If true, value entered must be         
            },
            is_super  : {
                type : 'boolean',
                default : false,
                required: true
            }
        }}, next);
    },
    function get_user_data(data, next){
        data.password = sha256(data.password);
        user_data = data;
        user = user_data.login;
        next();
    },
    function insert_user(next){
        Users.insert(user_data, next);
    }, 
    function get_new_user_id(res){
        var next = arguments[arguments.length-1];
        next();
    },
], function(err, result){
    if(err){
        console.log("User addition failed : ", err);
    } else {
        console.log("User ", user, "added.");
    }
    process.exit(1);
})
