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
            state: Joi.string().required(),
            duration: Joi.number().required(),
        };
        
        Joi.validate(uploadData, schema, function(err, upload) {
            
            var q = "INSERT INTO uploads_processing \n"+
                    "SET ?";
                    
            q = mysql.format(q, {
                filename: upload.filename, 
                site_id: upload.site_id, 
                user_id: upload.user_id,
                project_id: upload.project_id, 
                state: upload.state,
                duration: upload.duration
            });
            queryHandler(q, callback);
        });
    },
    
    updateState: function(uploadId, newState, callback) {
        var q = "UPDATE uploads_processing \n"+
                "SET state = ? \n"+
                "WHERE upload_id = ?";
        q = mysql.format(q, [uploadId, newState]);
        queryHandler(q, callback);
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
