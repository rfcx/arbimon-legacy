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
            "PM.`cs_expert`",
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

        if (options.completed !== undefined || options.showUser) {
            tables.push("JOIN jobs J ON PM.job_id = J.job_id");
        }

        if (options.completed !== undefined) {
            select.push("J.`completed`");
            constraints.push('J.state = "completed"');
        }

        if (options.citizen_scientist !== undefined) {
            constraints.push('PM.`citizen_scientist` = ' + dbpool.escape(options.citizen_scientist));
        }

        if (options.cs_expert !== undefined) {
            constraints.push('PM.`cs_expert` = ' + dbpool.escape(options.cs_expert));
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
                return Templates.find({idIn: Object.keys(idmap), sourceProjectUri: true}).then(templates => {
                    templates.forEach((template) => idmap[template.id].forEach(row => row.template = template));
                    return rows;
                });
            });
        }

        if (options.showPlaylist) {
            select.push("P.`name` as `playlist_name`");
            select.push("(SELECT COUNT(*) FROM playlist_recordings PR WHERE PR.playlist_id=P.playlist_id) as `playlist_count`");
            tables.push("JOIN playlists P ON P.playlist_id = PM.playlist_id");
        }

        if(options.showSpecies){
            tables.push('JOIN species Sp ON PM.species_id = Sp.species_id');
            tables.push('JOIN songtypes St ON PM.songtype_id = St.songtype_id');
            select.push('Sp.scientific_name as species_name', 'St.songtype as songtype_name');
        }

        if (options.showCounts) {
            select.push("SUM(IF(PMR.pattern_matching_roi_id IS NULL, 0, 1)) as matches");
            select.push("SUM(IF(PMR.validated=1, 1, 0)) as present");
            select.push("SUM(IF(PMR.validated=0, 1, 0)) as absent");
            tables.push("LEFT JOIN pattern_matching_rois PMR ON PMR.pattern_matching_id = PM.pattern_matching_id");
            groupby.push("PM.pattern_matching_id");
        }

        if(options.showUserStatsFor || options.showCSExpertStats){
            select.push(
                "SUM(IF(PMR.pattern_matching_roi_id IS NULL, 0, 1)) as total",
            );
            if(!options.showCounts){
                tables.push("LEFT JOIN pattern_matching_rois PMR ON PMR.pattern_matching_id = PM.pattern_matching_id");
            }
        }

        if(options.showUserStatsFor) {
            select.push(
                "SUM(IF(PMR.consensus_validated IS NULL AND PMR.expert_validated IS NULL, 1, 0)) as cs_total",
            );
            select.push(
                "SUM(IF(PMV.validated = 1, 1, 0)) as cs_present",
                "SUM(IF(PMV.validated = 0, 1, 0)) as cs_absent",
                "SUM(IF(PMV.pattern_matching_roi_id IS NULL, 0, 1)) as validated"
            );
            tables.push("LEFT JOIN pattern_matching_validations PMV ON (PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id AND PMV.user_id = " + (options.showUserStatsFor | 0) + ")");
            groupby.push("PM.pattern_matching_id");
        }

        if(options.showCSExpertStats) {
            select.push(
                "SUM(IF(PMR.expert_validated IS NOT NULL, 1, 0)) as expert_validated",
                "SUM(IF(PMR.expert_validated = 1, 1, IF(PMR.expert_validated IS NULL AND PMR.consensus_validated = 1, 1, 0))) as expert_consensus_present",
                "SUM(IF(PMR.expert_validated = 0, 1, IF(PMR.expert_validated IS NULL AND PMR.consensus_validated = 0, 1, 0))) as expert_consensus_absent",
                "SUM(IF(PMR.consensus_validated IS NULL AND PMR.cs_val_present > 0 AND PMR.cs_val_not_present > 0 AND PMR.expert_validated IS NOT NULL, 1, 0)) as cs_conflict_resolved",
                "SUM(IF(PMR.consensus_validated IS NULL AND PMR.cs_val_present > 0 AND PMR.cs_val_not_present > 0 AND PMR.expert_validated IS NULL, 1, 0)) as cs_conflict_unresolved",
            );
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
                groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "" + "\n" +
            "ORDER BY timestamp DESC"
            ),
            data
        ))
    },

    findOne: function (query, options, callback) {
        return PatternMatchings.find(query, options).then(function(rows){
            return rows[0];
        }).nodeify(callback);
    },

    totalPatternMatchings: function(project_id, callback) {
        var q = "SELECT count(*) as count \n" +
                "FROM pattern_matchings as PM \n"+
                "JOIN jobs J ON PM.job_id = J.job_id \n"+
                "WHERE J.state = 'completed' AND PM.project_id = " + dbpool.escape(project_id);
        queryHandler(q, callback);
    },

    SEARCH_ROIS_SCHEMA : {
        patternMatching: joi.number().required(),
        csValidationsFor: joi.number().integer(),
        expertCSValidations: joi.boolean(),
        perUserCSValidations: joi.boolean(),
        hideNormalValidations: joi.boolean(),
        countCSValidations: joi.boolean(),
        perSiteCount: joi.boolean(),
        whereConflicted: joi.boolean(),
        whereExpert: joi.boolean(),
        whereNotExpert: joi.boolean(),
        whereConsensus: joi.boolean(),
        whereNotConsensus: joi.boolean(),
        whereNotCSValidated: joi.boolean(),
        wherePresent: joi.boolean(),
        whereNotPresent: joi.boolean(),
        whereUnvalidated: joi.boolean(),
        bestPerSite: joi.boolean(),
        bestPerSiteDay: joi.boolean(),
        byScorePerSite: joi.boolean(),
        byScore: joi.boolean(),
        show: joi.object().keys({
            patternMatchingId: joi.boolean(),
            names: joi.boolean(),
            datetime: joi.boolean(),
        }),
        limit:  joi.number(),
        offset: joi.number(),
        sortBy: joi.array().items(joi.any())
    },

    buildRoisQuery(parameters){
        var builder = new SQLBuilder();
        return q.ninvoke(joi, 'validate', parameters, PatternMatchings.SEARCH_ROIS_SCHEMA).then(function(parameters){
            var outputs = parameters.output instanceof Array ? parameters.output : [parameters.output];
            var show = parameters.show || {};
            var calc_denorm = false;
            var presteps=[];

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
                'S.`site_id`',
                'EXTRACT(year FROM R.`datetime`) as `year`',
                'EXTRACT(month FROM R.`datetime`) as `month`',
                'EXTRACT(day FROM R.`datetime`) as `day`',
                'EXTRACT(hour FROM R.`datetime`) as `hour`',
                'EXTRACT(minute FROM R.`datetime`) as `min`'
            );

            if(show.datetime){
                builder.addProjection('R.`datetime`');
            }

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

            if(parameters.expertCSValidations){
                if(show.names){
                    builder.addProjection(
                        '(CASE ' +
                        'WHEN PMR.`expert_validated` = 1 THEN "present" ' +
                        'WHEN PMR.`expert_validated` = 0 THEN "not present" ' +
                        'ELSE "(not expert validated)" ' +
                        'END) as expert_validated'
                    );
                } else {
                    builder.addProjection('PMR.`expert_validated` as expert_validated');
                }
                builder.addTable("LEFT JOIN users", "EVU", "PMR.expert_validation_user_id = EVU.user_id");
                builder.addProjection("COALESCE(CONCAT(EVU.firstname, ' ', EVU.lastname), '(unknown)') AS expert_validation_user")
            }

            if(parameters.csValidationsFor){
                parameters.showConsensusValidated = true;
                builder.addTable("LEFT JOIN pattern_matching_validations", "PMV",
                    "PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id\n" +
                    " AND PMV.user_id = " + builder.escape(parameters.csValidationsFor)
                );
                builder.addProjection('PMV.validated as cs_validated');
                if(parameters.whereNotCSValidated){
                    builder.addConstraint("PMV.validated IS NULL", []);
                }
            }

            if(parameters.countCSValidations){
                parameters.showConsensusValidated = true;
                builder.addProjection('PMR.cs_val_present');
                builder.addProjection('PMR.cs_val_not_present');
            }

            if(parameters.perUserCSValidations){
                builder.addTable("LEFT JOIN pattern_matching_validations", "PMV",
                    "PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id\n"
                );
                builder.addTable("LEFT JOIN users", "U",
                    "PMV.user_id = U.user_id\n"
                );
                builder.addProjection("CONCAT(U.firstname, ' ', U.lastname) AS user")
                builder.addProjection(
                    '(CASE PMV.`validated` WHEN 1 THEN "present" WHEN 0 THEN "not present" ELSE "(not validated)" END) as cs_validation'
                );
            }

            if(parameters.showConsensusValidated){
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
            }

            if(parameters.perSiteCount){
                builder.select = [
                    'S.site_id',
                    'S.`name` as `site`',
                    'COUNT(*) as `count`'
                ]
                builder.setGroupBy('S.site_id')
            }

            if(parameters.whereConflicted){
                builder.addConstraint("(PMR.cs_val_present > 0 AND PMR.cs_val_not_present > 0)", []);
            }

            if(parameters.whereConsensus){
                builder.addConstraint("PMR.consensus_validated IS NOT NULL", []);
            }

            if(parameters.whereNotConsensus){
                builder.addConstraint("PMR.consensus_validated IS NULL", []);
            }

            if(parameters.whereNotExpert){
                builder.addConstraint("PMR.expert_validated IS NULL", []);
            }

            if(parameters.wherePresent){
                builder.addConstraint("PMR.validated = 1", []);
            }

            if(parameters.whereNotPresent){
                builder.addConstraint("PMR.validated = 0", []);
            }

            if(parameters.whereUnvalidated){
                builder.addConstraint("PMR.validated IS NULL", []);
            }

            if(parameters.bestPerSite){
                calc_denorm = true;
                builder.addConstraint('PMR.score IS NOT NULL');
                builder.addConstraint(
                    "(\n" +
                    "    SELECT COUNT(DISTINCT(sq1PMR.score))\n" +
                    "    FROM pattern_matching_rois sq1PMR\n" +
                    "    WHERE sq1PMR.denorm_site_id = PMR.denorm_site_id\n" +
                    "      AND sq1PMR.pattern_matching_id = " + (parameters.patternMatching | 0) + "\n" +
                    "      AND sq1PMR.score > PMR.score\n" +
                    ") in (0)\n"
                , []);
            }

            if(parameters.bestPerSiteDay){
                calc_denorm = true;
                builder.addConstraint('PMR.score IS NOT NULL');
                builder.addConstraint(
                    "(\n" +
                    "    SELECT COUNT(DISTINCT(sq1PMR.score))\n" +
                    "    FROM pattern_matching_rois sq1PMR\n" +
                    "    WHERE sq1PMR.denorm_site_id = PMR.denorm_site_id\n" +
                    "      AND sq1PMR.denorm_recording_date = PMR.denorm_recording_date\n" +
                    "      AND sq1PMR.pattern_matching_id = " + (parameters.patternMatching | 0) + "\n" +
                    "      AND sq1PMR.score > PMR.score\n" +
                    ") in (0)\n"
                , []);
            }

            if(parameters.whereExpert){
                builder.addConstraint("PMR.expert_validated IS NOT NULL", []);
            }

            if(parameters.sortBy && parameters.sortBy.length){
                parameters.sortBy.forEach(item => builder.addOrderBy(item[0], item[1]));
            }

            // builder.setOrderBy(parameters.sortBy || 'site', !parameters.sortRev);

            if(parameters.limit){
                builder.setLimit(parameters.limit, parameters.offset || 0);
            }

            if (calc_denorm) {
                presteps.push(dbpool.query(
                    "UPDATE pattern_matching_rois PMR\n" +
                    "JOIN recordings AS R ON R.recording_id = PMR.recording_id\n" +
                    "SET PMR.denorm_site_id = R.site_id,\n" +
                    "    PMR.denorm_recording_datetime = R.datetime,\n" +
                    "    PMR.denorm_recording_date = DATE(R.datetime)\n" +
                    "WHERE PMR.pattern_matching_id = " + (parameters.patternMatching | 0) + "\n" +
                    ";"
                ))
            }

            return Promise.all(presteps).then(() => builder);
        });
    },

    /** Deletes a pattern matching results.
     * @param {int} patternMatchingId
     * @return {Promise} resolved after deleting the pattern matching
     */
    delete: function (patternMatchingId) {
        return dbpool.query(
            "UPDATE pattern_matchings SET deleted=1, playlist_id=NULL, citizen_scientist=0, cs_expert=0 WHERE pattern_matching_id = ?", [patternMatchingId]
        );
    },

    getRoisForId(options) {
        let sortBy = [['S.name', 1], ['R.datetime', 1]] // default sorting
        if (options.byScorePerSite) {
            sortBy = [['S.name', 1], ['PMR.score', 0]]
        }
        else if (options.byScore) {
            sortBy = [['PMR.score', 0]]
        }
        return this.buildRoisQuery({
            patternMatching: options.patternMatchingId,
            perSiteCount: options.perSiteCount,
            csValidationsFor: options.csValidationsFor,
            expertCSValidations: options.expertCSValidations,
            countCSValidations: options.countCSValidations,
            whereConflicted: options.whereConflicted,
            whereConsensus: options.whereConsensus,
            whereNotConsensus: options.whereNotConsensus,
            whereNotCSValidated: options.whereNotCSValidated,
            whereExpert: options.whereExpert,
            whereNotExpert: options.whereNotExpert,
            wherePresent: options.wherePresent,
            whereNotPresent: options.whereNotPresent,
            whereUnvalidated: options.whereUnvalidated,
            bestPerSite: options.bestPerSite,
            bestPerSiteDay: options.bestPerSiteDay,
            limit: options.limit,
            offset: options.offset,
            show: { patternMatchingId: true, datetime: true, names: options.showNames },
            sortBy,
        }).then(
            builder => dbpool.query(builder.getSQL())
        );
    },

    getSitesForPM (pmId) {
        return dbpool.query(`
            SELECT DISTINCT(S.site_id), S.name as site
            FROM playlists AS P
            JOIN pattern_matchings AS PM ON PM.playlist_id = P.playlist_id
            JOIN playlist_recordings AS PR ON PR.playlist_id = P.playlist_id
            JOIN recordings AS R ON PR.recording_id = R.recording_id
            JOIN sites AS S ON R.site_id = S.site_id
            WHERE PM.pattern_matching_id = ?;`, [pmId])
    },

    getRoiAudioFile(patternMatching, roiId, options){
        options = options || {};
        return dbpool.query(
            "SELECT PMR.x1, PMR.x2, PMR.y1, PMR.y2, PMR.uri as imgUri, R.uri as recUri, R.site_id as recSiteId\n" +
            "FROM pattern_matching_rois PMR\n" +
            "JOIN recordings R ON PMR.recording_id = R.recording_id\n" +
            "WHERE PMR.pattern_matching_id = ? AND PMR.pattern_matching_roi_id = ?", [
                patternMatching, roiId
            ]
        ).get(0).then(function(pmr){
            if(!pmr){
                return;
            }

            return q.ninvoke(Recordings, 'fetchAudioFile', {
                uri: pmr.recUri,
                site_id: pmr.recSiteId
            }, {
                maxFreq: Math.max(pmr.y1, pmr.y2),
                minFreq: Math.min(pmr.y1, pmr.y2),
                gain: options.gain,
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
            expertCSValidations: options.expertCSValidations,
            countCSValidations: options.countCSValidations,
            perUserCSValidations: options.perUserCSValidations,
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
            citizen_scientist: joi.boolean(),
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
