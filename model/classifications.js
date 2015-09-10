/* jshint node:true */
"use strict";

var util = require('util');

var debug = require('debug')('arbimon2:model:classifications');
var mysql = require('mysql');
var async = require('async');
var joi = require('joi');
var sprintf = require("sprintf-js").sprintf;
var AWS = require('aws-sdk');


var config = require('../config');
var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
var queryHandler = dbpool.queryHandler;

var s3 = new AWS.S3();

// other schema modules
var species = require('./species');
var songtypes = require('./songtypes');



var Classifications = {
    // classifications -> list
    list: function(projectId, callback) {
        var q = (
            "SELECT UNIX_TIMESTAMP( j.`date_created` )*1000  as `date`, \n"+
            "    j.`job_id`, \n"+
            "    pl.`name` as playlistName,\n"+
            "    CONCAT(UCASE(LEFT(mode.`name`, 1)), SUBSTRING(mode.`name`, 2))  as modname, \n"+
            "    CONCAT(UCASE(LEFT(jpc.`name`, 1)), SUBSTRING(jpc.`name`, 2))  as cname, \n"+
            "    CONCAT(\n"+
            "        CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)), \n"+
            "        ' ', \n"+
            "        CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) \n"+
            "    ) as muser\n"+
            "FROM  `playlists`  as pl, \n"+
            "    `models` as mode , \n"+
            "    `jobs` as j,\n"+
            "    `job_params_classification` as jpc, \n"+
            "    `users` as u\n"+
            "WHERE pl.`playlist_id` = jpc.`playlist_id` \n"+
            "AND mode.`model_id` = jpc.`model_id` \n"+
            "AND j.`job_id` = jpc.`job_id` \n"+
            "AND j.`job_type_id` = 2 \n"+
            "AND j.`completed` = 1 \n"+
            "AND u.`user_id` = j.`user_id` \n"+
            "AND j.`project_id` = ? "
        );

        queryHandler(mysql.format(q, [projectId]), callback);
    },
    
    // classificationName
    getName: function(cid, callback) {
        var q = "SELECT REPLACE(lower(c.`name`),' ','_') as name, \n"+
                "   j.`project_id` as pid \n"+
                "FROM `job_params_classification`  c, \n"+
                "   `jobs` j \n"+
                "WHERE c.`job_id` = j.`job_id` \n"+
                "AND c.`job_id` = "+mysql.escape(cid);

        queryHandler(q, callback);
    },
    
    // TODO delete async
    // classificationDelete
    delete: function(classificationId, callback) {
        
        var cid = mysql.escape(classificationId);
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
    
    // classificationCsvData: function(classiJobId, callback) {
    getCsvData: function(classiJobId, callback) {
        var q = "SELECT extract(year from r.`datetime`) year, \n"+
                "   extract(month from r.`datetime`) month, \n"+
                "   extract(day from r.`datetime`) day, \n"+
                "   extract(hour from r.`datetime`) hour, \n"+
                "   extract(minute from r.`datetime`) min,  \n"+
                "   m.`threshold`, \n"+
                "   m.`uri`, \n"+
                "   r.`uri` as ruri, \n"+
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

        queryHandler(mysql.format(q, [classiJobId]), callback);
    },
    
    // classificationErrorsCount
    errorsCount: function(jobId, callback) {
        var q = "SELECT count(*) AS count \n"+
                "FROM recordings_errors \n"+ 
                "WHERE job_id = " + mysql.escape(jobId);

        queryHandler(q, callback);
    },
    
    // classificationDetail: function(project_url, cid, callback) {
    detail: function(cid, callback) {
        var q = "SELECT c.`species_id`, \n"+
                "       c.`songtype_id`, \n"+
                "       c.`present`, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(st.`songtype`, 1)), \n"+
                "           SUBSTRING(st.`songtype`, 2) \n"+
                "       ) as songtype, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n"+
                "           SUBSTRING(s.`scientific_name`, 2) \n"+
                "       ) as scientific_name, \n"+
                "       mm.`threshold` as th \n"+
                "FROM  `models` mm, \n"+
                "      `job_params_classification`jpc, \n"+
                "      `classification_results` c, \n"+
                "      `species` as s , \n"+
                "      `songtypes` as st \n"+
                "WHERE c.`job_id` = " + mysql.escape(cid) +"\n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND jpc.`job_id` = c.`job_id` \n"+
                "AND mm.`model_id` = jpc.`model_id`";

        queryHandler(q, callback);
    },
    
    // classificationDetailMore: function(project_url, cid, from, total, callback) {
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
                "        ) as recname, \n"+
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
                "WHERE c.`job_id` = " + mysql.escape(cid) + "\n"+
                "AND c.`job_id` = cs.`job_id` \n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND r.`recording_id` = c.`recording_id` \n"+
                "ORDER BY present DESC LIMIT " + parseInt(from) + "," + parseInt(total);
        
        queryHandler(q, callback);
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
        
        q = mysql.format(q, [c12nId, recId, callback]);
        
        queryHandler(q, callback);
    },
};


module.exports = Classifications;
