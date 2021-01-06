/* jshint node:true */
"use strict";

var joi = require('joi');
var AWS = require('aws-sdk');
var q = require('q');
var lambda = new AWS.Lambda();
var config = require('../config');
var dbpool = require('../utils/dbpool');
var Recordings = require('./recordings');

var ClusteringJobs = {
    find: function (options) {
        var constraints=['1=1'];
        var postprocess=[];
        var select = [];
        var tables = [
            "job_params_audio_event_clustering C"
        ];
        if(!options){
            options = {};
        }
        select.push(
            "C.name",
            "C.`audio_event_detection_job_id` as `aed_job_id`",
            "C.`job_id` as `clustering_job_id`",
            "C.parameters",
            "C.user_id",
            "CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) AS user"
        );
        tables.push("JOIN users U ON C.user_id = U.user_id");
        select.push(
            "JP.`name` as `name_aed`"
        );
        tables.push("JOIN job_params_audio_event_detection_clustering JP ON C.audio_event_detection_job_id = JP.job_id");
        select.push("J.`date_created` as `timestamp`");
        tables.push("JOIN jobs J ON C.job_id = J.job_id");

        if (options.project_id) {
            constraints.push('C.project_id = ' + dbpool.escape(options.project_id));
        }

        if (options.job_id) {
            constraints.push('C.job_id = ' + dbpool.escape(options.job_id));
        }

        postprocess.push((rows) => {
            rows.forEach(row => {
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch(e) {}
            })
            return rows;
        });

        return postprocess.reduce((_, fn) => {
            return _.then(fn);
        }, dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" AND ") + "\n" +
            "ORDER BY timestamp DESC"
        ))
    },

    findOne: function (job_id, options, callback) {
        options.job_id = job_id;
        return ClusteringJobs.find(options).then(function(rows){
            return rows[0];
        }).nodeify(callback);
    },

    findRois: function (options) {
        var constraints=['1=1'];
        var select = [];
        var groupby = [];
        var tables = [
            "audio_event_detections_clustering A"
        ];
        if(!options){
            options = {};
        }
        select.push(
            "A.aed_id, A.time_min, A.time_max, A.frequency_min, A.frequency_max, A.recording_id, A.`uri_image` as `uri`"
        );

        if (options.aed) {
            constraints.push('A.aed_id IN (' + dbpool.escape(options.aed) + ')');
        }

        if (options.perSite) {
            select.push('S.site_id, S.`name` as `site`');
            tables.push("JOIN recordings R ON A.recording_id = R.recording_id");
            tables.push("JOIN sites S ON R.site_id = S.site_id");
        }

        if (options.perDate) {
            select.push('C.`date_created`');
            tables.push("JOIN job_params_audio_event_clustering C ON A.job_id = C.audio_event_detection_job_id");
            groupby.push('A.aed_id');
        }

        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" AND ")+ "\n" +
            (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "")
        )
    },

    getRoiAudioFile: function (options) {
        options = options || {};

        var query = "SELECT A.time_min, A.time_max, A.frequency_min, A.frequency_max, R.`uri` as `rec_uri`, R.site_id\n" +
        "FROM audio_event_detections_clustering A\n" +
        "JOIN recordings R ON A.recording_id = R.recording_id\n" +
        "WHERE A.recording_id = ?";

        return dbpool.query(
            query, [
                options.recId
            ]
        ).get(0).then(function(rec) {
            if (!rec) {
                return;
            }
            return q.ninvoke(Recordings, 'fetchAudioFile', {
                uri: rec.rec_uri,
                site_id: rec.site_id
            }, {
                maxFreq: rec.frequency_min,
                minFreq: rec.frequency_max,
                gain: options.gain || 15,
                trim: {
                    from: rec.time_min,
                    to: rec.time_max
                },
            });
        })
    },

    audioEventDetections: function (options) {
        var constraints=['1=1'];
        var select = [];
        var tables = [
            "job_params_audio_event_detection_clustering JP"
        ];
        if(!options){
            options = {};
        }
        select.push(
            "JP.`name` as `name`",
            "JP.`job_id` as `job_id`",
        );

        if (options.project_id) {
            constraints.push('JP.project_id = ' + dbpool.escape(options.project_id));
        }

        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" AND ")
        )
    },

    JOB_SCHEMA : joi.object().keys({
        project: joi.number().integer(),
        name : joi.string(),
        audioEventDetectionJob: joi.object().keys({
            name: joi.string(),
            jobId: joi.number()
        }),
        params: joi.object().keys({
            minPoints: joi.number(),
            distanceThreshold: joi.number()
        }),
    }),

    requestNewClusteringJob: function(data){
        let payload = JSON.stringify({
            project_id: data.project,
            name: data.name,
            aed_job_name: data.audioEventDetectionJob.name,
            aed_job_id: data.audioEventDetectionJob.jobId,
            min_points: data.params.minPoints,
            distance_threshold: data.params.distanceThreshold,
        })
        return q.ninvoke(joi, 'validate', data, ClusteringJobs.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').clustering_jobs,
            InvocationType: 'Event',
            Payload: payload,
        }).promise());
    },
};

module.exports = ClusteringJobs;
