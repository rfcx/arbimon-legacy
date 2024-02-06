/* jshint node:true */
"use strict";

const joi = require('joi');
const AWS = require('aws-sdk');
const q = require('q');
const config = require('../config');
const sqlutil = require('../utils/sqlutil');
const SQLBuilder = require('../utils/sqlbuilder');
const dbpool = require('../utils/dbpool');
const Recordings = require('./recordings');
const Templates = require('./templates');
const models = require("./index");
const lambda = new AWS.Lambda();

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
        let constraints=[], projection=[];
        let postprocess=[];
        let data=[];
        let select = [
            "PM.`pattern_matching_id` as id" ,
            "PM.`name`", "PM.`project_id`" ,
            "PM.`timestamp`", "PM.`species_id`", "PM.`songtype_id`" ,
            "PM.`parameters`" ,
            "PM.`citizen_scientist`",
            "PM.`cs_expert`",
            "PM.`playlist_id`", "PM.`template_id`" ,
        ];
        let tables = ["pattern_matchings PM"];
        let groupby = [];
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

        if (options.q) {
            constraints.push(`(PM.name LIKE '%${options.q}%' OR T.name LIKE '%${options.q}%' OR Sp.scientific_name LIKE '%${options.q}%' OR St.songtype LIKE '%${options.q}%')`);
            tables.push("JOIN templates T ON T.template_id = PM.template_id");
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
                return Templates.find({idIn: Object.keys(idmap), sourceProjectUri: true, showSpecies: true}).then(templates => {
                    templates.forEach((template) => idmap[template.id].forEach(row => row.template = template));
                    return rows;
                });
            });
        }

        if (options.showPlaylistName || options.showPlaylistCount) {
            tables.push("JOIN playlists P ON P.playlist_id = PM.playlist_id");
        }
        if (options.showPlaylistName) {
            select.push("P.`name` as `playlist_name`");
        }
        if (options.showPlaylistCount) {
            select.push("(SELECT COUNT(*) FROM playlist_recordings PR WHERE PR.playlist_id=P.playlist_id) as `playlist_count`");
        }

        if(options.showSpecies){
            tables.push('JOIN species Sp ON Sp.species_id = PM.species_id');
            tables.push('JOIN songtypes St ON St.songtype_id = PM.songtype_id');
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
            const stats = {
                cs_total: 'SUM(IF(PMR.consensus_validated IS NULL AND PMR.expert_validated IS NULL, 1, 0)) as cs_total',
                cs_present: 'SUM(IF(PMV.validated = 1, 1, 0)) as cs_present',
                cs_absent: 'SUM(IF(PMV.validated = 0, 1, 0)) as cs_absent',
                validated: 'SUM(IF(PMV.pattern_matching_roi_id IS NULL, 0, 1)) as validated'
            }
            for (let key in stats) {
                if (!options.userStats || options.userStats && options.userStats.includes(key)) {
                    select.push(stats[key])
                }
            }
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
            "ORDER BY timestamp DESC" +
            (options.limit ? ("\nLIMIT " + Number(options.limit) + " OFFSET " + Number(options.offset)) : "")
            ),
            data
        ))
    },

    findWithPagination: async function (options) {
        const count = options.q ? await PatternMatchings.totalPatternMatchings(
            options.project,
            `JOIN templates T ON T.template_id = PM.template_id
            JOIN species Sp ON Sp.species_id = PM.species_id
            JOIN songtypes St ON St.songtype_id = PM.songtype_id`,
            ` AND (PM.name LIKE '%${options.q}%' OR T.name LIKE '%${options.q}%' OR Sp.scientific_name LIKE '%${options.q}%' OR St.songtype LIKE '%${options.q}%')`
        ) : await PatternMatchings.totalPatternMatchings(options.project);
        if (count) {
            const list =  await PatternMatchings.find(options);
            return { list: list, count: count }
        }
        else return { list: [], count: 0 }
    },

    findOne: function (query, options, callback) {
        return PatternMatchings.find(query, options).then(function(rows){
            return rows[0];
        }).nodeify(callback);
    },

    totalPatternMatchings: async function(project_id, join, where) {
        let q = `SELECT count(*) as count
        FROM pattern_matchings as PM
        JOIN jobs J ON PM.job_id = J.job_id ${join ? join : ''}
        WHERE J.state = 'completed' AND PM.deleted = 0 AND PM.project_id = ${dbpool.escape(project_id)} ${where ? where : ''}`;
        return dbpool.query(q).get(0).get('count');
    },

    totalPMSpeciesDetected: async function(project_id) {
        const q = `SELECT COUNT(DISTINCT species_id) as count
            FROM pattern_matchings
            WHERE project_id = ${dbpool.escape(project_id)} and deleted = 0`;
        return dbpool.query(q).get(0).get('count');
    },

    totalPMTemplates: async function(project_id) {
        const q = `SELECT COUNT(DISTINCT template_id) as count
            FROM pattern_matchings
            WHERE project_id = ${dbpool.escape(project_id)} and deleted = 0`;
        return dbpool.query(q).get(0).get('count');
    },

    SEARCH_ROIS_SCHEMA : {
        patternMatching: joi.number().required(),
        site: joi.string(),
        sites: joi.array().items(joi.string()),
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
            url: joi.boolean(),
            showSpecies: joi.boolean(),
            showFrequency: joi.boolean(),
            totalPerSite: joi.boolean()
        }),
        limit:  joi.number(),
        offset: joi.number(),
        sortBy: joi.array().items(joi.any())
    },

    buildRoisQuery(parameters){
        var builder = new SQLBuilder();
        return q.ninvoke(joi, 'validate', parameters, PatternMatchings.SEARCH_ROIS_SCHEMA).then(function(parameters){
            var show = parameters.show || {};
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
                'R.uri as recording, R.meta ',
                'S.name as site, S.site_id',
                'PMR.denorm_recording_datetime as datetime',
            );

            if(show.datetime){
                builder.addProjection('R.`datetime`');
            }

            if (show.url) {
                builder.addProjection('R.`recording_id` as recording_id');
            }
            if (!show.url) {
                builder.addProjection('PMR.`uri`');
            }
            if (show.showSpecies) {
                builder.addTable('JOIN species Sp ON PMR.species_id = Sp.species_id');
                builder.addTable('JOIN songtypes St ON PMR.songtype_id = St.songtype_id');
                builder.addProjection('Sp.scientific_name as species, St.songtype as songtype');
            }
            if (show.showFrequency) {
                builder.addProjection('R.sample_rate as sample_rate');
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

            builder.addConstraint("PMR.pattern_matching_id = ?", [ parameters.patternMatching ]);

            if (parameters.site) {
                builder.addConstraint("PMR.denorm_site_id = ?", [ parameters.site ]);
            }

            if (parameters.sites) {
                builder.addConstraint("PMR.denorm_site_id IN ?", [ parameters.sites ]);
            }

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

            if (parameters.show.totalPerSite) {
                builder.addProjection(
                    "(\n" +
                    "    SELECT count(*) as count \n" +
                    "    FROM pattern_matching_rois sq2PMR\n" +
                    "    WHERE sq2PMR.denorm_site_id = PMR.denorm_site_id\n" +
                    "      AND sq2PMR.pattern_matching_id = " + (parameters.patternMatching | 0)+ "\n" +
                    ") as countPerSite"
                );
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

            return Promise.all(presteps).then(() => builder);
        });
    },

    getPmId: function (job_id) {
        const sql = `SELECT pattern_matching_id, deleted FROM pattern_matchings WHERE job_id = ${job_id}`
        return dbpool.query(sql).get(0);
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

    getPMjobId: function (patternMatchingId) {
        return dbpool.query(
            "SELECT job_id FROM pattern_matchings WHERE pattern_matching_id = ?", [patternMatchingId]
        ).get(0);
    },

    getPresentRois: function (patternMatchingId) {
        const q = `SELECT pattern_matching_roi_id as id, pattern_matching_id, recording_id, species_id, songtype_id, validated
        FROM pattern_matching_rois
        WHERE pattern_matching_id = ${patternMatchingId} AND validated = 1;`
        return dbpool.query(q)
    },

    unvalidateRois: async function (patternMatchingId, userId, projectId) {
        const rois = await PatternMatchings.getPresentRois(patternMatchingId)
        const ids = rois.map(roi => { return roi.id })
        PatternMatchings.validateRois(patternMatchingId, ids, null)
            .then(async function(validatedRois) {
                for (let roi of rois) {
                    const previousValidation = roi.validated;
                    await models.recordings.validate({id: roi.recording_id}, userId, projectId,
                        { class: `${roi.species_id}-${roi.songtype_id}`, val: null, oldVal: previousValidation, review: true})
                }
            })
    },

    __parse_meta_data : function(data) {
        try {
            const parsedData = JSON.parse(data);
            if (!parsedData) {
                return data;
            }
            return parsedData;
        } catch (e) {
            return null;
        }
    },

    getRoisForId(options) {
        let sortBy = [['S.name', 1], ['R.datetime', 1]] // default sorting
        if (options.byScore || options.byScorePerSite) {
            sortBy = [['PMR.score', 0]]
        }
        return this.buildRoisQuery({
            patternMatching: options.patternMatchingId,
            site: options.site,
            sites: options.sites,
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
            show: { patternMatchingId: true, datetime: true, names: options.showNames, totalPerSite: options.byScorePerSite },
            sortBy,
        }).then((builder) => {
            return dbpool.query(builder.getSQL())
        })
        .then(this.completePMRResults)
        .then(function (results) {
            // Fill the original filename from the meta column.
            for (let _1 of results) {
                _1.meta = _1.meta ? PatternMatchings.__parse_meta_data(_1.meta) : null;
                _1.recording = _1.meta && _1.meta.filename? _1.meta.filename : _1.recording;
            }
            return results;
        });
    },

    getSitesForPM (pmId) {
        return dbpool.query(`SELECT site_id, name as site FROM sites
            WHERE site_id IN (SELECT DISTINCT denorm_site_id FROM pattern_matching_rois WHERE pattern_matching_id = ?);`, [pmId])
            .then((sites) => {
                return sites.sort((a, b) => a.site.localeCompare(b.site))
            })
    },

    async getPmRois (req) {
        let rois = []
        let sites = [undefined] // a hack to make a loop workable even if no sites are specified
        if (req.query.site) {
            sites = [req.query.site]
        }
        if (req.query.sites) {
            sites = req.query.sites.split(',')
        }
        for (let site of sites) {
            const opts = {
                patternMatchingId: req.params.patternMatching,
                site: site,
                limit: req.paging.limit || 100
            }
            switch (req.query.search) {
                case 'best_per_site':
                case 'top_200_per_site':
                    rois = rois.concat(await this.getTopRoisByScoresPerSite(opts));
                    break;
                case 'best_per_site_day':
                    rois = rois.concat(await this.getTopRoisByScoresPerSiteDay(opts));
                    break;
                default:
                    rois = rois.concat(await this.getRoisForId({
                        ...opts,
                        wherePresent: req.query.search == 'present',
                        whereNotPresent: req.query.search == 'not_present',
                        whereUnvalidated: req.query.search == 'unvalidated',
                        byScorePerSite: req.query.search == 'by_score_per_site',
                        byScore: req.query.search == 'by_score',
                        offset: req.paging.offset || 0,
                    }))
            }
        }
        return rois
    },

    pmrSqlSelect: `SELECT S.site_id, S.name as site, PMR.score, R.uri as recording, PMR.pattern_matching_roi_id as id, PMR.pattern_matching_id,
        PMR.denorm_recording_datetime as datetime, PMR.recording_id, PMR.species_id, PMR.songtype_id, PMR.x1, PMR.y1, PMR.x2, PMR.y2, PMR.uri,
        PMR.score, PMR.validated FROM pattern_matching_rois AS PMR`,

    combineDatetime (pmr) {
        const d = pmr.datetime.toISOString()
        pmr.year = parseInt(d.substring(0, 4))
        pmr.month = parseInt(d.substring(5, 7))
        pmr.day = parseInt(d.substring(8, 10))
        pmr.hour = parseInt(d.substring(11, 13))
        pmr.minute = parseInt(d.substring(14, 16))
    },

    completePMRResults (pmrs) {
        pmrs.forEach(function(pmr) {
            const namePartials = pmr.recording.split('/')
            pmr.recording = namePartials[namePartials.length - 1]
            PatternMatchings.combineDatetime(pmr);
        })
        return pmrs
    },

    exportDataFormatted (pmr, projectUrl) {
        PatternMatchings.combineDatetime(pmr);
        delete pmr.datetime;
        if (pmr.recording_id) {
            pmr.url = `${config('hosts').publicUrl}/legacy-api/project/${projectUrl}/recordings/download/${pmr.recording_id}`;
            delete pmr.recording_id;
        }
        if (pmr.sample_rate) {
            pmr.frequency = pmr.sample_rate / 2;
            delete pmr.sample_rate;
        }
        pmr.meta = pmr.meta ? PatternMatchings.__parse_meta_data(pmr.meta) : null;
        const namePartials = pmr.recording.split('/');
        pmr.recording = pmr.meta && pmr.meta.filename? pmr.meta.filename : namePartials[namePartials.length - 1];
        delete pmr.meta;
    },

    getTopRoisByScoresPerSite (opts) {
        const base = `${this.pmrSqlSelect}
            JOIN recordings AS R ON R.recording_id = PMR.recording_id
            JOIN sites AS S ON PMR.denorm_site_id = S.site_id
            WHERE PMR.pattern_matching_id = ? AND PMR.denorm_site_id = ?
            ORDER BY PMR.score DESC LIMIT ?`
        return dbpool.query({ sql: base, typeCast: sqlutil.parseUtcDatetime }, [opts.patternMatchingId, opts.site, opts.limit || 200])
            .then(this.completePMRResults)
    },

    getTopRoisByScoresPerSiteDay (opts) {
        const pmId = opts.patternMatchingId
        const site = opts.site
        const base = `${this.pmrSqlSelect}
            JOIN (
                SELECT MAX(score) as max_score, denorm_recording_date
                FROM pattern_matching_rois
                WHERE pattern_matching_id = ? AND denorm_site_id = ?
                GROUP BY denorm_recording_date
            ) pmr2
            ON PMR.denorm_recording_date = pmr2.denorm_recording_date AND PMR.score = pmr2.max_score
            JOIN recordings AS R ON R.recording_id = PMR.recording_id
            JOIN sites AS S ON PMR.denorm_site_id = S.site_id
            WHERE PMR.pattern_matching_id = ? AND PMR.denorm_site_id = ?;`
        return dbpool.query({ sql: base, typeCast: sqlutil.parseUtcDatetime }, [pmId, site, pmId, site])
            .then((data) => {
                const pmrs = this.completePMRResults(data)
                return pmrs.sort((a, b) => {
                    return a.datetime.valueOf() - b.datetime.valueOf();
                })
            })
    },

    getRoiAudioFile(patternMatching, roiId, options){
        options = options || {};
        return dbpool.query(
            "SELECT PMR.x1, PMR.x2, PMR.y1, PMR.y2, PMR.uri as imgUri, R.sample_rate, R.uri as recUri,\n" +
                "R.site_id as recSiteId, R.datetime, R.datetime_utc, S.external_id\n" +
            "FROM pattern_matching_rois PMR\n" +
            "JOIN recordings R ON PMR.recording_id = R.recording_id\n" +
            "JOIN sites S ON S.site_id = R.site_id\n" +
            "WHERE PMR.pattern_matching_id = ? AND PMR.pattern_matching_roi_id = ?", [
                patternMatching, roiId
            ]
        ).get(0).then(function(pmr){
            if(!pmr){
                return;
            }
            const freq_max = (pmr.sample_rate && (pmr.y2 > pmr.sample_rate / 2)) ? (pmr.sample_rate / 2) : pmr.y2
            const opts = {
                uri: pmr.recUri,
                site_id: pmr.recSiteId,
                external_id: pmr.external_id,
                datetime: pmr.datetime,
                datetime_utc: pmr.datetime_utc
            }
            const filter = {
                maxFreq: Math.max(pmr.y1, freq_max),
                minFreq: Math.min(pmr.y1, freq_max),
                gain: options.gain || 1,
                trim: {
                    from: Math.min(pmr.x1, pmr.x2),
                    to: Math.max(pmr.x1, pmr.x2)
                }
            }

            return q.ninvoke(Recordings, 'fetchAudioFile', opts, filter);
        })
    },

    exportRois(patternMatchingId, filters, options){
        filters = filters || {};
        options = options || {};

        return this.buildRoisQuery({
            patternMatching: patternMatchingId,
            hideNormalValidations: options.hideNormalValidations,
            expertCSValidations: options.expertCSValidations,
            countCSValidations: options.countCSValidations,
            perUserCSValidations: options.perUserCSValidations,
            show: { names: true, url: true, showSpecies: true, showFrequency: true },
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

    updateJobName(patternMatchingId, name){
        return dbpool.query(
            "UPDATE pattern_matchings\n" +
            "SET name = ?\n" +
            "WHERE pattern_matching_id = ?", [
            name,
            patternMatchingId
        ])
    },

    getRoi(patternMatchingId, roisId){
        return dbpool.query(
            "SELECT *\n" +
            "FROM pattern_matching_rois\n" +
            "WHERE pattern_matching_id = ? AND pattern_matching_roi_id IN (?)", [
            patternMatchingId, roisId
        ]);
    },

    getCountRoisMatchByAttr(patternMatchingId, recordingId, validation){
        return dbpool.query(
            "SELECT count(*) as count\n" +
            "FROM pattern_matching_rois\n" +
            "WHERE pattern_matching_id = ? AND recording_id = ?\n" +
            "AND species_id = ? AND songtype_id = ?", [
            patternMatchingId, recordingId, validation.speciesId, validation.songtypeId,
        ]);
    },

    getPatternMatchingRois: function(options) {
        const base = `SELECT * FROM pattern_matching_rois`;
        if (options.rois) {
            return dbpool.query({ sql: `${base} WHERE pattern_matching_roi_id IN (?)` , typeCast: sqlutil.parseUtcDatetime }, [options.rois]);
        }
        if (options.rec_id && !options.validated) {
            return dbpool.query({ sql: `${base} WHERE recording_id = ?` , typeCast: sqlutil.parseUtcDatetime }, [options.rec_id]);
        }
        if (options.rec_id && options.validated) {
            return dbpool.query(
                { sql: `SELECT PMR.*, SP.scientific_name as species_name, ST.songtype as songtype_name
                FROM pattern_matching_rois PMR
                JOIN species SP ON PMR.species_id = SP.species_id
                JOIN songtypes ST ON PMR.songtype_id = ST.songtype_id
                WHERE recording_id = ? AND validated = ?`,
                typeCast: sqlutil.parseUtcDatetime }, [options.rec_id, options.validated]
            );
        }
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
