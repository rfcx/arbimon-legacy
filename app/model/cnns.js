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
            "CNN.`id` as id",
            "CNN.`name`",
            "CNN.`cnn_model_id`",
            "CNN.`playlist_id`",
            "CNN.`user_id`",
            "CNN.`project_id`",
            "CNN.`timestamp`",
        ];
        var tables = ["cnns CNN"];
        var groupby = [];
        if (options instanceof Function) {
            callback = options;
            options = null;
        }
        if (!options) {
            options = {};
        }

        if (options.showPlaylist) {
            select.push("P.`name` as `playlist_name`");
            tables.push("JOIN playlists P ON P.playlist_id = CNN.playlist_id");
        }

        if (options.showModelName) {
            select.push("CM.`name` as `cnn_model_name`");
            select.push("CM.`uri` as model_uri");
            tables.push("JOIN cnn_models CM ON CM.cnn_id = CNN.cnn_model_id");
        }

        if (options.showUser) {
            select.push("U.`firstname` as `firstname`");
            select.push("U.`lastname` as `lastname`");
            tables.push("JOIN users U ON CNN.user_id = U.user_id");
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
    }
};


module.exports = CNN;