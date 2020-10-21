/* jshint node:true */
"use strict";

var joi = require('joi');
var AWS = require('aws-sdk');
var q = require('q');
var lambda = new AWS.Lambda();
var config = require('../config');

var ClusteringModel = {

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

    requestNewClusteringModelJob: function(data){
        let payload = JSON.stringify({
            project_id: data.project,
            user_id: data.user,
            playlist_id: data.playlist,
            name: data.name,
            frequency_min: data.params.frequencyMin,
            frequency_max: data.params.frequencyMax,
        })
        return q.ninvoke(joi, 'validate', data, ClusteringModel.JOB_SCHEMA).then(() => lambda.invoke({
            FunctionName: config('lambdas').audio_event_detection,
            InvocationType: 'Event',
            Payload: payload,
        }).promise());
    },
};

module.exports = ClusteringModel;
