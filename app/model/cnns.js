/* jshint node:true */
"use strict";

// 3rd party dependencies
var debug = require('debug')('arbimon2:model:pattern_matchings');
var async = require('async');
var joi = require('joi');
var jimp = require('jimp');
var AWS = require('aws-sdk');
var q = require('q');

// local dependencies
var config = require('../config');
var APIError = require('../utils/apierror');
var tmpfilecache = require('../utils/tmpfilecache');
var sqlutil = require('../utils/sqlutil');
var SQLBuilder = require('../utils/sqlbuilder');
var dbpool = require('../utils/dbpool');
var Recordings = require('./recordings');
var Projects = require('./projects');
var Templates = require('./templates');

// local variables
var s3;
var lambda = new AWS.Lambda();
var queryHandler = dbpool.queryHandler;

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
                    row.model_uri = 'https://s3.amazonaws.com/' + config('aws').bucketName + '/' + row.model_uri;
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
            (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "")


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
                    row.uri = 'https://s3.amazonaws.com/' + config('aws').bucketName + '/' + row.uri;
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
        recording.thumbnail = 'https://' + config('aws').bucketName + '.s3.amazonaws.com/' + encodeURIComponent(recording.uri.replace(/\.([^.]*)$/, '.thumbnail.png'));
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

        console.log("TCL: queryStr", queryStr)

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

    getRoisForId(options){
        console.log("TCL: getRoisForId -> options", options);
        return this.buildRoisQuery({
            patternMatching: options.patternMatchingId,
            perSiteCount: options.perSiteCount,
            csValidationsFor: options.csValidationsFor,
            expertCSValidations: options.expertCSValidations,
            countCSValidations: options.countCSValidations,
            whereConflicted: options.whereConflicted,
            whereConsensus: options.whereConsensus,
            whereExpert: options.whereExpert,
            wherePresent: options.wherePresent,
            whereNotPresent: options.whereNotPresent,
            whereUnvalidated: options.whereUnvalidated,
            limit: options.limit,
            offset: options.offset,
            show: { patternMatchingId: true, datetime: true, names: options.showNames },
            sortBy: [['S.name', 1], ['R.datetime', 1]],
        }).then(
            builder => dbpool.query(builder.getSQL())
        );
    },

    listROIs: function (job_id, options) {
        
        var constraints = [],
            projection = [];
        var postprocess = [];
        var data = [];
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
            "SP.`scientific_name`",
            "ST.`songtype`",
            "R.`datetime`",
            "R.`uri` AS uri",
            "R.`site_id`",
            'SUBSTRING_INDEX(R.`uri`, "/", -1) as `recording`',
            'S.`name` as `site`',
            
        ];
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

        console.log("TCL: queryStr", queryStr)

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
    requestNewCNNJob: function(data){
        console.log("TCL: data", data)
        //return {data: data};
        var f_name = config('lambdas').new_cnn_job_test1;
        console.log("TCL: config('lambdas')", config('lambdas'))
        if (data.lambda) {
            f_name = config('lambdas')[data.lambda];
            delete data.lambda;
        }
        
        console.log("Lambda chosen************:   " + f_name);
        
        return q.ninvoke(joi, 'validate', data, CNN.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: f_name,
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
        

    }
};


module.exports = CNN;