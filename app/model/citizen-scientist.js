/* jshint node:true */
"use strict";

// 3rd party dependencies
var joi     = require('joi');
var debug = require('debug')('arbimon2:model:citizen-scientist');
var q = require('q');
var dbpool = require('../utils/dbpool');
var sqlutil      = require('../utils/sqlutil');
var PatternMatchings = require('./pattern_matchings');

// exports
var CitizenScientist = {
    getClassificationStats: function(options){
        var select = [
            "Sp.species_id",
            "Sp.scientific_name as `species`",
            "St.songtype_id",
            "St.songtype",
            "SUM(IF(PMR.expert_validated = 1, 1, IF(PMR.expert_validated IS NULL AND PMR.consensus_validated = 1, 1, 0))) as present",
            "SUM(IF(PMR.expert_validated = 0, 1, IF(PMR.expert_validated IS NULL AND PMR.consensus_validated = 0, 1, 0))) as notPresent",
            "SUM(IF(PMR.expert_validated IS NULL AND PMR.consensus_validated IS NULL AND PMR.cs_val_present + PMR.cs_val_not_present > 0, 1, 0)) as pending",
            "SUM(IF(PMR.expert_validated IS NULL AND PMR.consensus_validated IS NULL AND PMR.cs_val_present + PMR.cs_val_not_present = 0, 1, 0)) as notValidated",
            "COUNT(PMR.consensus_validated) as reached_th",
            "COUNT(PMR.expert_validated IS NOT NULL) as expert_val",
            "COUNT(*) as `count`"
        ];

        var tables = [
            "pattern_matchings AS PM",
            "JOIN pattern_matching_rois_new AS PMR ON PM.pattern_matching_id = PMR.pattern_matching_id",
            "JOIN species AS Sp ON PMR.species_id = Sp.species_id",
            "JOIN songtypes AS St ON PMR.songtype_id = St.songtype_id",
        ];

        var constraints = [
            "PM.project_id = ?",
            "PM.deleted = 0"
        ];

        var data = [options.project];

        var groupby = [];

        if (options.species){
            constraints.push('Sp.species_id = ?');
            data.push(options.species);
        }

        if (options.songtype){
            constraints.push('Sp.songtype_id = ?');
            data.push(options.songtype);
        }

        groupby.push('PM.species_id');
        groupby.push('PM.songtype_id');

        if (options.groupByMatching){
            select.unshift('PM.pattern_matching_id', 'PM.name');
            groupby.push('PM.pattern_matching_id');
        }

        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" \n  AND ") + (
                groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : ""
            ),
            data
        );
    },

    getUserStats: function(options){
        var select = [
            "SUM(PMUS.validated) as validated",
            "SUM(PMUS.correct) as consensus",
            "SUM(PMUS.incorrect) as non_consensus",
            "SUM(PMUS.correct + PMUS.incorrect) as reached_th",
            "SUM(PMUS.pending) as pending",
        ];

        var tables = [
            "pattern_matching_user_statistics AS PMUS",
        ];

        var constraints = [
            "PMUS.project_id = ?",
        ];

        var data = [options.project];

        var groupby = [];

        if(options.groupByUser) {
            groupby.push('PMUS.user_id');
        }

        if(!options.hideSpeciesCount) {
            select.push("COUNT(DISTINCT PMUS.species_id, PMUS.songtype_id) as species");
        }

        if(!options.hideLastUpdate) {
            select.push("MIN(PMUS.last_update) as last_update");
        }

        if(options.showUser) {
            if(!options.hideUserId){
                select.unshift(
                    "PMUS.user_id"
                );
            }
            select.push(
                "CONCAT(U.firstname, ' ', U.lastname) as user"
            );
            tables.push("JOIN users AS U ON PMUS.user_id = U.user_id")
        }

        if (options.user){
            constraints.push('PMUS.user_id = ?');
            data.push(options.user);
        }

        if (options.groupBySpecies){
            if(!options.hideSpeciesIds){
                select.unshift(
                    "Sp.species_id",
                    "St.songtype_id",
                );
            }
            select.unshift(
                "Sp.scientific_name as `" + (options.hideSpeciesCount ? 'species' : 'species_name') + "`",
                "St.songtype"
            );
            tables.push(
                'JOIN species Sp ON Sp.species_id = PMUS.species_id',
                'JOIN songtypes St ON St.songtype_id = PMUS.songtype_id'
            );
            groupby.push('Sp.species_id', 'St.songtype_id');
        }

        var query = (
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" \n  AND ") + (
                groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : ""
            )
        );

        if (options.streamQuery){
            return dbpool.streamQuery({
                sql: query,
                typeCast: sqlutil.parseUtcDatetime,
            }, data);
        } else {
            return dbpool.query(query, data);
        }
    },


    getSettings: function(project_id){
        return PatternMatchings.find({
            project: project_id,
            deleted: 0,
            showSpecies: true,
            showConsensusNumber: true,
        });
    },

    SETTINGS_SCHEMA: joi.object().keys({
        project: joi.number().integer(),
        pattern_matchings: joi.array().items(joi.object().keys({
            id: joi.number().integer(),
            citizen_scientist: joi.boolean(),
            cs_expert: joi.boolean(),
            consensus_number: joi.number().integer(),
        })),
    }),

    setSettings: function(settings){
        return q.ninvoke(joi, 'validate', settings, CitizenScientist.SETTINGS_SCHEMA).then(function(){
            var ids = settings.pattern_matchings.filter(pm => pm.citizen_scientist).map(pm => pm.id);
            var csxids = settings.pattern_matchings.filter(pm => pm.cs_expert).map(pm => pm.id);
            ids.unshift(-1, 0);
            csxids.unshift(-1, 0);
            return dbpool.query(
                "UPDATE pattern_matchings\n" +
                "SET citizen_scientist = pattern_matching_id IN (?),\n" +
                "cs_expert = pattern_matching_id IN (?),\n" +
                "consensus_number = (CASE pattern_matching_id\n" +
                "    WHEN -1 THEN 3\n" +
                settings.pattern_matchings.map(pm =>
                    "    WHEN " + (pm.id | 0) + " THEN " + (pm.consensus_number | 0) + "\n"
                ).join("") +
                "    ELSE 3\n" +
                "END)\n" +
                "WHERE project_id=?\n", [
                ids,
                csxids,
                settings.project
            ]);
        });
    },

    validateCSRois(patternMatchingId, userId, rois, validation){
        return (rois.length ? dbpool.query(
            "INSERT INTO pattern_matching_validations(\n" +
            "    pattern_matching_roi_id, user_id, validated, timestamp\n" +
            ") VALUES (\n" + rois.map(function(roi) {
                return "   ?, ?, ?, NOW()\n";
            }).join("), (\n") +
            ")\n" +
            "ON DUPLICATE KEY UPDATE\n" +
            "    validated = VALUES(validated)", rois.reduce(function(_, roi) {
                _.push(roi, userId, validation);
                return _;
            }, [])
        ) : Promise.resolve()).then(() => {
            return this.computeConsensusValidations(patternMatchingId, rois);
        }).then(() => {
            return this.computeUserStats(patternMatchingId);
        });
    },

    expertValidateCSRois(userId, patternMatchingId, rois, validation){
        return rois.length ? dbpool.query(
            "UPDATE pattern_matching_rois_new\n" +
            "SET expert_validated = ?,\n" +
            "    expert_validation_user_id = ?\n" +
            "WHERE pattern_matching_id = ?\n" +
            "AND pattern_matching_roi_id IN (?)", [
            validation,
            userId,
            patternMatchingId,
            rois,
        ]).then(() => {
            return this.computeUserStats(patternMatchingId);
        }) : Promise.resolve();
    },

    /** Computes the current p not p stats and consensus validation state for each given roi in a given pattern matching.
    * The current consensus state is computed as following:
     *      - if number of presents is bigger than consensus number: 1 (present)
     *      - if number of not presents is bigger than consensus number: 0 (not present)
     *      - else: NULL (not consensus validated)
     * @param {int} patternMatchingId - id of the given patternMatching.
     * @param {Array[int]} rois - ids of the given rois.
     */
    computeConsensusValidations(patternMatchingId, rois){
        return dbpool.query(
            "UPDATE pattern_matching_rois_new\n" +
            "    JOIN pattern_matchings ON pattern_matching_rois_new.pattern_matching_id = pattern_matchings.pattern_matching_id\n" +
            "    LEFT JOIN (\n" +
            "        SELECT _PMV.pattern_matching_roi_id,\n" +
            "            SUM(IF(_PMV.validated = 1, 1, 0)) as cs_present,\n" +
            "            SUM(IF(_PMV.validated = 0, 1, 0)) as cs_not_present\n" +
            "        FROM pattern_matching_validations _PMV\n" +
            "        GROUP BY _PMV.pattern_matching_roi_id\n" +
            "    ) AS PMV ON PMV.pattern_matching_roi_id = pattern_matching_rois_new.pattern_matching_roi_id\n" +
            "SET \n" +
            "    pattern_matching_rois_new.cs_val_present = COALESCE(PMV.cs_present, 0),\n" +
            "    pattern_matching_rois_new.cs_val_not_present = COALESCE(PMV.cs_not_present, 0),\n" +
            "    pattern_matching_rois_new.consensus_validated = (CASE\n" +
            "        WHEN PMV.cs_present >= pattern_matchings.consensus_number THEN 1\n" +
            "        WHEN PMV.cs_not_present >= pattern_matchings.consensus_number THEN 0\n" +
            "        ELSE NULL\n" +
            "    END)\n" +
            "WHERE pattern_matching_rois_new.pattern_matching_id = ?\n" +
            "  AND pattern_matching_rois_new.pattern_matching_roi_id IN (?)", [
            patternMatchingId,
            rois
        ]);
    },

    computeUserStats(patternMatchingId){
        return dbpool.query(
            "SELECT P.project_id, P.species_id, P.songtype_id\n" +
            "FROM pattern_matchings P\n" +
            "WHERE P.pattern_matching_id = ?", [
            patternMatchingId
        ]).get(0).then((pm) => {
            return CitizenScientist.computeUserStatsForProjectSpeciesSongtype(
                pm.project_id, pm.species_id, pm.songtype_id,
            );
        });
    },

    async computeUserStatsForProjectSpeciesSongtype(project_id, species_id, songtype_id) {
        // get all possible validations from all users (using DB indexes)
        let q1 = `SELECT PMR.*, PMV.user_id, PMV.validated as validated
                    FROM pattern_matching_rois_new PMR
                    JOIN pattern_matchings P ON P.pattern_matching_id = PMR.pattern_matching_id
                    JOIN pattern_matching_validations PMV ON PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id
                    WHERE P.project_id = ? AND P.species_id = ? AND P.songtype_id = ?;`;
        let stats = await dbpool.query(q1, [ project_id, species_id, songtype_id ]);
        // collect statistics data per each user
        let userStats = {};
        stats.forEach((stat) => {
            let userId = `${stat.user_id}`;
            if (!userStats[userId]) {
                userStats[userId] = {
                    validated: 0,
                    correct: 0,
                    incorrect: 0,
                    pending: 0
                }
            }
            if (stat.validated !== null) {
                userStats[userId].validated++;
            }
            let othersValidated = (stat.expert_validated !== null || stat.consensus_validated !== null)? stat.expert_validated === 1 || stat.consensus_validated === 1 : null;
            if (othersValidated !== null) {
                if (!!stat.validated === othersValidated) {
                    userStats[userId].correct++;
                }
                if (!!stat.validated !== othersValidated) {
                    userStats[userId].incorrect++;
                }
            }
            else {
                if (stat.validated !== null) {
                    userStats[userId].pending++;
                }
            }
        })
        // save statistics data for each user
        for (let key in userStats) {
            let stat = userStats[key];
            let confidence = (stat.correct + 1) / (stat.correct + stat.incorrect + 1);
            let q2 = `INSERT INTO pattern_matching_user_statistics (user_id, project_id, species_id,
                            songtype_id, validated, correct, incorrect, pending, confidence, last_update)
                      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                      ON DUPLICATE KEY UPDATE validated=VALUES(validated), correct=VALUES(correct), incorrect=VALUES(incorrect), pending=VALUES(pending),
                            confidence=VALUES(confidence), last_update=VALUES(last_update)`;
            await dbpool.query(q2, [parseInt(key), project_id, species_id, songtype_id, stat.validated, stat.correct, stat.incorrect, stat.pending, confidence])
        }
    },

};


module.exports = CitizenScientist;
