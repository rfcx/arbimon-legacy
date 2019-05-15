/* jshint node:true */
"use strict";

// 3rd party dependencies
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
        // return Promise.resolve({
        //     stats: ['E. Coqui', 'E. Brittoni', 'E. Juanariveroi', 'E. Cochranae', 'E. Llanero'].map(function(spp){
        //         var p = (Math.random() * 500) | 0, np = (Math.random() * 500) | 0, nv = (Math.random() * 500) | 0;
        //         return {species: spp, songtype: 'Common', present: p, notPresent: np, notValidated: nv, count: p + np + nv};
        //     })
        // });

    },

    getUserStats: function(options){
        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" \n  AND ") + (
                groupby ? ("\n" + groupby.join(",\n    ")) : ""
            ),
            data
        );
    },
};


module.exports = CitizenScientist;
