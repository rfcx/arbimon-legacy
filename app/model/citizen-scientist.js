/* jshint node:true */
"use strict";

// 3rd party dependencies
var joi     = require('joi');
var debug = require('debug')('arbimon2:model:citizen-scientist');
var q = require('q');
var dbpool = require('../utils/dbpool');

// exports
var CitizenScientist = {
    getClassificationStats: function(options){
        var select = [
            "Sp.species_id",
            "Sp.scientific_name as `species`",
            "St.songtype_id",
            "St.songtype",
            "SUM(IF(PMR.validated = 1, 1, 0)) as present",
            "SUM(IF(PMR.validated = 0, 1, 0)) as notPresent",
            "SUM(IF(PMR.validated IS NULL, 1, 0)) as notValidated",
            "COUNT(*) as `count`"
        ];

        var tables = [
            "pattern_matchings AS PM",
            "JOIN pattern_matching_rois AS PMR ON PM.pattern_matching_id = PMR.pattern_matching_id",
            "JOIN species AS Sp ON PMR.species_id = Sp.species_id",
            "JOIN songtypes AS St ON PMR.songtype_id = St.songtype_id",
        ];

        var constraints = [
            "PM.project_id = ?"
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
            "PMUS.user_id",
            "CONCAT(U.firstname, ' ', U.lastname) as user",
            "SUM(PMUS.validated) as validated",
            "SUM(PMUS.correct) as correct",
            "SUM(PMUS.incorrect) as incorrect",
            "MIN(PMUS.last_update) as last_update",
        ];

        var tables = [
            "pattern_matching_user_statistics AS PMUS",
            "JOIN users AS U ON PMUS.user_id = U.user_id",
        ];

        var constraints = [
            "PMUS.project_id = ?",
        ];

        var data = [options.project];

        var groupby = [];

        if (options.user){
            constraints.push('PMUS.user_id = ?');
            data.push(options.user);
        }

        if (options.groupBySpecies){
            select.unshift(
                "Sp.species_id",
                "Sp.scientific_name as `species`",
                "St.songtype_id",
                "St.songtype"
            );
            tables.push(
                'JOIN species Sp ON Sp.species_id = PMUS.species_id',
                'JOIN songtypes St ON St.songtype_id = PMUS.songtype_id'
            );
            groupby.push('Sp.species_id', 'Sp.songtype_id');
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
        return Promise.all([
            dbpool.query(
                "SELECT citizen_scientist_validation_consensus_number as consensus_number\n" +
                "FROM projects\n" +
                "WHERE project_id = ?", [
                project_id
            ]).get(0),
            dbpool.query(
                "SELECT pattern_matching_id\n" +
                "FROM pattern_matchings\n" +
                "WHERE citizen_scientist = 1"
            ),
        ]).then(([project_settings, pattern_matchings]) => {
            return Object.assign({}, project_settings, {
                pattern_matchings: pattern_matchings.map(pm => pm.pattern_matching_id),
            });
        });
    },

    SETTINGS_SCHEMA: joi.object().keys({
        project: joi.number().integer(),
        consensus_number: joi.number().integer(),
        pattern_matchings: joi.array().items(joi.number().integer()),
    }),

    setSettings: function(settings){
        return q.ninvoke(joi, 'validate', settings, CitizenScientist.SETTINGS_SCHEMA).then(function(){
            settings.pattern_matchings.unshift(-1, 0);
            return Promise.all([
                dbpool.query(
                    "UPDATE projects\n" +
                    "SET citizen_scientist_validation_consensus_number=?\n" +
                    "WHERE project_id=?\n", [
                    settings.consensus_number,
                    settings.project
                ]),
                dbpool.query(
                    "UPDATE pattern_matchings\n" +
                    "SET citizen_scientist = pattern_matching_id IN (?)\n" +
                    "WHERE project_id=?\n", [
                    settings.pattern_matchings,
                    settings.project
                ]),
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
        ) : Promise.resolve()).then(function(){
        });
    },

};


module.exports = CitizenScientist;
