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
            "audio_event_detections_clustering A"
        ];
        if(!options){
            options = {};
        }
        select.push(
            "A.`recording_id` as `rec_id`",
            "JP.name, JP.parameters",
        );
        tables.push("JOIN job_params_audio_event_detection_clustering JP ON A.job_id = JP.job_id");

        select.push("J.`date_created` as `timestamp`",);
        tables.push("JOIN jobs J ON A.job_id = J.job_id");

        select.push(
            "P.playlist_id, P.`name` as `playlist_name`",
        );
        tables.push("JOIN playlists P ON JP.playlist_id = P.playlist_id");

        select.push(
            "JP.user_id",
            "CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) AS user"
        );
        tables.push("JOIN users U ON JP.user_id = U.user_id");

        if (options.project_id) {
            tables.push("JOIN recordings R ON A.recording_id = R.recording_id");
            tables.push("JOIN sites S ON R.site_id = S.site_id");
            constraints.push('S.project_id = ' + dbpool.escape(options.project_id));
        }

        if (options.rec_id) {
            select.push(
                "A.`time_min` as `time_min`",
                "A.`time_max` as `time_max`",
                "A.`frequency_min` as `freq_min`",
                "A.`frequency_max` as `freq_max`"
            );
            constraints.push('A.recording_id = ?');
            data.push(options.rec_id);
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

    findClusteredRecords: function (options) {
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
        project    : joi.number().integer(),
        user       : joi.number().integer(),
        name       : joi.string(),
        playlist   : joi.number().integer(),
        params     : joi.object().keys({
            amplitudeThreshold: joi.number(),
            sizeThreshold: joi.number(),
            filterSize: joi.number()
        }),
    }),

    requestNewAudioEventDetectionClusteringJob: function(data){
        let payload = JSON.stringify({
            project_id: data.project,
            user_id: data.user,
            playlist_id: data.playlist,
            name: data.name,
            amplitude_threshold: data.params.amplitudeThreshold,
            size_threshold: data.params.sizeThreshold,
            filter_size: data.params.filterSize
        })
        return q.ninvoke(joi, 'validate', data, AudioEventDetectionsClustering.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').audio_event_detections,
            InvocationType: 'Event',
            Payload: payload,
        }).promise());
    },
};

module.exports = AudioEventDetectionsClustering;
