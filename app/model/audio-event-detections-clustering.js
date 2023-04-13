/* jshint node:true */
"use strict";

const joi = require('joi');
const AWS = require('aws-sdk');
const q = require('q');
const lambda = new AWS.Lambda();
const config = require('../config');
const dbpool = require('../utils/dbpool');
const moment = require('moment');

let AudioEventDetectionsClustering = {
    find: function (options) {
        let constraints=['1=1'];
        let postprocess=[];
        let select = [];
        let tables = ['job_params_audio_event_detection_clustering JP'];

        if(!options){
            options = {};
        }

        if (options.project_id) {
            constraints.push('JP.project_id = ' + dbpool.escape(options.project_id));
        }

        select.push("JP.job_id, JP.name, JP.parameters");
        select.push("JP.`date_created` as `timestamp`");

        if (!options.playlist && options.dataExtended) {
            select.push("P.playlist_id, P.`name` as `playlist_name`");
            select.push("PR.first_playlist_recording, PR.playlist_id as playlist_test");
            tables.push("JOIN playlists P ON JP.playlist_id = P.playlist_id");
            tables.push("LEFT JOIN (SELECT playlist_id, MIN(recording_id) as first_playlist_recording FROM playlist_recordings GROUP BY playlist_id) PR ON P.playlist_id = PR.playlist_id");
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
                "A.`frequency_max` as `freq_max`",
                'A.aed_id', 'A.species_id', 'A.songtype_id',
                'Sp.scientific_name as species_name', 'St.songtype as songtype_name'
            );
            tables.push("JOIN audio_event_detections_clustering A ON JP.job_id = A.job_id");
            tables.push('LEFT JOIN species Sp ON A.species_id = Sp.species_id');
            tables.push('LEFT JOIN songtypes St ON A.songtype_id = St.songtype_id');
        }

        if (options.rec_id) {
            select.push("A.`recording_id` as `rec_id`");
            constraints.push('A.recording_id = ' + dbpool.escape(options.rec_id));
        }

        if (options.playlist) {
            select.push('A.aed_id, A.`recording_id` as `rec_id`');
            constraints.push('JP.playlist_id = ' + dbpool.escape(Number(options.playlist)));
        }

        if (options.completed) {
            tables.push('JOIN jobs J ON JP.job_id = J.job_id')
            select.push('J.state')
            constraints.push('J.state = "completed"')
        }

        if (options.aedCount) {
            select.push('(SELECT COUNT(*) FROM audio_event_detections_clustering A WHERE JP.job_id = A.job_id) as aed_count')
        }

        if (options.deleted !== undefined) {
            constraints.push('JP.`deleted` = ' + dbpool.escape(options.deleted));
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
            "WHERE " + constraints.join(" AND ") + "\n" +
            "ORDER BY timestamp DESC"
        ))
    },

    getDetectionsById: function (aed) {
        return aed.length ? dbpool.query(
            'SELECT aed_id, recording_id, species_id, songtype_id FROM audio_event_detections_clustering\n' +
            'WHERE aed_id IN (?)', [
            aed
        ]) : Promise.resolve();
    },

    validateDetections(aed, speciesId, songtypeId) {
        return aed.length ? dbpool.query(
            'UPDATE audio_event_detections_clustering\n' +
            'SET species_id = ?, songtype_id = ?\n' +
            'WHERE aed_id IN (?)', [
            speciesId,
            songtypeId,
            aed
        ]) : Promise.resolve();
    },

    updatePresentAedCount: async function(opts) {
        const q = `UPDATE recording_validations SET present_aed = present_aed ${opts.validate ? '+' : '-'} 1
            WHERE project_id=${opts.projectId} AND recording_id IN (${opts.recordingId}) AND species_id=${opts.speciesId} AND songtype_id=${opts.songtypeId}`;
        return dbpool.query(q);
    },

    deletePresentAedCount: async function(opts) {
        const q = `UPDATE recording_validations SET present_aed=0
            WHERE project_id=${opts.projectId} AND recording_id IN (${opts.recordingId}) AND species_id=${opts.speciesId} AND songtype_id=${opts.songtypeId}`;
        return dbpool.query(q);
    },

    delete: function (jobId) {
        const q = `UPDATE job_params_audio_event_detection_clustering SET deleted=1 WHERE job_id = ${jobId}`
        return dbpool.query(q);
    },

    getTotalRecInLast24Hours: async function(opts) {
        const last24hours = moment.utc().subtract(1, 'days').valueOf()
        const q = `SELECT SUM(pl.total_recordings) as totalRecordings
            FROM playlists pl
            JOIN job_params_audio_event_detection_clustering jp ON jp.playlist_id = pl.playlist_id
            WHERE pl.project_id=${opts.project_id} AND (UNIX_TIMESTAMP(jp.date_created) * 1000) >= ${last24hours}`;
        return dbpool.query(q).get(0);
    },

    JOB_SCHEMA : joi.object().keys({
        user_id: joi.number().integer(),
        name: joi.string(),
        playlist_id: joi.number().integer(),
        params     : joi.object().keys({
            areaThreshold: joi.number(),
            amplitudeThreshold: joi.number(),
            durationThreshold: joi.number(),
            bandwidthThreshold: joi.number(),
            filterSize: joi.number(),
            minFrequency: joi.number(),
            maxFrequency: joi.number()
        }),
    }),

    requestNewAudioEventDetectionClusteringJob: function(data){
        const payload = JSON.stringify(
            {
                'name': data.name,
                'playlist_id': data.playlist_id,
                'user_id': data.user_id,
                'Area Threshold': data.params.areaThreshold,
                'Amplitude Threshold': data.params.amplitudeThreshold,
                'Duration Threshold': data.params.durationThreshold,
                'Bandwidth Threshold': data.params.bandwidthThreshold,
                'Filter Size': data.params.filterSize,
                'Min Frequency': data.params.minFrequency,
                'Max Frequency': data.params.maxFrequency
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
