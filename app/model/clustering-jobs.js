/* jshint node:true */
"use strict";

var joi = require('joi');
var AWS = require('aws-sdk');
var q = require('q');
var lambda = new AWS.Lambda();
var config = require('../config');
var dbpool       = require('../utils/dbpool');

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
            "WHERE " + constraints.join(" AND ")
        ))
    },
  
    findOne: function (job_id, options) {
        options.job_id = job_id;
        return ClusteringJobs.find(options).then(function(rows){
            return rows[0];
        });
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
