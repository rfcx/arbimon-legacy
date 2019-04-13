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
var SQLBuilder   = require('../utils/sqlbuilder');
var dbpool       = require('../utils/dbpool');
var Recordings   = require('./recordings');
var Projects     = require('./projects');
var Templates     = require('./templates');

// local variables
var s3;
var lambda = new AWS.Lambda();
var queryHandler = dbpool.queryHandler;

function arrayOrSingle(x){
    return joi.alternatives(x, joi.array().items(x));
}


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
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch(e) {
                    row.parameters = {error: row.parameters};
                }
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

    SEARCH_ROIS_SCHEMA : {
        patternMatching: joi.number().required(),
        // project_id: joi.number().required(),
        // range: joi.object().keys({
        //     from: joi.date(),
        //     to: joi.date()
        // }).and('from', 'to'),
        // sites:  arrayOrSingle(joi.string()),
        // imported: joi.boolean(),
        // years:  arrayOrSingle(joi.number()),
        // months: arrayOrSingle(joi.number()),
        // days:   arrayOrSingle(joi.number()),
        // hours:  arrayOrSingle(joi.number()),
        // validations:  arrayOrSingle(joi.number()),
        // presence:  arrayOrSingle(joi.string().valid('absent', 'present')),
        // soundscape_composition:  arrayOrSingle(joi.number()),
        // soundscape_composition_annotation:  arrayOrSingle(joi.string().valid('absent', 'present')),
        // tags: arrayOrSingle(joi.number()),
        // playlists: arrayOrSingle(joi.number()),
        // classifications: arrayOrSingle(joi.number()),
        // classification_results: arrayOrSingle(joi.object().keys({
        //     model: joi.number(),
        //     th: joi.number()
        // }).optionalKeys('th')),
        show: joi.object().keys({
            patternMatchingId: joi.boolean(),
            names: joi.boolean(),
        }),
        limit:  joi.number(),
        offset: joi.number(),
        sortBy: joi.array().items(joi.any()),
        // sortRev: joi.boolean(),
        // output:  arrayOrSingle(joi.string().valid('count','list','date_range')).default('list')
    },

    buildRoisQuery(parameters){
        console.log('rois query from', parameters);
        var builder = new SQLBuilder();
        return q.ninvoke(joi, 'validate', parameters, PatternMatchings.SEARCH_ROIS_SCHEMA).then(function(parameters){
            var outputs = parameters.output instanceof Array ? parameters.output : [parameters.output];
            var show = parameters.show || {};

            builder.addProjection(
                'PMR.`pattern_matching_roi_id` as `id`',
            );

            if(show.patternMatchingId){
                builder.addProjection('PMR.`pattern_matching_id`');
            }

            builder.addTable("pattern_matching_rois", "PMR");

            builder.addTable("JOIN recordings", "R", "R.recording_id = PMR.recording_id");
            builder.addTable("JOIN sites", "S", "S.site_id = R.site_id");
            builder.addProjection(
                'SUBSTRING_INDEX(R.`uri`, "/", -1) as `recording`',
                'S.`name` as `site`',
                'EXTRACT(year FROM R.`datetime`) as `year`',
                'EXTRACT(month FROM R.`datetime`) as `month`',
                'EXTRACT(day FROM R.`datetime`) as `day`',
                'EXTRACT(hour FROM R.`datetime`) as `hour`',
                'EXTRACT(minute FROM R.`datetime`) as `min`'
            );

            builder.addTable("JOIN species", "Sp", "Sp.species_id = PMR.species_id");
            builder.addProjection('Sp.`scientific_name` as species');

            builder.addTable("JOIN songtypes", "St", "St.songtype_id = PMR.songtype_id");
            builder.addProjection('St.`songtype`');
            if(!show.names){
                builder.addProjection(
                    'PMR.`recording_id`',
                    'PMR.`species_id`',
                    'PMR.`songtype_id`',
                );

            }

            builder.addProjection(
                'PMR.`x1`, PMR.`y1`, PMR.`x2`, PMR.`y2`',
                'PMR.`uri`',
            );

            if(show.names){
                builder.addProjection(
                    '(CASE ' +
                    'WHEN PMR.`validated` = 1 THEN "present" ' +
                    'WHEN PMR.`validated` = 0 THEN "not present" ' +
                    'ELSE "(not validated)" ' +
                    'END) as validated'
                );
            } else {
                builder.addProjection('PMR.`validated`');
            }

            builder.addConstraint("PMR.pattern_matching_id = ?", [
                parameters.patternMatching
            ]);

            if(parameters.sortBy){
                parameters.sortBy.forEach(item => builder.addOrderBy(item[0], item[1]));
            }

            // builder.setOrderBy(parameters.sortBy || 'site', !parameters.sortRev);

            if(parameters.limit){
                builder.setLimit(parameters.limit, parameters.offset || 0);
            }

            return builder;
        });
    },

    getRoisForId(patternMatchingId, limit, offset){
        return this.buildRoisQuery({
            patternMatching: patternMatchingId,
            limit: limit,
            offset: offset,
            show: { patternMatchingId: true },
            sortBy: [['S.name', 1], ['R.datetime', 1]],
        }).then(
            builder => dbpool.query(builder.getSQL())
        );
    },

    exportRois(patternMatchingId, filters){
        filters = filters || {};

        return this.buildRoisQuery({
            patternMatching: patternMatchingId,
            // limit: limit,
            // offset: offset
            show: { names: true },
        }).then(
            builder => dbpool.streamQuery({
                sql: builder.getSQL(),
                typeCast: sqlutil.parseUtcDatetime,
            })
        );
    },

    validateRois(patternMatchingId, rois, validation){
        return rois.length ? dbpool.query(
            "UPDATE pattern_matching_rois\n" +
            "SET validated = ?\n" +
            "WHERE pattern_matching_id = ?\n" +
            "AND pattern_matching_roi_id IN (?)", [
            validation,
            patternMatchingId,
            rois,
        ]) : Promise.resolve();
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
