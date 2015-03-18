var util = require('util');
var mysql = require('mysql');
var Joi = require('joi');
var sprintf = require("sprintf-js").sprintf;
var dbpool       = require('../utils/dbpool');
// local variables
var queryHandler = dbpool.queryHandler;

// model for uploads processing status in status bar


module.exports = {
    insertRecToList: function(uploadData, callback) {
        var schema =  {
            filename: Joi.string().required(),
            project_id: Joi.number().required(),
            site_id: Joi.number().required(),
            user_id: Joi.string().required(),
        };
        
        Joi.validate(uploadData, schema, function(err, upload) {
            
            var q = "INSERT INTO uploads_processing \n"+
                    "SET filename = %(filename)s, \n"+
                    "site_id = %(site_id)s, \n"+
                    "user_id = %(user_id)s, \n"+
                    "project_id = %(project_id)s";
                    
            q = sprintf(q, {
                filename: mysql.escape(upload.filename),
                project_id: mysql.escape(upload.project_id),
                site_id: mysql.escape(upload.site_id),
                user_id: mysql.escape(upload.user_id),
            });
            queryHandler(q, callback);
        });
    },
    
    removeFromList: function(upload_id, callback) {
        if(typeof upload_id !== "number")
            return callback(new Error("invalid value for upload_id"));
        
        var q = "DELETE FROM uploads_processing \n"+
                "WHERE upload_id = %s";
                
        q = util.format(q, mysql.escape(upload_id));
        queryHandler(q, callback);
    },
};
