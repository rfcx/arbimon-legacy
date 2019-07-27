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
            "SP.`scientific_name`",
            "ST.`songtype`"
        ];
        var tables = ["cnn_results_presence CRP"];

        constraints.push('CRP.`job_id` = ?');
        data.push(job_id);

        tables.push("JOIN species SP ON SP.`species_id` = CRP.`species_id`");
        tables.push("JOIN songtypes ST ON ST.`songtype_id` = CRP.`songtype_id`");
        
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
        project    : joi.number().integer(),
        user       : joi.number().integer(),
        name       : joi.string(),
        playlist   : joi.number().integer(),
        cnn   : joi.number().integer(),
        params     : joi.object().keys({
        }),
    }),
    requestNewCNNJob: function(data){
        console.log("TCL: data", data)
        return {data: data};
/*
        return q.ninvoke(joi, 'validate', data, CNN.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').new_cnn_job_test1,
            InvocationType: 'Event',
            Payload: JSON.stringify({
                project_id: data.project,
                user_id: data.user,
                playlist_id: data.playlist,
                cnn_id: data.cnn,
                name: data.name,
                params: {}
            }),
        }).promise());
*/
    }
};


module.exports = CNN;