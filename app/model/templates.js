/* jshint node:true */
"use strict";

// native dependencies
var util = require('util');

// 3rd party dependencies
var debug = require('debug')('arbimon2:model:templates');
var async = require('async');
var jimp = require('jimp');
var AWS = require('aws-sdk');
var joi = require('joi');
var q = require('q');

// local dependencies
var config       = require('../config');
var tmpfilecache = require('../utils/tmpfilecache');
var dbpool       = require('../utils/dbpool');

var Recordings = require('./recordings');

// local variables
var s3;


// exports
var Templates = {
    /** Finds templates, given a (non-empty) query.
     * @param {Object} options
     * @param {Object} options.id      find templates with the given id.
     * @param {Object} options.project find templates associated to the given project id.
     * @param {Object} options.name    find templates with the given name (must also provide a project id);
     * @param {Function} callback called back with the queried results.
     */
    find: function (options) {
        options = options || {}
        var constraints = [];
        var tables = ['templates T'];
        var select = [
            "T.`template_id` as id",
            "T.`project_id` as project",
            "T.`recording_id` as recording",
            "T.`species_id` as species",
            "T.`songtype_id` as songtype",
            "T.`name`",
            "CONCAT('https://s3.amazonaws.com/', '"+config('aws').bucketName+"', '/', T.`uri`) as `uri`",
            "T.`x1`", "T.`y1`", "T.`x2`", "T.`y2`",
            "T.`date_created`"
        ];

        if (options.id) {
            constraints.push('T.`template_id` = ' + dbpool.escape(options.id));
        } else if (options.idIn) {
            constraints.push('T.`template_id` IN (' + dbpool.escape(options.idIn) + ')');
        }

        if (options.project) {
            constraints.push('T.`project_id` = ' + dbpool.escape(options.project));
        }

        if (options.name) {
            constraints.push('T.`name` = ' + dbpool.escape(options.name));
        }

        if(options.showSpecies){
            tables.push('JOIN species Sp ON T.species_id = Sp.species_id');
            tables.push('JOIN songtypes St ON T.songtype_id = St.songtype_id');
            select.push('Sp.scientific_name as species_name', 'St.songtype as songtype_name');
        }

        if(constraints.length === 0){
            return q.reject(new Error("Templates.find called with invalid query.")).nodeify(callback);
        }

        return dbpool.query(
            "SELECT " + select.join(",\n") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join("\nAND ")
        );
    },

    findOne: function(query){
        return find(query).then(data => data[0]);
    },

    SCHEMA: joi.object().keys({
        name: joi.string(),
        project: joi.number().integer(), recording: joi.number().integer(),
        species: joi.number().integer(), songtype: joi.number().integer(),
        x1: joi.number(), y1: joi.number(), x2: joi.number(), y2: joi.number(),
    }),

    /** Finds templates, given a (non-empty) query.
     * @param {Object} data
     * @param {String} data.name   name given to this template.
     * @param {Integer} data.project id of the project associated to this template.
     * @param {Integer} data.recording id of the recording associated to this template.
     * @param {Integer} data.species id of the species associated to this template.
     * @param {Integer} data.songtype id of the songtype associated to this template.
     * @param {String} data.name name associated to this template.
     * @param {double} data.x1 x1 associated to this template.
     * @param {double} data.y1 y1 associated to this template.
     * @param {double} data.x2 x2 associated to this template.
     * @param {double} data.y2 y2 associated to this template.
     * @param {Function} callback called back with the newly inserted template, or with errors.
     * @return {Promise} resolved after inserting the template
     */
    insert: function (data, callback) {
        var x1 = Math.min(data.x1, data.x2), y1 = Math.min(data.y1, data.y2);
        var x2 = Math.max(data.x1, data.x2), y2 = Math.max(data.y1, data.y2);
        console.log('data', data);
        return q.ninvoke(joi, 'validate', data, this.SCHEMA).then(
            () => dbpool.query(
                "INSERT INTO templates (\n" +
                "    `name`, `uri`,\n" +
                "    `project_id`, `recording_id`,\n" +
                "    `species_id`, `songtype_id`,\n" +
                "    `x1`, `y1`, `x2`, `y2`,\n" +
                "    `date_created`\n" +
                ") VALUES (\n" +
                "    ?, ?,\n" +
                "    ?, ?, ?, ?,\n" +
                "    ?, ?, ?, ?,\n" +
                "    NOW()\n" +
                ")", [
                    data.name, null,
                    data.project, data.recording, data.species, data.songtype,
                    data.x1, data.y1, data.x2, data.y2,
                ]
            ).then(result => data.id = result.insertId)
        ).then(
            () => this.createTemplateImage(data)
        ).nodeify(callback);
    },

    /** Fetches the image of a template.
     *  @param {Object}  templateId id of the template
     */
    fetchDataImage: function(templateId, callback){
        return this.find({id:templateId}).then(rows => {
            return rows[0];
        }).then(data => {
            if(!rows.length) {
                next(new Error("Requested template data does not exists."));
                return;
            }
            if(!data.uri){
                self.createTemplateImage(template, data, next);
            } else {
                next(null, data);
            }
        });
    },

    /** Creates a roi image
     * @param {Object} template - template, as returned by findOne
     */
    createTemplateImage : function (template){
        var s3key = 'project_'+template.project+'/templates/'+template.id+'.png';
        template.uri = 'https://s3.amazonaws.com/'+config('aws').bucketName+'/' + s3key;
        var roi_file = tmpfilecache.key2File(s3key);
        var rec_data;
        var rec_stats;
        var spec_data;

        return Recordings.findByUrlMatch(template.recording, 0, {limit:1})
        .then(data => rec_data = data[0])
        .then(rec_data => Promise.all([
            q.ninvoke(Recordings, 'fetchInfo', rec_data).then(data => rec_stats = data),
            q.ninvoke(Recordings, 'fetchSpectrogramFile', rec_data).then(data => spec_data = data),
        ])).then(
            () => jimp.read(spec_data.path)
        ).then((spectrogram) => {
            debug('crop_roi');
            var px2sec = rec_data.duration/spectrogram.bitmap.width;
            var max_freq = rec_data.sample_rate/2;
            var px2hz  = max_freq/spectrogram.bitmap.height;

            var left = Math.floor(template.x1/px2sec);
            var top = spectrogram.bitmap.height-Math.floor(template.y2/px2hz);
            var right = Math.ceil(template.x2/px2sec);
            var bottom = spectrogram.bitmap.height-Math.floor(template.y1/px2hz);

            var roi = spectrogram.clone().crop(left, top, right - left, bottom - top);
            return roi.getBufferAsync(jimp.MIME_PNG);
        }).then((roiBuffer) => {
            debug('store_in_bucket' + JSON.stringify({
                Bucket: config('aws').bucketName,
                Key: s3key,
                ACL: 'public-read',
            }));
            if(!s3){
                s3 = new AWS.S3();
            }
            return s3.putObject({
                Bucket: config('aws').bucketName,
                Key: s3key,
                ACL: 'public-read',
                Body: roiBuffer
            }).promise();
        }).then(() => {
            debug('update_roi_data');
            return dbpool.query(dbpool.format(
                "UPDATE templates \n"+
                "SET uri = ? \n"+
                "WHERE template_id = ?", [
                s3key, template.id
            ]));
        }).then(() => {
            debug('return_updated_roi');
            return template;
        });
    },

};

module.exports = Templates;
