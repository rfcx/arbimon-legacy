var util = require('util');
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
            datetime_local: Joi.date(),
            channels: Joi.number().required()
        };
        Joi.validate(uploadData, schema, function(err, upload) {
            if(err){
                callback(err);
                return;
            }
            var q = "INSERT INTO uploads_processing \n"+
                    "SET ?";

            q = dbpool.format(q, {
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

    getUploadsList: function(options){
        options = options || {};
        var select = ['UP.upload_id as id, UP.project_id, UP.site_id, UP.user_id, UP.upload_time, UP.filename, UP.state, UP.duration, UP.datetime, UP.recorder, UP.mic, UP.software'];
        var from = ['uploads_processing UP'];
        var where=[], data=[], limit='';
        if(options.project){
            where.push('UP.project_id = ?');
            data.push(options.project);
        }
        if(options.refs){
            select.push('S.name as site');
            from.push('JOIN sites S ON S.site_id = UP.site_id');
            select.push('U.login as username');
            from.push('JOIN users U ON U.user_id = UP.user_id');
        }

        if(options.count){
            options.count = false;
            return q.all([
                this.getUploadsList(options),
                q.nfcall(queryHandler,
                    "SELECT COUNT(*) as count\n" +
                    "FROM uploads_processing UP" +
                    (where.length ? '\nWHERE (' + where.join(') AND (') + ')' : ''),
                    data
                ).get(0).get(0).get('count')
            ]).then(function(all){
                return {list:all[0], count:all[1]};
            });
        }

        if(options.limit){
            limit = "\nLIMIT ?";
            data.push(Math.max(options.limit|0, 0));
            if(options.offset){
                limit += " OFFSET ?";
                data.push(options.offset|0);
            }
        }

        return q.denodeify(queryHandler)(
            "SELECT " + select.join(', ') + "\n" +
            "FROM " + from.join("\n") +
            (where.length ? '\nWHERE (' + where.join(') AND (') + ')' : '') +
            limit, data
        ).get(0);
    },

    fetchRandomUploadItems: function(count){
        return q.denodeify(queryHandler)(
            "SELECT upload_id as id, project_id, site_id, user_id, upload_time, filename, state, duration, datetime, recorder, mic, software\n" +
            "FROM uploads_processing\n" +
            "WHERE state='waiting'\n" +
            "ORDER BY RAND()\n" +
            "LIMIT ?", [count | 0]
        ).get(0);
    },

    updateState: function(uploadId, newState, callback) {
        var q = "UPDATE uploads_processing \n"+
                "SET state = ? \n"+
                "WHERE upload_id = ?";
        q = dbpool.format(q, [newState, uploadId]);
        queryHandler(q, callback);
    },

    updateStateAndComment: function(uploadId, newState, remark, callback) {
        var q = "UPDATE uploads_processing \n"+
                "SET state = ?, remark = ? \n"+
                "WHERE upload_id = ?";
        q = dbpool.format(q, [newState, remark, uploadId]);
        queryHandler(q, callback);
    },

    removeFromList: function(upload_id, callback) {
        if(typeof upload_id !== "number")
            return callback(new Error("invalid value for upload_id"));

        var q = "DELETE FROM uploads_processing \n"+
                "WHERE upload_id = %s";

        q = util.format(q, dbpool.escape(upload_id));
        queryHandler(q, callback);
    },
};
