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
            "JP.`name` as `name`",
            "JP.`parameters` as `parameters`"
        );
        tables.push("JOIN job_params_audio_event_detection_clustering JP ON A.job_id = JP.job_id");

        select.push("J.`date_created` as `timestamp`");
        tables.push("JOIN jobs J ON A.job_id = J.job_id");

        select.push(
            "P.`playlist_id` as `playlist_id`",
            "P.`name` as `playlist_name`"
        );
        tables.push("JOIN playlists P ON JP.playlist_id = P.playlist_id");

        select.push(
            "JP.user_id",
            "CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) AS user"
        );
        tables.push("JOIN users U ON JP.user_id = U.user_id");

        if (options.project) {
            constraints.push('JP.project_id = ?');
            data.push(options.project);
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

    JOB_SCHEMA : joi.object().keys({
        project    : joi.number().integer(),
        user       : joi.number().integer(),
        name       : joi.string(),
        playlist   : joi.number().integer(),
        params     : joi.object().keys({
            frequencyMin: joi.number(),
            frequencyMax: joi.number()
        }),
    }),

    requestNewAudioEventDetectionClusteringJob: function(data){
        let payload = JSON.stringify({
            project_id: data.project,
            user_id: data.user,
            playlist_id: data.playlist,
            name: data.name,
            frequency_min: data.params.frequencyMin,
            frequency_max: data.params.frequencyMax,
        })
        return q.ninvoke(joi, 'validate', data, AudioEventDetectionsClustering.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').audio_event_detections,
            InvocationType: 'Event',
            Payload: payload,
        }).promise());
    },
};

module.exports = AudioEventDetectionsClustering;
