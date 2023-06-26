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
const SongMeterFileInfo = require('../utils/song-meter-file-info');

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
        const q = `SELECT upload_id as id, upload_url as uploadUrl, state, filename as name
        FROM uploads_processing
        WHERE project_id = ${options.project} AND site_id = ${options.site}
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
        let q = "UPDATE uploads_processing \n"+
                "SET state = ?, upload_url = ? \n"+
                "WHERE upload_id = ?";
        q = dbpool.format(q, [opts.status, opts.uploadUrl, opts.uploadId]);
        queryHandler(q, callback);
    },

    updateStateAsync: function(opts) {
        let updateState = util.promisify(this.updateState)
        return updateState(opts)
    },

    updateStateAndComment: function(uploadId, newState, remark, callback) {
        let q = "UPDATE uploads_processing \n"+
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

    extractSongMeterFileInfo: async function(file) {
        if (file.extension !== 'wav') return new SongMeterFileInfo('')
        try {
          const metadata = await fileHelper.readGuanMetadata(file.path)
          return new SongMeterFileInfo(metadata || '')
        } catch (e) {
          console.error('Read file info error', e)
          return new SongMeterFileInfo('')
        }
    },

    uploadFile: async function(data, idToken, callback) {
        const { originalFilename, filePath, fileExt, streamId, timestamp } = data
        let uploadFilePath = filePath
        let uploadFileExt = fileExt
        if (fileExt === 'wav') {
            try {
                const songMeterFileInfo = await this.extractSongMeterFileInfo({path: filePath, extension: fileExt})
                const metadata = songMeterFileInfo.metadata ? {comment: songMeterFileInfo.formattedMetadata, artist: songMeterFileInfo.model} : null
                const uploadFile = await fileHelper.convert(filePath, metadata)
                uploadFilePath = uploadFile.path
                uploadFileExt = 'flac'
            } catch (error) {
                console.error('error', error)
            }
        }
        const uploadOptions = { originalFilename, uploadFilePath, streamId, timestamp }
        return this.requestUploadUrl(uploadOptions, idToken)
            .then(async (data) => {
                if (!data) {
                    callback('Failed to upload recording')
                    return;
                }
                const { url, uploadId } = data
                this.performUpload(url, uploadFilePath, fileExt).then((data) => {
                    console.info('Perform upload status', data.statusCode)
                })
                callback(undefined, uploadId)
                return;
        })
    },

    requestUploadUrl: async function(data, idToken) {
        const { originalFilename, uploadFilePath, streamId, timestamp } = data
        const errorMessage = 'Failed to upload recording'
        const sha1 = fileHelper.getCheckSum(uploadFilePath)
        console.log('\n\n-------sha1------', sha1)
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

    checkStatus: async function(uploadId, idToken) {
        let status = 0
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
            throw new Error('Failed to get a status');
        }
        return status
    },
};
