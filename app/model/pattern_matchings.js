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

// local variables
var s3;
var queryHandler = dbpool.queryHandler;


// exports
var PatternMatchings = {
    /** Finds playlists, given a (non-empty) query.
     * @param {Object}  query
     * @param {Integer} query.id      find playlists with the given id.
     * @param {Integer} query.project find playlists associated to the given project id.
     * @param {Object}  options [optional]
     * @param {Boolean} options.count add the number of recordings in the playlist
     * @param {Boolean} options.show_info  show the playlist's info
     * @param {Function} callback called back with the queried results.
     * @return {Promise} resolving to array with the matching playlists.
     */
    find: function (query, options, callback) {
        var constraints=[], projection=[];
        var data=[];
        var select = [
            "PM.`pattern_matching_id` as id" ,
            "PM.`name`", "PM.`project_id`" ,
            "PM.`timestamp`", "PM.`species_id`", "PM.`songtype_id`" ,
            "PM.`parameters`" ,
            "PM.`playlist_id`", "PM.`template_recording_id`" ,
            "PM.`template_bbox`", "PM.`template_uri`" ,
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

        if (query.id) {
            constraints.push('PM.pattern_matching_id = ?');
            data.push(query.id);
        }

        if (query.project) {
            constraints.push('PM.project_id = ?');
            data.push(query.project);
        }

        if (query.showSpecies) {
            select.push("Sp.`scientific_name` as `species`");
            select.push("St.`songtype`");
            tables.push("JOIN species Sp ON Sp.species_id = PM.species_id");
            tables.push("JOIN songtypes St ON St.songtype_id = PM.songtype_id");
        }

        if (query.showPlaylist) {
            select.push("P.`name` as `playlist_name`");
            tables.push("JOIN playlists P ON P.playlist_id = PM.playlist_id");
        }

        if (query.showCounts) {
            select.push("COUNT(*) as matches");
            select.push("SUM(IF(validated=1, 1, 0)) as validated");
            select.push("SUM(IF(validated=0, 1, 0)) as removed");
            tables.push("JOIN pattern_matching_rois PMM ON PMM.pattern_matching_id = PM.pattern_matching_id");
            groupby.join("PM.pattern_matching_id");
        }

        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" \n  AND ") + (
                groupby ? ("\n" + groupby.join(",\n    ")) : ""
            ),
            data
        ).then( rows => {
            rows.forEach(item => {
                const bbox = JSON.parse(item.template_bbox);
                item.parameters = JSON.parse(item.parameters);
                item.template = {
                    uri: item.template_uri,
                    recording: item.template_recording_id,
                    x1: bbox[0], y1: bbox[1],
                    x2: bbox[2], y2: bbox[3],
                };
                delete item.template_uri;
                delete item.template_recording_id;
                delete item.template_bbox;
            })

            return rows;
        }).nodeify(callback);
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
};


module.exports = PatternMatchings;
