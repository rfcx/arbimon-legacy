/* jshint node:true */
"use strict";

const util = require('util');
const async = require('async');
const config = require('../config');
const SQLBuilder = require('../utils/sqlbuilder');
const dbpool = require('../utils/dbpool');
const queryHandler = dbpool.queryHandler;
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const q = require('q');
const joi = require('joi');
const k8sConfig = config('k8s');
const jsonTemplates = require('../utils/json-templates');
const { Client } = require('kubernetes-client');
const k8sClient = new Client({ version: '1.13' });

var Classifications = {
    // classifications -> list
    list: function(projectId, callback) {
        return Classifications.getFor({
            project: projectId,
            completed: true,
            showUser: true,
            showPlaylist: true,
            showModel: true,
        }).nodeify(callback);
    },

    getFor: function(options) {
        options = options || {};
        var builder = new SQLBuilder();
        builder.addProjection(
            "UNIX_TIMESTAMP( J.`date_created` )*1000  as `date`",
            "J.`job_id`",
            "JPC.name as cname"
        );
        builder.addTable("`jobs`", "J");
        builder.addTable("JOIN `job_params_classification`", "JPC", "J.`job_id` = JPC.`job_id`");
        builder.addConstraint('J.`job_type_id` = 2');

        if(options.showUser){
            builder.addTable("JOIN `users`", "U", "U.`user_id` = J.`user_id`");
            builder.addProjection("U.firstname, U.lastname");
        }

        if(options.showPlaylist){
            builder.addTable("JOIN `playlists`", "PL", "PL.`playlist_id` = JPC.`playlist_id`");
            builder.addProjection("PL.`name` as playlist_name", "PL.`playlist_id`");
        }

        if(options.showModel){
            builder.addTable("JOIN `models`", "M", "M.`model_id` = JPC.`model_id`");
            builder.addProjection("M.name as modname", "M.`threshold`", "M.model_id");
        }

        if(options.hasOwnProperty("completed")){
            builder.addConstraint("J.`completed` = ?", [!!options.completed]);
        }

        if(options.hasOwnProperty("project")){
            builder.addConstraint("J.`project_id` = ?", [options.project]);
        }

        if(options.hasOwnProperty("id")){
            builder.addConstraint("J.`job_id` IN (?)", [options.id]);
        }

        builder.setOrderBy('date');

        return dbpool.query(builder.getSQL());
    },

    // classificationName
    getName: function(cid, callback) {
        var q = "SELECT REPLACE(lower(c.`name`),' ','_') as name, \n"+
                "   j.`project_id` as pid \n"+
                "FROM `job_params_classification`  c, \n"+
                "   `jobs` j \n"+
                "WHERE c.`job_id` = j.`job_id` \n"+
                "AND c.`job_id` = "+dbpool.escape(cid);

        queryHandler(q, callback);
    },

    // TODO delete async
    // classificationDelete
    delete: function(classificationId, callback) {

        var cid = dbpool.escape(classificationId);
        var modUri;
        var q;
        var allToDelete;

        // TODO change nested queries to join
        async.waterfall([
            function(cb) {
                q = "SELECT `uri` FROM `models` WHERE `model_id` = "+
                    "(SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = "+cid+")";
                queryHandler(q, cb);
            },
            function(data, fields, cb) {
                if(!data.length) return callback(new Error('Classification not found'));

                modUri = data[0].uri.replace('.mod','');
                q = "SELECT `uri` FROM `recordings` WHERE `recording_id` in "+
                "(SELECT `recording_id` FROM `classification_results` WHERE `job_id` = "+cid+")";
                queryHandler(q, cb);
            },
            function(data, fields, cb) {
                allToDelete = [];
                async.each(data, function (elem, next) {
                    var uri = elem.uri.split("/");
                    uri = uri[uri.length-1];
                    allToDelete.push({Key:modUri+'/classification_'+cid+'_'+uri+'.vector'});
                    next();
                }, cb);
            },
            function(cb) {
                if(allToDelete.length === 0) {
                    cb();
                }
                else {
                    var params = {
                        Bucket: config('aws').bucketName,
                        Delete: {
                            Objects: allToDelete
                        }
                    };

                    s3.deleteObjects(params, function() {
                        cb();
                    });
                }
            },
            function(cb) {
                var q = "DELETE FROM `classification_results` WHERE `job_id` = "+cid;
                // console.log('exc quer 1');
                queryHandler(q, cb);
            },
            function(result, fields, cb) {
                q = "DELETE FROM `classification_stats` WHERE `job_id` = "+cid ;
                // console.log('exc quer 2');
                queryHandler(q, cb);
            },
            function(result, fields, cb) {
                q = "DELETE FROM `job_params_classification` WHERE `job_id` = "+cid;
                // console.log('exc quer 3');
                queryHandler(q, cb);
            }
        ], function(err) {
            if(err) return callback(err);

            callback(null, { data:"Classification deleted succesfully" });
        });
    },

    __parse_meta_data : function(data) {
        try {
            const parsedData = JSON.parse(data);
            if (!parsedData) {
                return data;
            }
            return parsedData;
        } catch (e) {
            return null;
        }
    },

    // classificationCsvData: function(classiJobId, callback) {
    getCsvData: function(classiJobId, callback) {
        var q = "SELECT extract(year from r.`datetime`) year, \n"+
                "   extract(month from r.`datetime`) month, \n"+
                "   extract(day from r.`datetime`) day, \n"+
                "   extract(hour from r.`datetime`) hour, \n"+
                "   extract(minute from r.`datetime`) min,  \n"+
                "   m.`threshold`, \n"+
                "   m.`uri`, \n"+
                "   r.`uri` as ruri, r.meta, \n"+
                "   cr.`max_vector_value` as mvv, \n"+
                "   SUBSTRING_INDEX(r.`uri` ,'/',-1 ) rec, \n"+
                "   cr.`present`, \n"+
                "   s.`name`, \n"+
                "   sp.`scientific_name`, \n"+
                "   st.`songtype` \n"+
                "FROM `models` m , \n"+
                "   `job_params_classification`  jpc, \n"+
                "   `species` sp, \n"+
                "   `classification_results` cr, \n"+
                "   `recordings` r, \n"+
                "   `sites` s, \n"+
                "   `songtypes` st \n"+
                "WHERE cr.`job_id` = ? \n"+
                "AND jpc.`job_id` = cr.`job_id` \n"+
                "AND jpc.`model_id` = m.`model_id` \n"+
                "AND cr.`recording_id` = r.`recording_id` \n"+
                "AND s.`site_id` = r.`site_id` \n"+
                "AND sp.`species_id` = cr.`species_id` \n"+
                "AND cr.`songtype_id` = st.`songtype_id` ";

        queryHandler(dbpool.format(q, [classiJobId]), function(err, rows) {
            if (err) return callback(err);
            if (rows.length) {
                for (let _1 of rows) {
                    // Fill the original filename from the meta column.
                    _1.meta = _1.meta ? Classifications.__parse_meta_data(_1.meta) : null;
                    _1.rec = _1.meta && _1.meta.filename? _1.meta.filename :  _1.rec;
                }
                callback(null, rows);
            }
        });
    },

    // classificationErrorsCount
    errorsCount: function(jobId, callback) {
        var q = "SELECT count(*) AS count \n"+
                "FROM recordings_errors \n"+
                "WHERE job_id = " + dbpool.escape(jobId);

        queryHandler(q, callback);
    },

    // classificationDetail: function(project_url, cid, callback) {

    detail: function(cid, callback) {
        var q = (
            "SELECT c.`species_id`, \n"+
            "   c.`songtype_id`, \n"+
            "   SUM(c.`present`) as present, \n"+
            "   COUNT(c.`present`) as total, \n"+
            "   CONCAT( \n"+
            "       UCASE(LEFT(st.`songtype`, 1)),  \n"+
            "       SUBSTRING(st.`songtype`, 2)  \n"+
            "   ) as songtype,  \n"+
            "   CONCAT( \n"+
            "       UCASE(LEFT(s.`scientific_name`, 1)),  \n"+
            "       SUBSTRING(s.`scientific_name`, 2)  \n"+
            "   ) as scientific_name, \n"+
            "   m.`threshold` as th \n"+
            "FROM `classification_results` as c \n"+
            "JOIN `job_params_classification` as jpc ON jpc.`job_id` = c.`job_id` \n"+
            "JOIN `models` m  ON m.`model_id` = jpc.`model_id` \n"+
            "JOIN `species` as s ON c.`species_id` = s.`species_id` \n"+
            "JOIN `songtypes` as st ON c.`songtype_id` = st.`songtype_id` \n"+
            "WHERE c.`job_id` = ? \n"+
            "GROUP BY c.`species_id`, c.`songtype_id`"
        );

        queryHandler(dbpool.format(q,[cid]), callback);
    },

    moreDetails: function(cid, from, total, callback) {
        var q = "SELECT cs.`json_stats`, \n"+
                "       c.`species_id`, \n"+
                "       c.`songtype_id`, \n"+
                "       c.`present` as present, \n"+
                "       c.`recording_id`, \n"+
                "       r.`uri`, \n"+
                "       SUBSTRING_INDEX( \n"+
                "           SUBSTRING_INDEX( r.`uri` , '.', 1 ), \n"+
                "           '/', \n"+
                "           -1  \n"+
                "        ) as recname, r.meta, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(st.`songtype`, 1)), \n"+
                "           SUBSTRING(st.`songtype`, 2) \n"+
                "        ) as songtype , \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n"+
                "           SUBSTRING(s.`scientific_name`, 2) \n"+
                "       ) as scientific_name \n"+
                "FROM `classification_stats`  cs , \n"+
                "     `recordings` r, \n"+
                "     `classification_results` c, \n"+
                "     `species` as s , \n"+
                "     `songtypes` as st \n"+
                "WHERE c.`job_id` = ? \n"+
                "AND c.`job_id` = cs.`job_id` \n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND r.`recording_id` = c.`recording_id` \n"+
                "ORDER BY present DESC LIMIT ?,?";

        queryHandler(dbpool.format(q,[cid, parseInt(from), parseInt(total)]), function(err, rows) {
            if (err) return callback(err);
            if (rows.length) {
                for (let _1 of rows) {
                    // Fill the original filename from the meta column.
                    _1.meta = _1.meta ? Classifications.__parse_meta_data(_1.meta) : null;
                    _1.recname = _1.meta && _1.meta.filename? _1.meta.filename :  _1.recname;
                }
                callback(null, rows);
            }
        });
    },

    moreDetailsAsync: function(cid, from, total) {
        let getDetails = util.promisify(this.moreDetails)
        return getDetails(cid, from, total)
    },

    getRecVector: function(c12nId, recId, callback) {
        var q = "SELECT CONCAT( \n"+
                "           SUBSTRING_INDEX(m.uri, '.', 1), \n"+
                "           '/classification_', \n"+
                "           cr.job_id, \n"+
                "           '_', \n"+
                "           SUBSTRING_INDEX(r.uri, '/', -1), \n"+
                "           '.vector' \n"+
                "       ) as vect \n"+
                "FROM classification_results AS cr \n"+
                "JOIN job_params_classification AS jpc ON jpc.job_id = cr.job_id \n"+
                "JOIN models AS m ON m.model_id = jpc.model_id \n"+
                "JOIN recordings AS r ON r.recording_id = cr.recording_id \n"+
                "WHERE cr.job_id = ? \n"+
                "AND r.recording_id = ? ";

        q = dbpool.format(q, [c12nId, recId, callback]);

        queryHandler(q, callback);
    },

    totalRfmClassificationJobs: function(projectId) {
        return dbpool.query(`SELECT COUNT(model_id) AS count FROM models WHERE project_id = ${dbpool.escape(projectId)} AND deleted = 0`).get(0).get('count');
    },

    totalRfmSpeciesDetected: function(projectId) {
        return dbpool.query(`SELECT COUNT(species_id) AS count FROM model_classes mc
            JOIN models m on m.model_id = mc.model_id
            WHERE m.project_id = ${dbpool.escape(projectId)} AND m.deleted = 0`).get(0).get('count');
    },

    JOB_SCHEMA : joi.object().keys({
        ENV_JOB_ID: joi.string()
    }),

    createClassificationJob: function(data, callback){
        console.log('data', data)
        const payload = JSON.stringify(
            {
                ENV_JOB_ID: `${data.jobId}`
            }
        )
        return q.ninvoke(joi, 'validate', payload, Classifications.JOB_SCHEMA)
            .then(async () => {
                data.kubernetesJobName = `arbimon-rfm-classify-${new Date().getTime()}`;
                const jobParam = jsonTemplates.getClassificationJobTemplate('arbimon-rfm-classify', 'job', {
                    kubernetesJobName: data.kubernetesJobName,
                    imagePath: k8sConfig.rfmImagePath,
                    ENV_JOB_ID: `${data.jobId}`
                });
                return await k8sClient.apis.batch.v1.namespaces(k8sConfig.namespace).jobs.post({ body: jobParam });
            }).then(() => {
                return true;
            }).nodeify(callback);
    },
};


module.exports = Classifications;
