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
var config       = require('../config');
var APIError = require('../utils/apierror');
var tmpfilecache = require('../utils/tmpfilecache');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var Recordings   = require('./recordings');
var Projects     = require('./projects');
var Templates     = require('./templates');

// local variables
var s3;
var lambda = new AWS.Lambda();
var queryHandler = dbpool.queryHandler;


// exports
var PatternMatchings = {
    /** Finds playlists, given a (non-empty) query.
     * @param {Object}  options
     * @param {Integer} options.id      find playlists with the given id.
     * @param {Integer} options.project find playlists associated to the given project id.
     * @param {Boolean} options.count add the number of recordings in the playlist
     * @param {Boolean} options.show_info  show the playlist's info
     * @param {Function} callback called back with the queried results.
     * @return {Promise} resolving to array with the matching playlists.
     */
    find: function (options) {
        var constraints=[], projection=[];
        var postprocess=[];
        var data=[];
        var select = [
            "PM.`pattern_matching_id` as id" ,
            "PM.`name`", "PM.`project_id`" ,
            "PM.`timestamp`", "PM.`species_id`", "PM.`songtype_id`" ,
            "PM.`parameters`" ,
            "PM.`playlist_id`", "PM.`template_id`" ,
        ];
        var tables = ["pattern_matchings PM"];
        var groupby = [];
        if(options instanceof Function){
            callback = options;
            options = null;
        }
        if(!options){
            options = {};
        }

        if (options.id) {
            constraints.push('PM.pattern_matching_id = ?');
            data.push(options.id);
        }

        if (options.project) {
            constraints.push('PM.project_id = ?');
            data.push(options.project);
        }

        if (options.showTemplate) {
            postprocess.push((rows) => {
                const idmap = rows.reduce((_, row) => {
                    (_[row.template_id] || (_[row.template_id] = [])).push(row);
                    return _;
                }, {});
                return Templates.find({idIn: Object.keys(idmap)}).then(templates => {
                    templates.forEach((template) => idmap[template.id].forEach(row => row.template = template));
                    return rows;
                });
            });
        }

        if (options.showPlaylist) {
            select.push("P.`name` as `playlist_name`");
            tables.push("JOIN playlists P ON P.playlist_id = PM.playlist_id");
        }

        if(options.showSpecies){
            tables.push('JOIN species Sp ON PM.species_id = Sp.species_id');
            tables.push('JOIN songtypes St ON PM.songtype_id = St.songtype_id');
            select.push('Sp.scientific_name as species_name', 'St.songtype as songtype_name');
        }

        if (options.showCounts) {
            select.push("COUNT(*) as matches");
            select.push("SUM(IF(validated=1, 1, 0)) as validated");
            select.push("SUM(IF(validated=0, 1, 0)) as removed");
            tables.push("JOIN pattern_matching_rois PMM ON PMM.pattern_matching_id = PM.pattern_matching_id");
            groupby.join("PM.pattern_matching_id");
        }

        postprocess.push((rows) => {
            rows.forEach(row => {
                row.parameters = JSON.parse(row.parameters);
            })

            return rows;
        });

        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" \n  AND ") + (
                groupby ? ("\n" + groupby.join(",\n    ")) : ""
            ),
            data
        ))
    },

    findOne: function (query, options, callback) {
        return PatternMatchings.find(query, options).then(function(rows){
            return rows[0];
        }).nodeify(callback);
    },

    getRoisForId(patternMatchingId, limit, offset){
        return dbpool.query(
            "SELECT \n" +
            "   `pattern_matching_roi_id` as `id`, `pattern_matching_id`, `recording_id`, `species_id`, `songtype_id`, `x1`, `y1`, `x2`, `y2`, `uri`, `validated`\n" +
            "FROM pattern_matching_rois\n" +
            "WHERE pattern_matching_id = ?\n" + (
                (limit !== undefined) ? ("LIMIT " + (limit | 0) + (
                (offset !== undefined) ? (" OFFSET " + (offset | 0)) : ""
            )) : ""),[
            patternMatchingId
        ]);
    },

    validateRois(patternMatchingId, rois, validation){
        return dbpool.query(
            "UPDATE pattern_matching_rois\n" +
            "SET validated = ?\n" +
            "WHERE pattern_matching_id = ?\n" +
            "AND pattern_matching_roi_id IN (?)", [
            validation,
            patternMatchingId,
            rois,
        ]);
    },

    JOB_SCHEMA : joi.object().keys({
        project    : joi.number().integer(),
        user       : joi.number().integer(),
        name       : joi.string(),
        playlist   : joi.number().integer(),
        template   : joi.number().integer(),
        params     : joi.object().keys({
            N: joi.number().integer(),
            threshold: joi.number(),
        }),
    }),

    requestNewPatternMatchingJob: function(data){
        return q.ninvoke(joi, 'validate', data, PatternMatchings.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').pattern_matching,
            InvocationType: 'Event',
            Payload: JSON.stringify({
                project_id: data.project,
                user_id: data.user,
                playlist_id: data.playlist,
                template_id: data.template,
                name: data.name,
                N: data.params.N,
                threshold: data.params.threshold,
            }),
        }).promise());
    },
};


module.exports = PatternMatchings;
