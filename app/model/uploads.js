const util = require('util');
const Joi = require('joi');
const dbpool = require('../utils/dbpool');
const q = require('q');
const queryHandler = dbpool.queryHandler;
const config = require('../config');
const rfcxConfig = config('rfcx');
const fileHelper = require('../utils/file-helper');
const request = require('request');
const { promisify } = require('util');
const rp = promisify(request);
const fs = require('fs');

// model for uploads processing status in status bar
module.exports = {
    insertRecToList: function(uploadData, callback) {
        var schema =  {
            filename: Joi.string().required(),
            project_id: Joi.number().required(),
            site_id: Joi.number().required(),
            user_id: Joi.number().required(),
            state: Joi.string().required(),
            datetime: Joi.date().required()
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
            });
            queryHandler(q, callback);
        });
    },

    getUploadingRecordings: function(options) {
        const q = `SELECT upload_id as id, upload_url as uploadUrl, state
        FROM uploads_processing
        WHERE project = ${options.projectId}
            AND state = 'waiting' AND upload_url is not null`
        return dbpool.query(q);
    },

    fetchRandomUploadItems: function(count){
        return q.denodeify(queryHandler)(
            "SELECT upload_id as id, project_id, site_id, user_id, upload_time, filename, state, datetime\n" +
            "FROM uploads_processing\n" +
            "WHERE state='waiting'\n" +
            "ORDER BY RAND()\n" +
            "LIMIT ?", [count | 0]
        ).get(0);
    },

    updateState: function(opts, callback) {
        const q = "UPDATE uploads_processing \n"+
                "SET state = ?, upload_url = ? \n"+
                "WHERE upload_id = ?";
        q = dbpool.format(q, [opts.status, opts.uploadUrl, opts.uploadId]);
        queryHandler(q, callback);
    },

    updateStateAndComment: function(uploadId, newState, remark, callback) {
        const q = "UPDATE uploads_processing \n"+
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

    uploadFile: async function(data, idToken, callback) {
        const { originalFilename, filePath, fileExt, streamId, timestamp } = data
        const uploadOptions = { originalFilename, filePath, streamId, timestamp }
        return this.requestUploadUrl(uploadOptions, idToken)
            .then(async (data) => {
                if (!data) {
                    callback('Failed to upload recording')
                    return;
                }
                const { url, uploadId } = data
                await this.performUpload(url, filePath, fileExt).then((data) => {
                    callback(undefined, uploadId)
                    return;
                })
        })
    },

    requestUploadUrl: async function(data, idToken) {
        const { originalFilename, filePath, streamId, timestamp } = data
        const errorMessage = 'Failed to upload recording'
        const sha1 = fileHelper.getCheckSum(filePath)
        const body = { filename: originalFilename, checksum: sha1, stream: streamId, timestamp: timestamp }
        const options = {
            method: 'POST',
            url: `${rfcxConfig.ingestBaseUrl}/uploads`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify(body)
        }
        return rp(options).then((response) => {
            try {
                const body = JSON.parse(response.body);
                if (body && body.error) {
                    console.error(errorMessage,  body.error)
                    throw new Error(errorMessage);
                }
                const url = body.url
                const uploadId = body.uploadId
                return { url, uploadId }
            } catch (e) {
                console.error(errorMessage, e)
                return undefined;
            }
        })
    },

    performUpload: async function(signedUrl, filePath, fileExt) {
        var headers = {
          'Content-Type': `audio/${fileExt}`
        }
        const fileSize = fileHelper.getFileSize(filePath)
        headers['Content-Length'] = fileSize
        const readStream = fs.createReadStream(filePath)
        const options = {
          method: 'PUT',
          headers: headers,
          body: readStream
        }
        return rp(signedUrl, options)
    },

    checkStatus: async function(uploadId, idToken, callback) {
        let status = 0
        while ([0, 10].includes(status)) {
            try {
                const options = {
                    method: 'GET',
                    url: `${rfcxConfig.ingestBaseUrl}/uploads/${uploadId}`,
                    headers: {
                        Authorization: `Bearer ${idToken}`
                    },
                    json: true
                }
                await rp(options).then((response)=> {
                    const data = response.body;
                    status = data.status
                })
            } catch (e) {
                callback('Failed to get a status')
            }
        }
        callback(undefined, status)
        return;
    },
};
