var util = require('util');
var mysql = require('mysql');
var Joi = require('joi');
var sprintf = require("sprintf-js").sprintf;
var dbpool       = require('../utils/dbpool');
var q= require('q');
// local variables
var queryHandler = dbpool.queryHandler;

// model for uploads processing status in status bar


module.exports = {
    insertRecToList: function(uploadData, callback) {
        var schema =  {
            filename: Joi.string().required(),
            project_id: Joi.number().required(),
            site_id: Joi.number().required(),
            user_id: Joi.number().required(),
            state: Joi.string().required(),
            duration: Joi.number().required(),
            metadata: Joi.object().required().keys({
                recorder: Joi.string().required(),
                mic: Joi.string().required(),
                sver: Joi.string().required()
            }),
            datetime: Joi.date().required(),
            channels: Joi.number().required()
        };
        Joi.validate(uploadData, schema, function(err, upload) {
            if(err){
                callback(err);
                return;
            }
            var q = "INSERT INTO uploads_processing \n"+
                    "SET ?";
                    
            q = mysql.format(q, {
                filename: upload.filename, 
                site_id: upload.site_id, 
                user_id: upload.user_id,
                project_id: upload.project_id, 
                state: upload.state,
                datetime: upload.datetime,
                recorder: upload.metadata.recorder,
                mic: upload.metadata.mic,
                software: upload.metadata.sver,
                duration: upload.duration
            });
            queryHandler(q, callback);
        });
    },
    
    getUploadsList: function(){
        return q.denodeify(queryHandler)(
            "SELECT upload_id as id, project_id, site_id, user_id, upload_time, filename, state, duration, datetime, recorder, mic, software\n" +
            "FROM uploads_processing"
        ).get(0);
    },
    
    fetchRandomUploadItems: function(count){
        return q.denodeify(queryHandler)(
            "SELECT upload_id as id, project_id, site_id, user_id, upload_time, filename, state, duration, datetime, recorder, mic, software\n" +
            "FROM uploads_processing\n" +
            "ORDER BY RAND()\n" +
            "WHERE state='waiting'\n" + 
            "LIMIT ?", [count | 0]
        ).get(0);
    },
    
    updateState: function(uploadId, newState, callback) {
        var q = "UPDATE uploads_processing \n"+
                "SET state = ? \n"+
                "WHERE upload_id = ?";
        q = mysql.format(q, [uploadId, newState]);
        queryHandler(q, callback);
    },
    
    updateStateAndComment: function(uploadId, newState, remark, callback) {
        var q = "UPDATE uploads_processing \n"+
                "SET state = ?, remark = ? \n"+
                "WHERE upload_id = ?";
        q = mysql.format(q, [uploadId, remark, newState]);
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
