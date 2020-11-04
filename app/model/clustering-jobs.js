/* jshint node:true */
"use strict";

var dbpool = require('../utils/dbpool');

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
            "C.`name` as `name`",
            "C.`audio_event_detection_job_id` as `aed_job_id`",
            "C.`parameters` as `parameters`",
            "C.user_id",
            "CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2)),' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) AS user"
        );
        tables.push("JOIN users U ON C.user_id = U.user_id");
        select.push(
            "JP.`name` as `name_aed`",
            "JP.`job_id` as `job_id`",
        );
        tables.push("JOIN job_params_audio_event_detection_clustering JP ON C.audio_event_detection_job_id = JP.job_id");
        select.push("J.`date_created` as `timestamp`");
        tables.push("JOIN jobs J ON C.job_id = J.job_id");

        if (options.project_id) {
            constraints.push('C.project_id = ' + dbpool.escape(options.project_id));
        }

        postprocess.push((rows) => {
            rows.forEach(row => {
                try {
                    row.parameters = JSON.parse(row.parameters);
                } catch(e) {
                    row.parameters = row.parameters;
                }
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
};

module.exports = ClusteringJobs;
