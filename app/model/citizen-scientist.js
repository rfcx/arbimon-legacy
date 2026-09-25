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
            "JOIN pattern_matching_rois AS PMR ON PM.pattern_matching_id = PMR.pattern_matching_id",
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
        // §393 (rfcx-local OPEN-ITEMS §393, 2026-09-25): this INSERT used to
        // take the body's roi ids VERBATIM, with no link to the PM in the URL
        // -- so any caller could write a citizen-scientist validation onto
        // ANY roi of ANY project (which then feeds that project's consensus +
        // user stats) by posting its id under a PM they can open. The rois
        // are now selected FROM the PM: an id that is not one of
        // `patternMatchingId`'s rois inserts nothing. The route binds the PM
        // to the URL project, so together a write reaches only that
        // project's rois. Same shape expertValidateCSRois already had
        // (`WHERE pattern_matching_id = ? AND roi IN (?)`).
        rois = (Array.isArray(rois) ? rois : [rois]).filter(function(r) {
            return r !== undefined && r !== null && r !== '';
        });
        return (rois.length ? dbpool.query(
            "INSERT INTO pattern_matching_validations(\n" +
            "    pattern_matching_roi_id, user_id, validated, timestamp\n" +
            ")\n" +
            "SELECT PMR.pattern_matching_roi_id, ?, ?, NOW()\n" +
            "FROM pattern_matching_rois PMR\n" +
            "WHERE PMR.pattern_matching_id = ?\n" +
            "  AND PMR.pattern_matching_roi_id IN (?)\n" +
            // P7 port: ON CONFLICT targets the (pattern_matching_roi_id,
            // user_id) unique index (present on both engines).
            "ON CONFLICT (pattern_matching_roi_id, user_id) DO UPDATE SET\n    validated = EXCLUDED.validated",
            [userId, validation, patternMatchingId, rois]
        ) : Promise.resolve()).then(() => {
            return this.computeConsensusValidations(patternMatchingId, rois);
        }).then(() => {
            return this.computeUserStats(patternMatchingId);
        });
    },

    expertValidateCSRois(userId, patternMatchingId, rois, validation){
        return rois.length ? dbpool.query(
            "UPDATE pattern_matching_rois\n" +
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
        // P7 port: `UPDATE <t> JOIN <u> ... SET <t>.<col> = ...` is MySQL-only
        // STATEMENT SHAPE -- 42601 on PostgreSQL, and the translator does NOT
        // rewrite it (it rewrites EXPRESSIONS, e.g. IF() -> CASE, but not the
        // shape). Under DB_ENGINE=pg this raised a syntax error, and because
        // validateCSRois awaits this AFTER the validation INSERT, the user's
        // validation was written while the derived consensus counters silently
        // stopped tracking it -- a partial write, not a clean failure.
        //
        // PG form: UPDATE ... SET (a, b, c) = (SELECT ...) FROM pattern_matchings.
        // WHY THIS FORM AND NOT THE OBVIOUS ONES (all measured on the replica):
        //   * `FROM pattern_matchings pm LEFT JOIN (...) PMV ON ... pmr....`
        //     is ILLEGAL -- PG refuses to join the UPDATE target inside FROM
        //     ("invalid reference to FROM-clause entry for table pmr"). Same for
        //     LEFT JOIN LATERAL against the target.
        //   * The comma/derived-table form parses but INNER-joins the aggregate,
        //     which SILENTLY SKIPS rois that have no validation rows. That is not
        //     hypothetical: on a real CS pattern matching, 2000 of 2000 sampled
        //     rois had ZERO validation rows, so an inner join would have dropped
        //     every one. The original LEFT JOIN is load-bearing -- it is what
        //     resets counters to (0, 0, NULL).
        // The single multi-column assignment also evaluates the aggregate ONCE
        // per row (verified: one SubPlan returning $2,$3,$4) instead of three
        // times, and rides the existing unique index on
        // (pattern_matching_roi_id, user_id).
        //
        // Equivalence PROVEN BY EXECUTION against the frozen MariaDB on the same
        // roi ids, both row classes: unvalidated rois -> (0, 0, NULL) on both
        // engines; validated rois -> (0, 1, cn=3, NULL) on both engines.
        //
        // (Until P7 step 5 this was dual-arm: MariaDB rejected the PG
        // multi-column form with ERROR 1064, so the original JOIN...SET
        // statement rode alongside as the MariaDB arm. Retired with MariaDB.)
        const sqlPg =
            "UPDATE pattern_matching_rois\n" +
            "SET (cs_val_present, cs_val_not_present, consensus_validated) = (\n" +
            "    SELECT COALESCE(_A.cs_present, 0),\n" +
            "           COALESCE(_A.cs_not_present, 0),\n" +
            "           (CASE\n" +
            "               WHEN _A.cs_present >= pattern_matchings.consensus_number THEN 1\n" +
            "               WHEN _A.cs_not_present >= pattern_matchings.consensus_number THEN 0\n" +
            "               ELSE NULL\n" +
            "           END)\n" +
            "    FROM (\n" +
            "        SELECT SUM(CASE WHEN _PMV.validated = 1 THEN 1 ELSE 0 END) as cs_present,\n" +
            "               SUM(CASE WHEN _PMV.validated = 0 THEN 1 ELSE 0 END) as cs_not_present\n" +
            "        FROM pattern_matching_validations _PMV\n" +
            "        WHERE _PMV.pattern_matching_roi_id = pattern_matching_rois.pattern_matching_roi_id\n" +
            "    ) _A\n" +
            ")\n" +
            "FROM pattern_matchings\n" +
            "WHERE pattern_matchings.pattern_matching_id = pattern_matching_rois.pattern_matching_id\n" +
            "  AND pattern_matching_rois.pattern_matching_id = ?\n" +
            "  AND pattern_matching_rois.pattern_matching_roi_id IN (?)";

        return dbpool.query(sqlPg, [
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
                    FROM pattern_matching_rois PMR
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
            // P7 port: ON CONFLICT targets the (user_id, project_id,
            // species_id, songtype_id) unique index.
            let q2 = `INSERT INTO pattern_matching_user_statistics (user_id, project_id, species_id,
                        songtype_id, validated, correct, incorrect, pending, confidence, last_update)
                  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                  ON CONFLICT (user_id, project_id, species_id, songtype_id) DO UPDATE SET validated=EXCLUDED.validated, correct=EXCLUDED.correct, incorrect=EXCLUDED.incorrect, pending=EXCLUDED.pending,
                        confidence=EXCLUDED.confidence, last_update=EXCLUDED.last_update`;
            await dbpool.query(q2, [parseInt(key), project_id, species_id, songtype_id, stat.validated, stat.correct, stat.incorrect, stat.pending, confidence])
        }
    },

};


module.exports = CitizenScientist;
