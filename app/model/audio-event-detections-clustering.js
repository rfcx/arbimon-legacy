/* jshint node:true */
"use strict";

var joi = require('joi');
var AWS = require('aws-sdk');
var q = require('q');
var lambda = new AWS.Lambda();
var config = require('../config');
var dbpool       = require('../utils/dbpool');

var AudioEventDetectionsClustering = {
    find: function (options) {
        var constraints=['1=1'];
        var postprocess=[];
        var groupby = [];
        var data=[];
        var select = [];
        var tables = [
            "job_params_audio_event_detection_clustering JP"
        ];

        if(!options){
            options = {};
        }

        if (options.project_id) {
            constraints.push('JP.project_id = ' + dbpool.escape(options.project_id));
        }

        select.push("JP.job_id, JP.name");

        if (!options.playlist && options.dataExtended) {
            select.push("JP.parameters");
            select.push("JP.`date_created` as `timestamp`");
            select.push("P.playlist_id, P.`name` as `playlist_name`");
            tables.push("JOIN playlists P ON JP.playlist_id = P.playlist_id");
        }

        if (options.user) {
            select.push(
                "JP.user_id",
                "CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) AS user"
            );
            tables.push("JOIN users U ON JP.user_id = U.user_id");
        }

        if (options.rec_id || options.playlist) {
            select.push(
                "A.`time_min` as `time_min`",
                "A.`time_max` as `time_max`",
                "A.`frequency_min` as `freq_min`",
                "A.`frequency_max` as `freq_max`"
            );
            tables.push("JOIN audio_event_detections_clustering A ON JP.job_id = A.job_id");
        }

        if (options.rec_id) {
            select.push("A.`recording_id` as `rec_id`");
            constraints.push('A.recording_id = ?');
            data.push(options.rec_id);
        }

        if (options.playlist) {
            select.push('A.aed_id, A.`recording_id` as `rec_id`');
            constraints.push('JP.playlist_id = ' + dbpool.escape(Number(options.playlist)));
        }

        if (options.dataExtended) {
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
        }

        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" \n  AND ") + (
                groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "" + "\n" +
            !!options.playlist ? "" : "ORDER BY timestamp DESC"
            ), data
        ))
    },

    findClusteredDetections: function (options) {
        var constraints=['1=1'];
        var select = [];
        var tables = [
            "audio_event_detections_clustering A"
        ];
        if(!options){
            options = {};
        }
        select.push(
            'A.aed_id, A.`recording_id` as `rec_id`',
            "A.`time_min` as `time_min`",
            "A.`time_max` as `time_max`",
            "A.`frequency_min` as `freq_min`",
            "A.`frequency_max` as `freq_max`",
            "A.`uri_image` as `uri`"
        );

        if (options.aed_id) {
            constraints.push('A.aed_id = ' + dbpool.escape(options.aed_id));
        } else if (options.aed_id_in) {
            if(!options.aed_id_in.length){
                constraints.push('1 = 0');
            } else {
                let arr = options.aed_id_in.map(x => parseInt(x));
                constraints.push('A.aed_id IN (' + dbpool.escape(arr) + ')');
            }
        }
        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" AND ")
        )
    },

    JOB_SCHEMA : joi.object().keys({
        user_id: joi.number().integer(),
        name: joi.string(),
        playlist_id: joi.number().integer(),
        params     : joi.object().keys({
            amplitudeThreshold: joi.number(),
            sizeThreshold: joi.number(),
            filterSize: joi.number(),
        }),
    }),

    requestNewAudioEventDetectionClusteringJob: function(data){
        let payload = JSON.stringify(
            {
                'name': data.name,
                'playlist_id': data.playlist_id,
                'user_id': data.user_id,
                'Amplitude Threshold': data.params.amplitudeThreshold,
                'Size Threshold': data.params.sizeThreshold,
                'Filter Size': data.params.filterSize
            }
        )
        return q.ninvoke(joi, 'validate', data, AudioEventDetectionsClustering.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').audio_event_detections,
            InvocationType: 'Event',
            Payload: payload,
        }).promise());
    },
};

module.exports = AudioEventDetectionsClustering;
