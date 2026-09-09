/* jshint node:true */
"use strict";

const util = require('util');
// NOTE (2026-09-09): the `async` library import was removed with the
// classifications.delete() waterfall rewrite -- that was its last use in this
// file. Verified: no remaining async.waterfall/each/map/series/parallel calls.
const config = require('../config');
const SQLBuilder = require('../utils/sqlbuilder');
const dbpool = require('../utils/dbpool');
const queryHandler = dbpool.queryHandler;
const { createS3Client } = require('../utils/storage');
// Route through the s3-proxy/s3-reader/s3-writer chain (endpoint-aware),
// not AWS S3 directly.
const s3 = createS3Client('aws');
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
    /** Resolve a classification WITHIN a project.
     *
     * 2026-09-09 (rfcx-local, OPEN-ITEMS §291): the `/:classiId` routes
     * authorised the project in the URL and then acted on the id from the
     * path, never checking that the one owned the other. This is the
     * project-scoped lookup the router.param uses to bind them, mirroring
     * `playlists.find({ id, project })` and `soundscapes.find({ id, project })`.
     *
     * Returns [] when the classification does not belong to `projectId`, so the
     * caller can 404 exactly as the sibling routers do.
     */
    findInProject: function(cid, projectId, callback) {
        var q = "SELECT jpc.`job_id`, j.`project_id` \n"+
                "FROM `job_params_classification` jpc \n"+
                "JOIN `jobs` j ON j.`job_id` = jpc.`job_id` \n"+
                "WHERE jpc.`job_id` = "+dbpool.escape(cid)+" \n"+
                "AND j.`project_id` = "+dbpool.escape(projectId);

        queryHandler(q, callback);
    },

    getName: function(cid, callback) {
        var q = "SELECT REPLACE(lower(c.`name`),' ','_') as name, \n"+
                "   j.`project_id` as pid \n"+
                "FROM `job_params_classification`  c, \n"+
                "   `jobs` j \n"+
                "WHERE c.`job_id` = j.`job_id` \n"+
                "AND c.`job_id` = "+dbpool.escape(cid);

        queryHandler(q, callback);
    },

    // classificationDelete
    //
    // 2026-09-09 (rfcx-local, OPEN-ITEMS §290): this was an `async.waterfall`
    // of independent auto-commit statements: S3 -> DELETE classification_results
    // -> DELETE classification_stats -> DELETE job_params_classification.
    // Three defects, all measured on live data:
    //
    //   1. NOT TRANSACTIONAL. Each DELETE committed on its own, so a failure
    //      (or a pod exit) between them left the classification HALF-DELETED:
    //      results rows kept, params row gone -- rows no read can reach and no
    //      user can see. 11 such jobs exist (36,884 rows); measured 2026-09-09.
    //   2. NOT IDEMPOTENT AT THE FRONT. Step 1 resolved the model uri through
    //      `job_params_classification`; once that row was gone a retry hit
    //      'Classification not found' and could never finish the cleanup it
    //      had started. A user clicking delete again could not converge.
    //   3. FAILURES WERE INVISIBLE. The route replied `res.json(data)` and
    //      `hideAsync()`d the job regardless, so a delete that deleted nothing
    //      still looked successful. Four such clicks are on record for job
    //      168896 (2026-09-03 22:04-22:13Z).
    //
    // Shape follows the in-repo precedent `recordings.delete()`
    // (app/model/recordings.js:3087): one connection, beginTransaction, all
    // DELETEs inside it, commit, rollback+rethrow on error.
    //
    // ORDER IS DELIBERATE: job_params_classification is deleted LAST, so an
    // aborted attempt leaves the jpc row intact and the classification stays
    // fully visible and re-deletable. jpc is also the parent that the
    // reverse-sync RESCAN_PARENT_GUARD tests to decide whether a legacy delete
    // really happened (rfcx-local data-stores/arbimon-pg/sync/reverse_sync.py)
    // -- deleting it first would tell the sync plane the job was deleted while
    // its result rows were still present.
    //
    // NOT CHANGED HERE: the S3 vector delete stays OUTSIDE the transaction (a
    // bucket op cannot be rolled back) and stays best-effort, matching its
    // previous behaviour. It runs BEFORE the DB deletes because it needs the
    // rows to enumerate the objects.
    delete: function(classificationId, callback) {

        var cid = dbpool.escape(classificationId);

        return dbpool.getConnection()
            .then(async (connection) => {
                const query = util.promisify(connection.query).bind(connection);

                // Resolve the model uri for the S3 vector keys. Explicit JOIN,
                // not a nested scalar subquery that bails when the params row is
                // already gone (defect 2), so a half-finished delete can be
                // completed by retrying.
                const modelRows = await query(
                    "SELECT m.`uri` FROM `job_params_classification` jpc " +
                    "JOIN `models` m ON m.`model_id` = jpc.`model_id` " +
                    "WHERE jpc.`job_id` = " + cid);

                // Enumerate the vector objects while the result rows still exist.
                const recRows = await query(
                    "SELECT r.`uri` FROM `recordings` r " +
                    "WHERE r.`recording_id` IN (" +
                    "SELECT `recording_id` FROM `classification_results` WHERE `job_id` = " + cid + ")");

                // Nothing left on either side => already fully deleted. Return
                // idempotent success rather than an error.
                if (!modelRows.length && !recRows.length) {
                    const stats = await query(
                        "SELECT COUNT(*) AS n FROM `classification_stats` WHERE `job_id` = " + cid);
                    if (!stats[0].n) {
                        connection.release();
                        return { data: "Classification deleted succesfully" };
                    }
                }

                if (modelRows.length && recRows.length) {
                    const modUri = modelRows[0].uri.replace('.mod', '');
                    const allToDelete = recRows.map(function(elem) {
                        const parts = elem.uri.split("/");
                        return { Key: modUri + '/classification_' + cid + '_' + parts[parts.length - 1] + '.vector' };
                    });
                    try {
                        await s3.deleteObjects({
                            Bucket: config('aws').bucketName,
                            Delete: { Objects: allToDelete }
                        }).promise();
                    } catch (s3err) {
                        // Best-effort, as before: an orphaned vector object must
                        // not block the DB cleanup. Logged rather than swallowed
                        // silently so it is diagnosable.
                        console.error('classifications.delete: S3 vector cleanup failed for job ' + cid, s3err && s3err.message);
                    }
                }

                await connection.beginTransaction();
                try {
                    await query("DELETE FROM `classification_results` WHERE `job_id` = " + cid);
                    await query("DELETE FROM `classification_stats` WHERE `job_id` = " + cid);
                    // LAST, deliberately -- see the ordering note above.
                    await query("DELETE FROM `job_params_classification` WHERE `job_id` = " + cid);
                    await connection.commit();
                } catch (err) {
                    await connection.rollback();
                    throw err;
                } finally {
                    connection.release();
                }

                return { data: "Classification deleted succesfully" };
            })
            .nodeify(callback);
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

    detail: function(cid, callback) {
        const q = `SELECT agg.species_id,
            agg.songtype_id,
            agg.present,
            agg.total,
            CONCAT(
                UCASE(LEFT(st.songtype, 1)),
                SUBSTRING(st.songtype, 2)
            ) AS songtype,
            CONCAT(
                UCASE(LEFT(s.scientific_name, 1)),
                SUBSTRING(s.scientific_name, 2)
            ) AS scientific_name,
            m.threshold AS th
        FROM (
            SELECT c.species_id,
                c.songtype_id,
                SUM(c.present) AS present,
                COUNT(c.present) AS total,
                c.job_id
            FROM classification_results c
            WHERE c.job_id = ?
            GROUP BY c.species_id, c.songtype_id, c.job_id
        ) AS agg
        JOIN job_params_classification jpc
            ON jpc.job_id = agg.job_id
        JOIN models m
            ON m.model_id = jpc.model_id
        JOIN species s
            ON agg.species_id = s.species_id
        JOIN songtypes st
            ON agg.songtype_id = st.songtype_id;`

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
                "     `job_params_classification` jpc, \n"+
                "     `species` as s , \n"+
                "     `songtypes` as st \n"+
                "WHERE c.`job_id` = ? \n"+
                "AND c.`job_id` = cs.`job_id` \n"+
                // 2026-09-09 (rfcx-local, OPEN-ITEMS §290): join the params row.
                // Every other read of classification_results in this file joins
                // job_params_classification, so a job whose params row was
                // deleted returns nothing. This one did NOT, which made it the
                // single read able to serve rows belonging to a deleted
                // classification: measured live, job 10170 returned a full page
                // (200 OK, 50,701 bytes) while its detail route correctly 404'd.
                // Harmless for healthy jobs -- they all have a jpc row by
                // construction (measured: of 3,185 type-2 jobs with no jpc row,
                // 3,174 have zero result rows and the other 11 are exactly the
                // known orphans).
                "AND jpc.`job_id` = c.`job_id` \n"+
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
                "       ) as vect, j.date_created \n"+
                "FROM classification_results AS cr \n"+
                "JOIN job_params_classification AS jpc ON jpc.job_id = cr.job_id \n"+
                "JOIN jobs AS j ON jpc.job_id = j.job_id \n"+
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
                data.kubernetesJobName = `arbimon-rfm-classify-${data.jobId}-${new Date().getTime()}`;
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
