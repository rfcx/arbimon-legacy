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
    find: function (options, callback) {
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
            "T.`date_created`",
            "T.user_id"
        ];

        if (options.id) {
            constraints.push('T.`template_id` = ' + dbpool.escape(options.id));
        } else if (options.idIn) {
            if(!options.idIn.length){
                constraints.push('1 = 0');
            } else {
                constraints.push('T.`template_id` IN (' + dbpool.escape(options.idIn) + ')');
            }
        }

        if (options.deleted !== undefined) {
            constraints.push('T.`deleted` = ' + dbpool.escape(options.deleted));
        }

        if (options.project) {
            constraints.push('T.`project_id` = ' + dbpool.escape(options.project));
        }

        if (options.name) {
            constraints.push('T.`name` = ' + dbpool.escape(options.name));
        }

        if (options.showSpecies){
            tables.push('JOIN species Sp ON T.species_id = Sp.species_id');
            tables.push('JOIN songtypes St ON T.songtype_id = St.songtype_id');
            select.push('Sp.scientific_name as species_name', 'St.songtype as songtype_name');
        }

        if (options.showRecordingUri){
            tables.push('JOIN recordings R ON T.recording_id = R.recording_id');
            select.push('R.uri as recUri, R.site_id as recSiteId, R.sample_rate');
        }

        if (options.showOwner || options.allAccessibleProjects) {
            select.push(
                "IF (T.user_id IS NULL, CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))), CONCAT(CONCAT(UCASE(LEFT( U3.`firstname` , 1)), SUBSTRING( U3.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U3.`lastname` , 1)), SUBSTRING( U3.`lastname` , 2)))) AS author",
                "P.`name` as `project_name`",
            );
            tables.push('JOIN projects P ON T.project_id = P.project_id');
            // get an author of a template if the column T.user_id is not null.
            tables.push('LEFT JOIN users U3 ON T.user_id = U3.user_id AND T.user_id IS NOT NULL');
            // get an owner of a project as uthor of the template if the column T.user_id is null.
            tables.push('LEFT JOIN user_project_role UPR ON T.project_id = UPR.project_id AND UPR.role_id = 4 AND T.user_id IS NULL');
            tables.push('LEFT JOIN users U ON UPR.user_id = U.user_id AND T.user_id IS NULL');
        }

        if (options.allAccessibleProjects) {
            // find the first template by date created for all public projects grouped by name.
            tables.push(
                'INNER JOIN (SELECT name, MIN(date_created) as mindate FROM templates WHERE deleted=0 GROUP BY name) T3 ON T.name = T3.name AND T.date_created = T3.mindate'
            );
            constraints.push('P.is_private = 0');
        }

        if (options.showOwner) {
            // find the original template.
            select.push(
                "T.`source_project_id` as `source_project_id`, P2.`name` as `source_project_name`",
                "IF (T.user_id IS NULL, CONCAT(CONCAT(UCASE(LEFT( U2.`firstname` , 1)), SUBSTRING( U2.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U2.`lastname` , 1)), SUBSTRING( U2.`lastname` , 2))), CONCAT(CONCAT(UCASE(LEFT( U3.`firstname` , 1)), SUBSTRING( U3.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U3.`lastname` , 1)), SUBSTRING( U3.`lastname` , 2)))) AS author",
            );
            tables.push('LEFT JOIN projects P2 ON T.source_project_id = P2.project_id');
            tables.push('LEFT JOIN user_project_role UPR2 ON T.source_project_id = UPR2.project_id AND UPR2.role_id = 4');
            tables.push('LEFT JOIN users U2 ON UPR2.user_id = U2.user_id');
        }

        if (options.firstByDateCreated) {
            // find the first template by date created grouped by name and project.
            tables.push(
                'INNER JOIN (SELECT project_id, recording_id, name, MIN(date_created) as mindate FROM templates WHERE deleted=0 GROUP BY name, project_id) T2 ON T.project_id = T2.project_id AND T.recording_id = T2.recording_id AND T.name = T2.name AND T.date_created = T2.mindate'
            );
        }

        if (constraints.length === 0){
            return q.reject(new Error("Templates.find called with invalid query.")).nodeify(callback);
        }
        return dbpool.query(
            "SELECT " + select.join(",\n") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join("\nAND ") + "\n" +
            "ORDER BY date_created DESC"
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
        source_project_id: joi.number(), user_id: joi.number()
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
        var query =
        "INSERT INTO templates (\n" +
        "    `name`, `uri`,\n" +
        "    `project_id`, `recording_id`,\n" +
        "    `species_id`, `songtype_id`,\n" +
        "    `x1`, `y1`, `x2`, `y2`,\n" +
        "    `date_created`, `source_project_id`, `user_id`\n" +
        ") SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ? FROM DUAL\n" +
        "WHERE NOT EXISTS (SELECT * FROM `templates`\n" +
        "WHERE `name`=? AND `project_id`=? AND `recording_id`=? AND `species_id`=? AND `deleted`=0 LIMIT 1)";

        return q.ninvoke(joi, 'validate', data, this.SCHEMA).then(
            () => dbpool.query(
                    query, [
                    data.name, null,
                    data.project, data.recording, data.species, data.songtype,
                    data.x1, data.y1, data.x2, data.y2, data.source_project_id? data.source_project_id : null, data.user_id,
                    data.name,  data.project, data.recording, data.species
                ]
            ).then(result => {
                data.id = result.insertId
            })
        ).then(
            () => this.createTemplateImage(data)
        ).nodeify(callback);
    },

    /** Finds templates, given a (non-empty) query.
     * @param {int} templateId
     * @return {Promise} resolved after inserting the template
     */
    delete: function (templateId) {
        return dbpool.query(
            "UPDATE templates SET deleted=1 WHERE template_id = ?", [templateId]
        );
    },

    /** Fetches the image of a template.
     *  @param {Object}  templateId id of the template
     */
    fetchDataImage: function(templateId, callback){
        return this.find({id:templateId}).then(rows => {
            return rows[0];
        }).then(data => {
            if(!rows.length) {
                throw new Error("Requested template data does not exists.");
            }
            if(!data.uri){
                self.createTemplateImage(template, data, next);
            } else {
                return data;
            }
        });
    },

    getAudioFile: function(templateId, options){
        options = options || {};
        return this.find({
            id: templateId,
            showRecordingUri: true
        }).get(0).then(template => {
            if(!template) {
                next(new Error("Requested template data does not exists."));
                return;
            }

            return q.ninvoke(Recordings, 'fetchAudioFile', {
                uri: template.recUri,
                site_id: template.recSiteId
            }, {
                maxFreq: Math.max(template.y1, template.y2),
                minFreq: Math.min(template.y1, template.y2),
                gain: options.gain,
                trim: {
                    from: Math.min(template.x1, template.x2),
                    to: Math.max(template.x1, template.x2)
                },
            });
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
