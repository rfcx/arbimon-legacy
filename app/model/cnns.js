/* jshint node:true */
"use strict";

const joi = require('joi');
const AWS = require('aws-sdk');
const q = require('q');
const config = require('../config');
const dbpool = require('../utils/dbpool');
const Recordings = require('./recordings');
const models = require("./index");
const lambda = new AWS.Lambda();
const fileHelper = require('../utils/file-helper')

var CNN = {
    find: function (options) {
        var constraints = [],
            projection = [];
        var postprocess = [];
        var data = [];
        var select = [
            "CNN.`job_id`",
            "CNN.`name`",
            "CNN.`cnn_id`",
            "CNN.`playlist_id`",
            "CNN.`project_id`",
            "CNN.`timestamp`",
        ];
        var tables = ["job_params_cnn CNN"];
        var groupby = [];
        if (options instanceof Function) {
            callback = options;
            options = null;
        }
        if (!options) {
            options = {};
        }

        if (!options.showDeleted) {
            constraints.push("CNN.deleted = 0");
        }

        if (options.job_id) {
            constraints.push("CNN.job_id = ?");
            data.push(options.job_id);
        }

        if (options.showPlaylist) {
            select.push("P.`name` as `playlist_name`");
            tables.push("JOIN playlists P ON P.`playlist_id` = CNN.`playlist_id`");
        }

        if (options.showModelName) {
            select.push("CM.`name` as `cnn_model_name`");
            select.push("CM.`uri` as model_uri");
            tables.push("JOIN cnn_models CM ON CM.`cnn_id` = CNN.`cnn_id`");
        }

        if (options.showUser) {
            select.push("J.`user_id`");
            tables.push("JOIN jobs J on CNN.`job_id` = J.`job_id`");
            select.push("U.`firstname` as `firstname`");
            select.push("U.`lastname` as `lastname`");
            tables.push("JOIN users U ON J.`user_id` = U.`user_id`");
        }

        if (options.showCounts) {
            select.push("SUM(IF(CRR.cnn_result_roi_id IS NULL, 0, 1)) as matches");
            select.push("SUM(IF(CRR.validated=1, 1, 0)) as present");
            select.push("SUM(IF(CRR.validated=0, 1, 0)) as absent");
            tables.push("LEFT JOIN cnn_results_rois CRR ON CRR.job_id = CNN.job_id");
            groupby.push("CNN.job_id");
        }

        if (options.project) {
            constraints.push('CNN.project_id = ?');
            data.push(options.project);
        }

        if(options.playlistCount){
            projection.push("(\n" +
            "   SELECT COUNT(*) FROM playlist_recordings PLR WHERE CNN.playlist_id = PLR.playlist_id\n" +
            ") as playlist_count");
        }

        postprocess.push((rows) => {
            rows.forEach(row => {
                if (options.showUser) {
                    row.user = row.firstname + ' ' + row.lastname;
                    delete row.firstname;
                    delete row.lastname;
                }
                if (options.resolveModelUri) {
                    row.model_uri = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + row.model_uri;
                }
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch (e) {
                    row.parameters = {
                        error: row.parameters
                    };
                }
            })
            return rows;
        });

        var queryStr =
            "SELECT " + select.join(",\n    ") + "\n" +
            (projection.length ? ","+projection.join(",")+"\n" : "") +
            "FROM " + tables.join("\n") + "\n" +
            (constraints.length ? ("WHERE " + constraints.join(" \n  AND ")) : "") +
            (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "") +
            " ORDER BY timestamp DESC";

        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(queryStr, data))
    },

    findOne: function (job_id, options) {
        options.job_id = job_id;
        return CNN.find(options).then(function(rows){
            return rows[0];
        });
    },

    listModels: function (options) {
        var constraints = [],
            projection = [];
        var postprocess = [];
        var data = [];
        var select = [
            "CM.`cnn_id` as id",
            "CM.`name`",
            "CM.`uri` as uri",
            "CM.`stats`",
            "CM.`sample_rate`",
            "CM.`info`",
        ];
        var tables = ["cnn_models CM"];
        var groupby = [];
        if (options instanceof Function) {
            callback = options;
            options = null;
        }
        if (!options) {
            options = {};
        }
        postprocess.push((rows) => {
            rows.forEach(row => {
                if (row.uri) {
                    row.uri = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + row.uri;
                }
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch (e) {
                    row.parameters = {
                        error: row.parameters
                    };
                }
            })
            return rows;
        });

        var queryStr =
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            (constraints.length ? ("WHERE " + constraints.join(" \n  AND ")) : "") +
            (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "");

        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(queryStr, data))
    },
    // copied from recordings.js in express model
    // if that changes this should change as well
    __compute_thumbnail_path : function(recording, callback){
        recording.thumbnail = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + encodeURIComponent(recording.uri.replace(/\.([^.]*)$/, '.thumbnail.png'));
        if (callback){callback()};
    },
    listResults: function (job_id, options) {

        var constraints = [],
            projection = [];
        var postprocess = [];
        var data = [];
        var select = [
            "CRP.`cnn_presence_id`",
            "CRP.`job_id`",
            "CRP.`recording_id`",
            "CRP.`species_id`",
            "CRP.`songtype_id`",
            "CRP.`present`",
            "CRP.`max_score`",
            "CRP.`cnn_result_roi_id`",
            "SP.`scientific_name`",
            "ST.`songtype`",
            "R.`datetime`",
            "R.`uri`",
            "CRR.`uri` as `cnn_result_roi_uri`",
            "CRR.`x1`",
            "CRR.`y1`",
            "CRR.`x2`",
            "CRR.`y2`"
        ];
        var tables = ["cnn_results_presence CRP"];

        constraints.push('CRP.`job_id` = ?');
        data.push(job_id);

        tables.push("JOIN species SP ON SP.`species_id` = CRP.`species_id`");
        tables.push("JOIN songtypes ST ON ST.`songtype_id` = CRP.`songtype_id`");

        tables.push("JOIN recordings R ON R.`recording_id` = CRP.`recording_id`");

        tables.push("JOIN cnn_results_rois CRR ON CRR.`cnn_result_roi_id` = CRP.`cnn_result_roi_id`");

        var groupby = [];
        if (options instanceof Function) {
            callback = options;
            options = null;
        }
        if (!options) {
            options = {};
        }

        postprocess.push((rows) => {
            rows.forEach(row => {
                this.__compute_thumbnail_path(row);
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch (e) {
                    row.parameters = {
                        error: row.parameters
                    };
                }
            })
            return rows;
        });

        var queryStr =
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            (constraints.length ? ("WHERE " + constraints.join(" \n  AND ")) : "") +
            (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "");

        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(queryStr, data))
    },

    /** Deletes a pattern matching results.
     * @param {int} cnnId
     * @return {Promise} resolved after deleting the pattern matching
     */
    delete: function (cnnId) {
        return dbpool.query(
            "UPDATE job_params_cnn SET deleted=1 WHERE job_id = ?", [cnnId]
        );
    },

    getRoiAudioFile(cnnId, roiId, options){
        options = options || {};

        var query = "SELECT CRR.x1, CRR.x2, CRR.y1, CRR.y2, CRR.uri as imgUri, R.uri as recUri, R.site_id as recSiteId,\n" +
            "R.datetime, R.datetime_utc, S.external_id\n" +
        "FROM cnn_results_rois CRR\n" +
        "JOIN recordings R ON CRR.recording_id = R.recording_id\n" +
        "JOIN sites S ON S.site_id = R.site_id\n" +
        "WHERE CRR.cnn_result_roi_id = ?";

        return dbpool.query(
            query, [
                roiId
            ]
        ).get(0).then(function(crr){
            if(!crr){
                return;
            }
            const opts = {
                uri: crr.recUri,
                site_id: crr.recSiteId,
                external_id: crr.external_id,
                datetime: crr.datetime,
                datetime_utc: crr.datetime_utc
            }
            const filter = {
                maxFreq: Math.max(crr.y1, crr.y2),
                minFreq: Math.min(crr.y1, crr.y2),
                gain: options.gain || 15,
                trim: {
                    from: Math.min(crr.x1, crr.x2),
                    to: Math.max(crr.x1, crr.x2)
                }
            }

            return q.ninvoke(Recordings, 'fetchAudioFile', opts, filter);
        })
    },

    countROIsBySpecies: function(job_id, options) {
        return dbpool.query(
            "SELECT CRR.species_id,\n" +
            "COUNT(CRR.cnn_result_roi_id) as N,\n" +
            "S.scientific_name\n" +
            "FROM cnn_results_rois CRR\n" +
            "JOIN species S ON S.species_id = CRR.species_id\n" +
            "WHERE job_id = ?\n" +
            "GROUP BY species_id;\n", [job_id]
        )
    },

    getValidatedConstraint: function (search) {
        let constraint = "";
        switch (search) {
            case 'present':
                constraint = 'AND CRR.`validated` = 1';
                break;
            case 'not_present':
                constraint = 'AND CRR.`validated` = 0';
                break;
            case 'unvalidated':
                constraint = 'AND CRR.`validated` is NULL'
                break;
        }
        return constraint
    },

    countROIsBySites: function(job_id, options) {
        let constraint = this.getValidatedConstraint(options.search);
        var queryStr = `
            SELECT COUNT(CRR.cnn_result_roi_id) as N,
            S.name,
            S.site_id
            FROM cnn_results_rois CRR
            JOIN sites S ON S.site_id = CRR.denorm_site_id
            WHERE job_id = ?
            ${constraint}
            GROUP BY S.site_id;`
        return dbpool.query(queryStr, [job_id])
    },

    countROIsBySpeciesSites: function(job_id, options) {
        let constraint = this.getValidatedConstraint(options.search);
        return this.countROIsBySites(job_id, options)
        .then(function(data) {
            let site_sql = '';
            data.forEach(function(row) {
                site_sql += `, SUM(CASE WHEN S.site_id="${row.site_id}" THEN 1 ELSE 0 END) \`site_${row.site_id}_${row.name}\``;
            })
            return dbpool.query(
                `SELECT CRR.species_id, SP.scientific_name, COUNT(*) as total
                ${site_sql}
                FROM cnn_results_rois CRR
                JOIN sites S ON S.site_id = CRR.denorm_site_id
                JOIN species SP ON SP.species_id = CRR.species_id
                WHERE job_id = ?
                ${constraint}
                GROUP BY CRR.species_id;`,
                [job_id]
            );
        });
    },

    validateRois(job_id, rois, validation){
        return rois.length ? dbpool.query(
            "UPDATE cnn_results_rois\n" +
            "SET validated = ?\n" +
            "WHERE job_id = ?\n" +
            "AND cnn_result_roi_id IN (?)", [
            validation,
            job_id,
            rois,
        ]) : Promise.resolve();
    },

    listROIs: function (job_id, options) {
        var constraints = [],
            projection = [];
        var postprocess = [];
        var data = [];
        var limits = false;
        var orderBy = [];

        var select = [
            "CRR.`cnn_result_roi_id`",
            "CRR.`job_id`",
            "CRR.`recording_id`",
            "CRR.`species_id`",
            "CRR.`songtype_id`",
            "CRR.`x1`",
            "CRR.`y1`",
            "CRR.`x2`",
            "CRR.`y2`",
            "CRR.`uri` AS roi_thumbnail_uri",
            "CRR.`score`",
            "SP.`scientific_name` AS species",
            "SP.`scientific_name`",
            "ST.`songtype`",
            "R.`datetime`",
            "R.`uri` AS uri",
            "R.`site_id`",
            'SUBSTRING_INDEX(R.`uri`, "/", -1) as `recording`',
            'S.`name` as `site`',

        ];

        if (options.humanValidated) {
            select.push(
                '(CASE ' +
                'WHEN CRR.`validated` = 1 THEN "present" ' +
                'WHEN CRR.`validated` = 0 THEN "not present" ' +
                'ELSE "(not validated)" ' +
                'END) as validated');
        } else {
            select.push("CRR.`validated`");
        }
        var tables = ["cnn_results_rois CRR"];

        constraints.push('CRR.`job_id` = ?');
        data.push(job_id);

        tables.push("JOIN species SP ON SP.`species_id` = CRR.`species_id`");
        tables.push("JOIN songtypes ST ON ST.`songtype_id` = CRR.`songtype_id`");

        tables.push("JOIN recordings R ON R.`recording_id` = CRR.`recording_id`");
        tables.push("JOIN sites S ON S.site_id = R.site_id");
        var groupby = [];
        if (options instanceof Function) {
            callback = options;
            options = null;
        }
        if (!options) {
            options = {};
        }

        if (options.species_id) {
            if (options.species_id != 0){
                constraints.push('CRR.`species_id` = ?');
                data.push(options.species_id);
            }
        }
        if (options.site_id) {
            if (options.site_id != 0){
                constraints.push('S.`site_id` = ?');
                data.push(options.site_id);
            }
        }
        if(options.limit){
            limits = {limit: options.limit,
                      offset: options.offset || 0};
        }
        if (options.human_dates){
            select.push(
            'EXTRACT(year FROM R.`datetime`) as `year`',
            'EXTRACT(month FROM R.`datetime`) as `month`',
            'EXTRACT(day FROM R.`datetime`) as `day`',
            'EXTRACT(hour FROM R.`datetime`) as `hour`',
            'EXTRACT(minute FROM R.`datetime`) as `min`'
            );
        }
        if (options.search){
            if (options.search=="present"){
                constraints.push("CRR.`validated` = 1");
            } else if (options.search=="not_present"){
                constraints.push("CRR.`validated` = 0");
            } else if (options.search=="unvalidated"){
                constraints.push("CRR.`validated` is NULL");
            }
            else if (options.search === 'by_score') {
                orderBy = ['CRR.score DESC']
            }
            else if (options.search === 'by_score_per_site'){
                orderBy = [['S.name ASC'], ['CRR.score DESC']]
            }
        }
        postprocess.push((rows) => {
            rows.forEach(row => {
                this.__compute_thumbnail_path(row);
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch (e) {
                    row.parameters = {
                        error: row.parameters
                    };
                }
            })
            return rows;
        });

        var queryStr =
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            (constraints.length ? ("WHERE " + constraints.join(" \n  AND ")) : "") +
            (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "") +
            (orderBy.length ? ("\nORDER BY " + orderBy.join(",\n    ")) : "\nORDER BY CRR.`species_id`, R.`site_id`") +
            (limits ? ("\nLIMIT " + limits.limit + " OFFSET " + limits.offset) : "");

        if (options.return_sql) {
            return {queryStr: queryStr, data: data};
        }
        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(queryStr, data))
    },
    JOB_SCHEMA : joi.object().keys({
        project_id    : joi.number().integer(),
        user_id       : joi.number().integer(),
        name       : joi.string(),
        playlist_id   : joi.number().integer(),
        cnn_id   : joi.number().integer(),
        params     : joi.object().keys({
        }),
    }),

    exportRois(cnnId, filters, options){
        filters = filters || {};
        options = options || {};

        var sqlObj = this.listROIs(cnnId,{
            return_sql: true,
            human_dates: true,
            humanValidated: true
            // offset: offset
            //hideNormalValidations: options.hideNormalValidations,
            //expertCSValidations: options.expertCSValidations,
            //countCSValidations: options.countCSValidations,
            //show: { names: true },
        })

        return dbpool.streamQuery(sqlObj.queryStr, sqlObj.data);
    },

    requestNewCNNJob: function(data){
        var queryStr = "SELECT arn FROM cnn_models WHERE cnn_id = ?;"
        return dbpool.query(queryStr, [data.cnn_id]).then(function(rows) {
            var arn = rows[0].arn || config('lambdas').new_cnn_job_v1;
            delete data.lambda;

            return q.ninvoke(joi, 'validate', data, CNN.JOB_SCHEMA).then(() => lambda.invoke({
                FunctionName: arn,
                InvocationType: 'Event',
                Payload: JSON.stringify({
                    project_id: data.project_id,
                    user_id: data.user_id,
                    playlist_id: data.playlist_id,
                    cnn_id: data.cnn_id,
                    name: data.name,
                    params: {}
                }),
            }).promise());
        });
    }
};


module.exports = CNN;
