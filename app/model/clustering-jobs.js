/* jshint node:true */
"use strict";

const joi = require('joi');
const AWS = require('aws-sdk');
const q = require('q');
const dbpool = require('../utils/dbpool');
const Recordings = require('./recordings');
const config = require('../config');
const k8sConfig = config('k8s');
const jsonTemplates = require('../utils/json-templates');
const { Client } = require('kubernetes-client');
const k8sClient = new Client({ version: '1.13' });
const s3 = new AWS.S3();

let ClusteringJobs = {
    find: function (options) {
        let constraints=['1=1'];
        let postprocess=[];
        let select = [];
        let tables = [
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

        if (options.completed) {
            select.push("J.`state`");
            constraints.push('J.state = "completed"');
        }

        if (options.deleted !== undefined) {
            constraints.push('C.`deleted` = ' + dbpool.escape(options.deleted));
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
        let constraints=['1=1'];
        let select = [];
        let groupby = [];
        let tables = ['audio_event_detections_clustering A'];
        if(!options){
            options = {};
        }
        select.push(
            "A.aed_id, A.time_min, A.time_max, A.frequency_min, A.frequency_max, A.recording_id, A.uri_image as 'uri', A.validated"
        );

        if (options.aed) {
            tables.push("LEFT JOIN species sp ON sp.species_id = A.species_id");
            tables.push("LEFT JOIN songtypes sgt ON sgt.songtype_id = A.songtype_id");
            constraints.push('A.aed_id IN (' + dbpool.escape(options.aed) + ')');
            select.push("A.species_id, A.songtype_id, sgt.songtype, sp.scientific_name")
        }

        if (options.perSite) {
            select.push('S.site_id, S.`name` as `site`');
            tables.push("JOIN recordings R ON A.recording_id = R.recording_id");
            tables.push("JOIN sites S ON R.site_id = S.site_id");
        }

        if (options.perDate) {
            tables.push("JOIN job_params_audio_event_clustering C ON A.job_id = C.audio_event_detection_job_id");
            select.push('C.`date_created`');
            groupby.push('A.aed_id');
        }

        if (options.rec_id) {
            constraints.push('A.recording_id = ' + dbpool.escape(options.rec_id));
        }

        const sql = "SELECT " + select.join(",\n    ") + "\n" +
        "FROM " + tables.join("\n") + "\n" +
        "WHERE " + constraints.join(" AND ")+ "\n" +
        (groupby.length ? ("\nGROUP BY " + groupby.join(",\n    ")) : "")

        if (options.exportReport) {
            return dbpool.query(sql)
        }
        return dbpool.query(sql)
    },

    getClusteringPlaylist: async function(recId) {
        const q = `SELECT aed.aed_id, pl.name as playlist_name, pl.playlist_id FROM audio_event_detections_clustering aed
            JOIN playlist_aed ple ON aed.aed_id = ple.aed_id
            JOIN playlists pl ON ple.playlist_id = pl.playlist_id
            WHERE aed.recording_id = ${recId}`;
        return dbpool.query(q);
    },

    getAsset: function (s3Path, res) {
        if(!s3){
            s3 = new AWS.S3();
        }
        return s3
            .getObject({ Bucket: config('aws').bucketName, Key: s3Path })
            .createReadStream()
            .pipe(res)
    },

    getRoiAudioFile: function (options) {
        options = options || {};

        let query = "SELECT A.time_min, A.time_max, A.frequency_min, A.frequency_max, R.`uri` as `rec_uri`, R.site_id,\n" +
        "R.datetime, R.datetime_utc, S.external_id\n" +
        "FROM audio_event_detections_clustering A\n" +
        "JOIN recordings R ON A.recording_id = R.recording_id\n" +
        "JOIN sites S ON S.site_id = R.site_id\n" +
        "WHERE A.recording_id = ? AND A.aed_id = ?";

        return dbpool.query(
            query, [
                options.recId,
                options.aedId
            ]
        ).get(0).then(function(rec) {
            if (!rec) {
                return;
            }
            return q.ninvoke(Recordings, 'fetchAudioFile', {
                uri: rec.rec_uri,
                site_id: rec.site_id,
                external_id: rec.external_id,
                datetime: rec.datetime,
                datetime_utc: rec.datetime_utc
            }, {
                maxFreq: rec.frequency_max,
                minFreq: rec.frequency_min,
                gain: options.gain || 1,
                trim: {
                    from: rec.time_min,
                    to: rec.time_max
                },
            });
        })
    },

    audioEventDetections: function (options) {
        let constraints=['1=1'];
        let select = [];
        let tables = ['job_params_audio_event_detection_clustering JP'];
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

        if (options.completed) {
            select.push("J.`state`");
            constraints.push('J.state = "completed"');
            tables.push("JOIN jobs J ON JP.job_id = J.job_id");
        }

        if (options.deleted !== undefined) {
            constraints.push('JP.`deleted` = ' + dbpool.escape(options.deleted));
        }

        return dbpool.query(
            "SELECT " + select.join(",\n    ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            "WHERE " + constraints.join(" AND ")
        )
    },

    delete: function (jobId) {
        const q = `UPDATE job_params_audio_event_clustering SET deleted=1 WHERE job_id = ${jobId}`;
        return dbpool.query(q);
    },

    JOB_SCHEMA : joi.object().keys({
        project_id: joi.number().integer(),
        user_id: joi.number().integer(),
        name : joi.string(),
        aed_job_name: joi.string(),
        aed_job_id: joi.number(),
        min_points: joi.number(),
        distance_threshold: joi.number(),
        max_cluster_size: joi.number()
    }),

    requestNewClusteringJob: function(data, callback){
        let payload = JSON.stringify({
            project_id: data.project_id,
            user_id: data.user_id,
            name: data.name,
            aed_job_name: data.audioEventDetectionJob.name,
            aed_job_id: data.audioEventDetectionJob.jobId,
            min_points: data.params.minPoints,
            distance_threshold: data.params.distanceThreshold,
            max_cluster_size: data.params.maxClusterSize
        });
        let job_id;
        let jobQuery =
            "INSERT INTO jobs (\n" +
            "    `job_type_id`, `date_created`,\n" +
            "    `last_update`, `project_id`,\n" +
            "    `user_id`, `state`,\n" +
            "    `progress`, `completed`, `progress_steps`, `hidden`, `ncpu`\n" +
            ") SELECT ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?";

        let clusteringQuery =
            "INSERT INTO job_params_audio_event_clustering (\n" +
            "    `name`, `project_id`, `user_id`, \n" +
            "    `job_id`, `audio_event_detection_job_id`,\n" +
            "    `date_created`, `parameters`\n" +
            ") SELECT ?, ?, ?, ?, ?, NOW(), ?";

        return q.ninvoke(joi, 'validate', payload, ClusteringJobs.JOB_SCHEMA)
            .then(() => dbpool.query(
                jobQuery, [
                    9, data.project_id, data.user_id, 'processing', 0, 0, 4, 0, 0
                ]
            ).then(result => {
                data.id = job_id = result.insertId;
            }).then(() =>
                dbpool.query(
                    clusteringQuery, [
                        data.name, data.project_id, data.user_id, data.id, data.audioEventDetectionJob.jobId,
                        JSON.stringify({
                            "Min. Points": data.params.minPoints,
                            "Distance Threshold": data.params.distanceThreshold,
                            "Max. Cluster Size": data.params.maxClusterSize
                        })
                    ]
                )
                ).then(async () => {
                data.kubernetesJobName = `aed-clustering-${new Date().getTime()}`;
                let jobParam = jsonTemplates.getTemplate('aed-clustering', 'job', {
                    kubernetesJobName: data.kubernetesJobName,
                    imagePath: k8sConfig.imagePath,
                    distanceThreshold: `${data.params.distanceThreshold}`,
                    minPoints: `${data.params.minPoints}`,
                    maxClusterSize: `${data.params.maxClusterSize}`,
                    clusterJobId: `${data.id}`,
                    aedJobId: `${data.audioEventDetectionJob.jobId}`
                });
                await k8sClient.apis.batch.v1.namespaces(k8sConfig.namespace).jobs.post({ body: jobParam });
            }).then(() => {
                return job_id;
            })
        ).nodeify(callback);
    },
};

module.exports = ClusteringJobs;
