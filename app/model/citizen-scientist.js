/* jshint node:true */
"use strict";

// 3rd party dependencies
var joi     = require('joi');
var debug = require('debug')('arbimon2:model:citizen-scientist');
var q = require('q');
var dbpool = require('../utils/dbpool');
var PatternMatchings = require('./pattern_matchings');

// exports
var CitizenScientist = {
    getClassificationStats: function(options){
        var select = [
            "Sp.species_id",
            "Sp.scientific_name as `species`",
            "St.songtype_id",
            "St.songtype",
            "SUM(IF(PMR.consensus_validated = 1, 1, 0)) as present",
            "SUM(IF(PMR.consensus_validated = 0, 1, 0)) as notPresent",
            "SUM(IF(PMR.consensus_validated IS NULL, 1, 0)) as notValidated",
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
            "COUNT(DISTINCT PMUS.species_id, PMUS.songtype_id) as species",
            "SUM(PMUS.validated) as validated",
            "SUM(PMUS.correct) as correct",
            "SUM(PMUS.incorrect) as incorrect",
            "MIN(PMUS.last_update) as last_update",
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

        if(options.showUser) {
            select.push(
                "PMUS.user_id",
                "CONCAT(U.firstname, ' ', U.lastname) as user"
            );
            tables.push("JOIN users AS U ON PMUS.user_id = U.user_id")
        }

        if (options.user){
            constraints.push('PMUS.user_id = ?');
            data.push(options.user);
        }

        if (options.groupBySpecies){
            select.unshift(
                "Sp.species_id",
                "Sp.scientific_name as `species_name`",
                "St.songtype_id",
                "St.songtype"
            );
            tables.push(
                'JOIN species Sp ON Sp.species_id = PMUS.species_id',
                'JOIN songtypes St ON St.songtype_id = PMUS.songtype_id'
            );
            groupby.push('Sp.species_id', 'St.songtype_id');
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

    getSettings: function(project_id){
        return PatternMatchings.find({
            project: project_id,
            showConsensusNumber: true,
        });
    },

    SETTINGS_SCHEMA: joi.object().keys({
        project: joi.number().integer(),
        pattern_matchings: joi.array().items(joi.object().keys({
            id: joi.number().integer(),
            consensus_number: joi.number().integer(),
        })),
    }),

    setSettings: function(settings){
        return q.ninvoke(joi, 'validate', settings, CitizenScientist.SETTINGS_SCHEMA).then(function(){
            var ids = settings.pattern_matchings.map(pm => pm.id);
            ids.unshift(-1, 0);
            return dbpool.query(
                "UPDATE pattern_matchings\n" +
                "SET citizen_scientist = pattern_matching_id IN (?),\n" +
                "consensus_number = (CASE pattern_matching_id\n" +
                "    WHEN -1 THEN 3\n" +
                settings.pattern_matchings.map(pm =>
                    "    WHEN " + (pm.id | 0) + " THEN " + (pm.consensus_number | 0) + "\n"
                ).join("") +
                "    ELSE 3\n" +
                "END)\n" +
                "WHERE project_id=?\n", [
                ids,
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
            return this.computeUserStats(patternMatchingId, userId);
        });
    },

    expertValidateCSRois(patternMatchingId, rois, validation){
        return rois.length ? dbpool.query(
            "UPDATE pattern_matching_rois\n" +
            "SET expert_validated = ?\n" +
            "WHERE pattern_matching_id = ?\n" +
            "AND pattern_matching_roi_id IN (?)", [
            validation,
            patternMatchingId,
            rois,
        ]) : Promise.resolve();
    },

    computeConsensusValidations(patternMatchingId, rois){
        return dbpool.query(
            "UPDATE pattern_matching_rois\n" +
            "  JOIN pattern_matchings ON pattern_matching_rois.pattern_matching_id = pattern_matchings.pattern_matching_id\n" +
            "SET pattern_matching_rois.consensus_validated =  IF(\n" +
            "    (\n" +
            "		SELECT COUNT(*) FROM pattern_matching_validations PMV\n" +
            "		WHERE PMV.pattern_matching_roi_id = pattern_matching_rois.pattern_matching_roi_id AND PMV.validated = 1\n" +
            " 	 ) >= pattern_matchings.consensus_number, \n" +
            "    1,\n" +
            "    IF(\n" +
            "		(\n" +
            "			SELECT COUNT(*) FROM pattern_matching_validations PMV\n" +
            "			WHERE PMV.pattern_matching_roi_id = pattern_matching_rois.pattern_matching_roi_id AND PMV.validated = 0\n" +
            "		) >= pattern_matchings.consensus_number, \n" +
            "		0,\n" +
            "		pattern_matching_rois.validated\n" +
            "    )\n" +
            ")\n" +
            "WHERE pattern_matching_rois.pattern_matching_id = ?\n" +
            "  AND pattern_matching_rois.pattern_matching_roi_id IN (?)\n" +
            "  AND pattern_matching_rois.validated IS NULL", [
            patternMatchingId,
            rois
        ]);
    },

    computeUserStats(patternMatchingId, userId){
        return dbpool.query(
            "SELECT P.project_id, P.species_id, P.songtype_id\n" +
            "FROM pattern_matchings P\n" +
            "WHERE P.pattern_matching_id = ?", [
            patternMatchingId
        ]).get(0).then((pm) => {
            return dbpool.query(
                "INSERT INTO pattern_matching_user_statistics(\n" +
                "    user_id, project_id, species_id, songtype_id,\n" +
                "    validated, correct, incorrect,\n" +
                "    confidence,\n" +
                "    last_update\n" +
                ") SELECT \n" +
                "    Q.user_id, Q.project_id, Q.species_id, Q.songtype_id, \n" +
                "    Q.validated, Q.correct, Q.incorrect,\n" +
                "    (Q.correct + 1) / (Q.correct + Q.incorrect + 1),\n" +
                "    NOW()\n" +
                "FROM (\n" +
                "    SELECT PMV.user_id, P.project_id, P.species_id, P.songtype_id,\n" +
                "        COUNT(PMV.validated) as validated,\n" +
                "        SUM(IF(PMV.validated = PMR.consensus_validated, 1, 0)) as correct,\n" +
                "        SUM(IF(PMV.validated != PMR.consensus_validated, 1, 0)) as incorrect\n" +
                "    FROM pattern_matchings P\n" +
                "    JOIN pattern_matching_rois PMR ON P.pattern_matching_id = PMR.pattern_matching_id\n" +
                "    JOIN pattern_matching_validations PMV ON PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id\n" +
                "    WHERE P.project_id = ? AND P.species_id = ? AND P.songtype_id = ?\n" +
                "    GROUP BY PMV.user_id\n" +
                ") Q\n" +
                "ON DUPLICATE KEY UPDATE\n" +
                "    validated=VALUES(validated), correct=VALUES(correct), incorrect=VALUES(incorrect),\n" +
                "    confidence=VALUES(confidence),\n" +
                "    last_update=VALUES(last_update)\n" +
                "", [
                    pm.project_id, pm.species_id, pm.songtype_id,
                ]);
        });
    },

};


module.exports = CitizenScientist;
