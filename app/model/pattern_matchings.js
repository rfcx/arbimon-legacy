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
var audioTools   = require('../utils/audiotool');
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
            "PM.`citizen_scientist`",
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

        if (options.completed !== undefined) {
            constraints.push('PM.`completed` = ' + dbpool.escape(options.completed));
        }

        if (options.citizen_scientist !== undefined) {
            constraints.push('PM.`citizen_scientist` = ' + dbpool.escape(options.citizen_scientist));
        }


        if (options.deleted !== undefined) {
            constraints.push('PM.`deleted` = ' + dbpool.escape(options.deleted));
        }

        if (options.project) {
            constraints.push('PM.project_id = ?');
            data.push(options.project);
        }

        if (options.showUser) {
            select.push(
                'J.user_id',
                "CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) AS user"
            );
            tables.push("JOIN jobs J ON PM.job_id = J.job_id");
            tables.push("JOIN users U ON J.user_id = U.user_id");
        }

        if (options.showConsensusNumber) {
            select.push('PM.consensus_number');
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
            select.push("SUM(IF(PMM.pattern_matching_id IS NULL, 0, 1)) as matches");
            select.push("SUM(IF(validated=1, 1, 0)) as present");
            select.push("SUM(IF(validated=0, 1, 0)) as absent");
            tables.push("LEFT JOIN pattern_matching_rois PMM ON PMM.pattern_matching_id = PM.pattern_matching_id");
            groupby.push("PM.pattern_matching_id");
        }

        if(options.showUserStatsFor) {
            select.push(
                "SUM(IF(PMR.pattern_matching_roi_id IS NULL, 0, 1)) as total",
                "SUM(IF(PMV.pattern_matching_roi_id IS NULL, 0, 1)) as validated"
            );
            tables.push("LEFT JOIN pattern_matching_rois PMR ON PM.pattern_matching_id = PMR.pattern_matching_id");
            tables.push("LEFT JOIN pattern_matching_validations PMV ON (PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id AND PMV.user_id = " + (options.showUserStatsFor | 0) + ")");
            groupby.push("PM.pattern_matching_id");
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
                groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : ""
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
        csValidationsFor: joi.number().integer(),
        hideNormalValidations: joi.boolean(),
        countCSValidations: joi.boolean(),
        show: joi.object().keys({
            patternMatchingId: joi.boolean(),
            names: joi.boolean(),
            datetime: joi.boolean(),
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

            if(show.datetime){
                builder.addProjection('R.`datetime`');
            }

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
                'PMR.`score`',
            );

            if(!parameters.hideNormalValidations){
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
            }

            builder.addConstraint("PMR.pattern_matching_id = ?", [
                parameters.patternMatching
            ]);

            if(parameters.csValidationsFor || parameters.countCSValidations){
                if(show.names){
                    builder.addProjection(
                        '(CASE ' +
                        'WHEN PMR.`consensus_validated` = 1 THEN "present" ' +
                        'WHEN PMR.`consensus_validated` = 0 THEN "not present" ' +
                        'ELSE "(not consensus validated)" ' +
                        'END) as consensus_validated'
                    );
                } else {
                    builder.addProjection('PMR.`consensus_validated` as consensus_validated');
                }

                var csValOnClause = 'PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id';
                if(parameters.csValidationsFor){
                    csValOnClause += " AND PMV.user_id="+builder.escape(parameters.csValidationsFor);
                } else if (parameters.countCSValidations){
                    builder.addProjection('SUM(IF(PMV.`validated` = 1, 1, 0)) as cs_val_present');
                    builder.addProjection('SUM(IF(PMV.`validated` = 0, 1, 0)) as cs_val_not_present');
                    builder.addGroupBy("PMR.pattern_matching_roi_id", true);
                }

                builder.addTable("LEFT JOIN pattern_matching_validations", "PMV", csValOnClause);
            }


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

    /** Deletes a pattern matching results.
     * @param {int} patternMatchingId
     * @return {Promise} resolved after deleting the pattern matching
     */
    delete: function (patternMatchingId) {
        return dbpool.query(
            "UPDATE pattern_matchings SET deleted=1 WHERE pattern_matching_id = ?", [patternMatchingId]
        );
    },

    getRoisForId(options){
        return this.buildRoisQuery({
            patternMatching: options.patternMatchingId,
            csValidationsFor: options.csValidationsFor,
            limit: options.limit,
            offset: options.offset,
            show: { patternMatchingId: true, datetime: true },
            sortBy: [['S.name', 1], ['R.datetime', 1]],
        }).then(
            builder => dbpool.query(builder.getSQL())
        );
    },

    getRoiAudioFile(patternMatching, roiId){
        return dbpool.query(
            "SELECT PMR.x1, PMR.x2, PMR.y1, PMR.y2, PMR.uri as imgUri, R.uri as recUri\n" +
            "FROM pattern_matching_rois PMR\n" +
            "JOIN recordings R ON PMR.recording_id = R.recording_id\n" +
            "WHERE PMR.pattern_matching_id = ? AND PMR.pattern_matching_roi_id = ?", [
                patternMatching, roiId
            ]
        ).get(0).then(function(pmr){
            if(!pmr){
                return;
            }

            return q.ninvoke(Recordings, 'fetchAudioFile', {uri: pmr.recUri}, {
                maxFreq: Math.max(pmr.y1, pmr.y2),
                trim: {
                    from: Math.min(pmr.x1, pmr.x2),
                    to: Math.max(pmr.x1, pmr.x2)
                },
            });
        })
    },

    exportRois(patternMatchingId, filters, options){
        filters = filters || {};
        options = options || {};

        return this.buildRoisQuery({
            patternMatching: patternMatchingId,
            // limit: limit,
            // offset: offset
            hideNormalValidations: options.hideNormalValidations,
            countCSValidations: options.countCSValidations,
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
            persite: joi.number().integer().allow(null),
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
                persite: data.params.persite,
                threshold: data.params.threshold,
                citizen_scientist: data.params.citizen_scientist | 0,
            }),
        }).promise());
    },
};


module.exports = PatternMatchings;
