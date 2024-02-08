/* jshint node:true */
"use strict";

const debug = require('debug')('arbimon2:model:templates');
const jimp = require('jimp');
const AWS = require('aws-sdk');
const fs = require('fs')
const joi = require('joi');
const q = require('q');
const config = require('../config');
const dbpool = require('../utils/dbpool');
const Recordings = require('./recordings');

let s3;

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
            "CONCAT('https://"+config('aws').bucketName+".s3."+config('aws').region+".amazonaws.com/', T.`uri`) as `uri`",
            "T.`x1`", "T.`y1`", "T.`x2`", "T.`y2`",
            "T.`date_created`",
            "T.user_id",
            "T.disabled"
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

        if (options.showSiteData) {
            tables.push('JOIN sites S ON S.site_id = R.site_id');
            select.push('R.datetime', 'R.datetime_utc', 'S.external_id');
        }

        if (options.sourceProjectUri){
            tables.push('JOIN recordings R ON T.recording_id = R.recording_id');
            tables.push('JOIN sites S ON R.site_id = S.site_id');
            tables.push('JOIN projects P ON S.project_id = P.project_id');
            select.push('P.url as source_project_uri');
        }

        if (options.projectTemplates || options.publicTemplates) {
            select.push(
                "IF (T.user_id IS NULL, CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))), CONCAT(CONCAT(UCASE(LEFT( U2.`firstname` , 1)), SUBSTRING( U2.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U2.`lastname` , 1)), SUBSTRING( U2.`lastname` , 2)))) AS author",
                "P.`name` as `project_name`, P.`url` as `project_url`",
            );
            tables.push('JOIN projects P ON T.project_id = P.project_id');
            // Get an author of a template if the column T.user_id is not null.
            tables.push('LEFT JOIN users U2 ON T.user_id = U2.user_id AND T.user_id IS NOT NULL');
            // Get an owner of a project as author of the template if the column T.user_id is null.
            tables.push('LEFT JOIN user_project_role UPR ON T.project_id = UPR.project_id AND UPR.role_id = 4 AND T.user_id IS NULL');
            tables.push('LEFT JOIN users U ON UPR.user_id = U.user_id AND T.user_id IS NULL');
        }

        if (options.publicTemplates) {
            if (!options.isRfcxUser) {
                constraints.push('P.is_private = 0')
            }
            constraints.push('T.source_project_id IS NULL');
        }

        if (options.projectTemplates) {
            // Find source project for copied templates
            select.push(
                "T.`source_project_id` as `source_project_id`, P2.`name` as `source_project_name`",
                "IF (T.`source_project_id` IS NULL, P.`url`, P2.`url`) as `project_url`"
            );
            tables.push('LEFT JOIN projects P2 ON T.source_project_id = P2.project_id');
        }

        if (options.q) {
            constraints.push(`(T.name LIKE '%${options.q}%' OR ${options.projectTemplates ? 'P2.name' : 'P.name'} LIKE '%${options.q}%' OR Sp.scientific_name LIKE '%${options.q}%')`);
        }

        if (options.taxon) {
            tables.push('JOIN species_taxons Stx ON Stx.taxon_id = Sp.taxon_id');
            select.push('Stx.taxon_id, Stx.taxon')
            constraints.push('Stx.taxon_id = ' + options.taxon);
        }

        if (constraints.length === 0){
            return q.reject(new Error("Templates.find called with invalid query.")).nodeify(callback);
        }
        return dbpool.query(
            `SELECT ${select.join(', ')}
            FROM ${tables.join(' ')}
            WHERE ${constraints.join(' AND ')}
            ORDER BY date_created DESC
            ${options.limit ? ('LIMIT ' + options.limit + ' OFFSET ' + options.offset) : ''}`
        );
    },

    findOne: function(query){
        return find(query).then(data => data[0]);
    },

    templatesCount: async function(project, publicTemplates, join, whereCondition, isRfcxUser) {
        let q = `SELECT count(*) AS count FROM templates as T
        JOIN projects P ON T.project_id = P.project_id`
        if (join) {
            q += join
        }
        const where = 'WHERE T.deleted=0';
        if (publicTemplates) {
            // Find an original templates, not copied
            q += ` ${where} AND T.source_project_id IS NULL`
            if (!isRfcxUser) {
                q += ' AND P.is_private = 0'
            }
        }
        else {
            q += ` ${where} AND T.project_id=${project}`
        }
        if (whereCondition) {
            q += whereCondition
        }
        return dbpool.query(q).get(0).get('count');
    },

    findWithPagination: async function (options) {
        let join = ` JOIN species S ON T.species_id = S.species_id`
        let where = ''
        if (options.q) {
            join += ` ${options.projectTemplates ? 'LEFT JOIN projects P2 ON T.source_project_id = P2.project_id' : ''}`;
            where += ` AND (T.name LIKE '%${options.q}%' OR ${options.projectTemplates ? 'P2.name' : 'P.name'} LIKE '%${options.q}%' OR S.scientific_name LIKE '%${options.q}%')`
        }
        if (options.taxon) {
            join += ` JOIN species_taxons Stx ON Stx.taxon_id = S.taxon_id`;
            where += ` AND Stx.taxon_id = ${options.taxon}`
        }
        const count = (options.q || options.taxon) ? await Templates.templatesCount(
            options.project,
            options.publicTemplates,
            join,
            where,
            options.isRfcxUser
        ) : await Templates.templatesCount(options.project, options.publicTemplates, null, null, options.isRfcxUser);
        if (count) {
            const list =  await Templates.find(options);
            return { list: list, count: count }
        }
        else return { list: [], count: 0 }
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
        const query =
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
                    data.x1, data.y1, data.x2, data.y2, data.source_project_id ? data.source_project_id : null, data.user_id,
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
            showRecordingUri: true,
            showSiteData: true
        }).get(0).then(template => {
            if(!template) {
                next(new Error("Requested template data does not exists."));
                return;
            }

            const opts = {
                uri: template.recUri,
                site_id: template.recSiteId,
                external_id: template.external_id,
                datetime: template.datetime,
                datetime_utc: template.datetime_utc
            }
            const filter = {
                maxFreq: Math.max(template.y1, template.y2),
                minFreq: Math.min(template.y1, template.y2),
                gain: options.gain || 1,
                trim: {
                    from: Math.min(template.x1, template.x2),
                    to: Math.max(template.x1, template.x2)
                }
            }

            return q.ninvoke(Recordings, 'fetchAudioFile', opts, filter);
        });
    },

    /** Creates a roi image
     * @param {Object} template - template, as returned by findOne
     */
    createTemplateImage : function (template){
        const s3key = 'project_'+template.project+'/templates/'+template.id+'.png';
        template.uri = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + s3key;
        let rec_data, rec_stats, spec_data, isLegacy;
        return Recordings.findByUrlMatch(template.recording, 0, {limit:1})
        .then(data => rec_data = data[0])
        .then((rec_data) => {
            isLegacy = Recordings.isLegacy(rec_data)
            if (isLegacy) {
                return Promise.all([
                    q.ninvoke(Recordings, 'fetchInfo', rec_data).then(data => rec_stats = data),
                    q.ninvoke(Recordings, 'fetchSpectrogramFile', rec_data).then(data => spec_data = data)
                ])
            }
            const opts = {
                uri: rec_data.uri,
                external_id: rec_data.external_id,
                datetime: rec_data.datetime,
                datetime_utc: rec_data.datetime_utc,
                template: true
            }
            const filter = {
                maxFreq: Math.max(template.y1, template.y2),
                minFreq: Math.min(template.y1, template.y2),
                trim: {
                    from: Math.min(template.x1, template.x2),
                    to: Math.max(template.x1, template.x2)
                }
            }
            return q.ninvoke(Recordings, 'fetchTemplateFile', opts, filter)
        }).then(data => {
            if (data && data.path) {
                spec_data = data
            }
        }).then(() => jimp.read(spec_data.path))
          .then((spectrogram) => {
            if (isLegacy) {
                const px2sec = rec_data.duration/spectrogram.bitmap.width;
                const max_freq = rec_data.sample_rate/2;
                const px2hz  = max_freq/spectrogram.bitmap.height;

                const left = Math.floor(template.x1/px2sec);
                const top = spectrogram.bitmap.height-Math.floor(template.y2/px2hz);
                const right = Math.floor(template.x2/px2sec);
                const bottom = spectrogram.bitmap.height-Math.floor(template.y1/px2hz);

                const roi = spectrogram.clone().crop(left, top, right - left, bottom - top);
                return roi.getBufferAsync(jimp.MIME_PNG);
            }
            const roi = spectrogram.clone()
            return roi.getBufferAsync(jimp.MIME_PNG);
        }).then((roiBuffer) => {
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
            if (spec_data && spec_data.path) {
                fs.unlink(spec_data.path, function (err) {
                    if (err) console.error('Error deleting the template file.', err);
                    console.info('Template file deleted.');
                })
            }
            return dbpool.query(dbpool.format(
                "UPDATE templates \n"+
                "SET uri = ? \n"+
                "WHERE template_id = ?", [
                s3key, template.id
            ]));
        }).then(() => {
            return template;
        });
    },

};

module.exports = Templates;
