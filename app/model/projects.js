/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:projects');
var util = require('util');
var async = require('async');
var joi = require('joi');
var q = require('q');
var sprintf = require("sprintf-js").sprintf;
var AWS = require('aws-sdk');
var request = require('request');
var rp = util.promisify(request);
const auth0Service = require('../model/auth0');
const { EmptyResultError } = require('@rfcx/http-utils');


var s3 = new AWS.S3();
var config = require('../config');
const rfcxConfig = config('rfcx');
var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
var queryHandler = dbpool.queryHandler;
var APIError = require('../utils/apierror');
var species = require('./species');
var songtypes = require('./songtypes');
var s3;

var Projects = {

    plans: {
        free: { // Changes must be matched in assets/app/orders/plan-selection.js
            cost: 0,
            storage: 100000,
            processing: 10000000,
            tier: 'free'
        }
    },

    listAll: function(callback) {
        var q = "SELECT project_id as id, name, url, description, is_private, is_enabled \n"+
                "FROM projects";

        queryHandler(q, callback);
    },

    find: function (query, callback) {
        var whereExp = [], data=[];
        var selectExtra = '';
        var joinExtra = '';

        if(query.hasOwnProperty("id")) {
            whereExp.push("p.project_id = ?");
            data.push(query.id);
        }
        if(query.hasOwnProperty("url")) {
            whereExp.push("p.url = ?");
            data.push(query.url);
        }
        if(query.hasOwnProperty("name")) {
            whereExp.push("p.name = ?");
            data.push(query.name);
        }
        if(query.hasOwnProperty("owner_id")) {
            joinExtra += 'JOIN user_project_role AS upr ON (p.project_id = upr.project_id and upr.role_id = 4) \n'
            whereExp.push("upr.user_id = ?");
            data.push(query.owner_id);
        }
        if(query.hasOwnProperty("include_location")) {
            selectExtra += 'site.lat as lat, site.lon as lon, '
            joinExtra += 'LEFT JOIN (SELECT project_id, lat, lon, MAX(site_id) as maxSiteId FROM sites GROUP BY project_id) site ON p.project_id = site.project_id \n'
            whereExp.push("1 = 1");
        }

        if(!whereExp.length) {
            return q.reject(new Error('no query params'));
        }

        if(!query.basicInfo){
            selectExtra += "   pp.tier, \n"+
                          "   pp.storage AS storage_limit, \n"+
                          "   pp.processing AS processing_limit, \n"+
                          "   pp.created_on AS plan_created, \n"+
                          "   pp.activation AS plan_activated, \n"+
                          "   p.citizen_scientist_enabled, \n"+
                          "   p.pattern_matching_enabled, \n"+
                          "   p.cnn_enabled, \n"+
                          "   pp.duration_period AS plan_period \n";
            joinExtra   += "JOIN project_plans AS pp ON pp.plan_id = p.current_plan \n";
        } else {
            selectExtra += "p.project_id as id \n";
        }

        let que = "SELECT p.*" + (selectExtra ? ", \n" + selectExtra : "\n") +
        "FROM projects AS p \n" + joinExtra +
        "WHERE (" + whereExp.join(") \n" +
        "  AND (") + ")";
        return dbpool.query(que, data).nodeify(callback);
    },

    findById: function (project_id, callback) {
        return Projects.find({id: project_id}).then(function(rows){
            return rows[0];
        }).nodeify(callback);
    },

    // DEPRACATED use find()
    findByUrl: function (project_url, callback) {
        console.info('projects.findByUrl DEPRECATED');
        return Projects.find({url: project_url}, callback);
    },

    // DEPRACATED use find()
    findByName: function (project_name, callback) {
        console.info('projects.findByName DEPRECATED');
        return Projects.find({name: project_name}, callback);
    },

    /** Fetch a project's list of sites.
     * @param {Integer} project_id - the id of the project.
     * @param {Object} options - options object.
     * @param {Boolean} options.compute.rec_count - compute recording counts as well.
     * @param {Boolean} options.compute.has_logs - compute wether each site has log files or not.
     * @return {Promise} promise resolving to the list of sites.
     */
    getProjectSites: function(project_id, options){
        if(typeof project_id !== 'number'){
            return q.reject(new Error("invalid type for 'project_id'"));
        }
        return dbpool.query(
                "SELECT s.site_id as id, \n"+
                "       s.name, \n"+
                "       s.lat, \n"+
                "       s.lon, \n"+
                "       s.alt, \n"+
                "       s.published, \n"+
                "       s.project_id != ? AS imported, \n"+
                "       s.token_created_on \n" +
                "FROM sites AS s \n"+
                "LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = ? \n"+
                "WHERE (s.project_id = ? OR pis.project_id = ?)",
                [project_id, project_id, project_id, project_id]
        ).then(function(sites){
            if(sites.length && options && options.compute){
                var sitesById={}, siteIds = sites.map(function(site){
                    sitesById[site.id] = site;
                    return site.id;
                });

                return q.all([
                    options.compute.rec_count ? dbpool.query(
                        "SELECT r.site_id, COUNT(r.recording_id ) as rec_count\n"+
                        "FROM recordings AS r\n"+
                        "WHERE r.site_id IN (?)\n" +
                        "GROUP BY r.site_id",
                        [siteIds]
                    ).then(function(results){
                        sites.forEach(function(site){
                            site.rec_count=0;
                        });
                        results.forEach(function(row){
                            sitesById[row.site_id].rec_count = row.rec_count;
                        });
                    }) : q(),
                    options.compute.has_logs ? dbpool.query(
                        "SELECT SLF.site_id, COUNT(SLF.site_log_file_id ) > 0 as has_logs \n" +
                        "FROM site_log_files AS SLF\n" +
                        "WHERE SLF.site_id IN (?)\n" +
                        "GROUP BY SLF.site_id",
                        [siteIds]
                    ).then(function(results){
                        sites.forEach(function(site){
                            site.has_logs=false;
                        });
                        results.forEach(function(row){
                            sitesById[row.site_id].has_logs = row.has_logs;
                        });
                    }): q()
                ]).then(function(){
                    return sites;
                });
            }
            return sites;
        });
    },

    /** Returns wether the given site is from the given project.
     * @param {Integer} project_id - the id of the project.
     * @param {Integer} site_id - the id of the site.
     * @param {Object} options - options object.
     * @param {Boolean} options.ignoreImported - wether to ignore imported sites (default false).
     * @return {Promise} promise resolving to wether the given site is from the given project..
     */
    determineIfSiteInProject: function(project_id, site_id, options){
        options = options || {};
        var queries=[
            "SELECT s.site_id as id FROM sites AS s WHERE s.project_id = ? AND s.site_id = ?"
        ], data = [project_id, site_id];
        if(!options.ignoreImported){
            queries.push("SELECT pis.site_id as id FROM project_imported_sites as pis WHERE pis.project_id = ? AND pis.site_id = ?");
            data.push([project_id, site_id]);
        }
        return dbpool.query(
            queries.length == 1 ? queries[0] : (
                "(\n    " + queries.join("\n) UNION (\n    ") + "\n)"
            ), data).then(function(sites){
            return sites.length;
        });
    },

    /**
     * creates a project and its plan, and adds the creator to the project as
     * owner on user_project_role
     * @param {Object} project
     * @param {String} project.name
     * @param {String} project.url
     * @param {String} project.description
     * @param {Number} project.owner_id - creator id
     * @param {Number} project.project_type_id
     * @param {Boolean} project.is_private
     * @param {Function} callback(err, projectId)
    */
    create: function(project, owner_id, callback) {
        var schema = joi.object().keys({
            name: joi.string(),
            url: joi.string(),
            description: joi.string().optional(),
            project_type_id: joi.number(),
            is_private: joi.boolean(),
            plan: joi.object().keys({
                tier: joi.string(),
                storage: joi.number(),
                processing: joi.number(),
                activation: joi.date().optional(),
                duration_period: joi.number().optional(),
            })
        });

        var result = joi.validate(project, schema, {
            stripUnknown: true,
            presence: 'required',
        });

        if(result.error) {
            return callback(result.error);
        }

        project = result.value;
        var plan = project.plan;
        delete project.plan;

        project.storage_usage = 0;
        project.processing_usage = 0;
        project.pattern_matching_enabled = 1;

        var q = 'INSERT INTO projects \n'+
                'SET ?';

        var q2 = 'INSERT INTO user_project_role \n'+
                 'SET ?';

        var createPlan = 'INSERT INTO project_plans \n'+
                         'SET ?';

        var updatePlan = 'UPDATE projects \n'+
                         'SET current_plan = ? \n'+
                         'WHERE project_id = ?';

        dbpool.getConnection(function(err, db) {
            db.beginTransaction(function(err){
                if(err) return callback(err);

                var projectId;

                async.waterfall([
                    function insertProject(cb) {
                        db.query(q, project, cb);
                    },
                    function insertOwner(result, fields, cb) {
                        projectId = result.insertId;

                        var values = {
                            user_id: owner_id,
                            project_id: projectId,
                            role_id: 4 // owner role id
                        };

                        db.query(q2, values, cb);
                    },
                    function insertPlan(result, fields, cb) {
                        plan.project_id = projectId;
                        plan.created_on = new Date();

                        db.query(createPlan, plan, cb);
                    },
                    function updateCurrentPlan(result, fields, cb) {
                        db.query(updatePlan, [result.insertId, projectId], cb);
                    },
                    function commit(result, fields, cb) {
                        db.commit(cb);
                    }
                ],
                function(err) {
                    db.release();
                    if(err) {
                        db.rollback(function() {
                            callback(err);
                        });
                        return;
                    }

                    callback(null, projectId);
                });
            });
        });
    },

    /**
     * updates a project.
     * @param {Object} project
     * @param {Number} project.project_id
     * @param {String} project.name
     * @param {String} project.url
     * @param {String} project.description
     * @param {Number} project.project_type_id
     * @param {Boolean} project.is_private
     * @param {Boolean} project.is_enabled
     * @param {String} project.current_plan
     * @param {Number} project.storage_usage
     * @param {Number} project.processing_usage
     * @param {Function} callback(err, projectId)
     *
     * @return {Promise} resolved after the update.
    */
    update: function(project, callback) {

        var schema = {
            project_id: joi.number().required(),
            name: joi.string(),
            url: joi.string(),
            description: joi.string().optional(),
            project_type_id: joi.number(),
            is_private: [joi.number().valid(0,1), joi.boolean()],
            is_enabled: [joi.number().valid(0,1), joi.boolean()],
            current_plan: joi.number(),
            storage_usage: joi.number().allow(null),
            processing_usage: joi.number().allow(null),
            citizen_scientist_enabled: [joi.number().valid(0,1), joi.boolean()],
            pattern_matching_enabled: [joi.number().valid(0,1), joi.boolean()],
            cnn_enabled: [joi.number().valid(0,1), joi.boolean()],
            plan: joi.object().keys({
                tier: joi.string(),
                storage: joi.number(),
                processing: joi.number(),
                activation: joi.date().allow(null).optional(),
                duration_period: joi.number().allow(null).optional(),
            }).optional()
        };

        return q.ninvoke(joi, 'validate', project, schema).then(function(projectInfo){
            var projectId = projectInfo.project_id;
            delete projectInfo.project_id;

            var projectInfoPlan = projectInfo.plan;
            delete projectInfo.plan;

            return q.all([
                dbpool.query(
                    'UPDATE projects\n'+
                    'SET ?\n'+
                    'WHERE project_id = ?', [
                    projectInfo, projectId
                ]),
                projectInfoPlan && dbpool.query(
                    "UPDATE project_plans\n"+
                    "SET ?\n" +
                    "WHERE project_id=?", [
                        projectInfoPlan,
                        projectId
                    ]
                )
            ]);
        }).nodeify(callback);
    },

    insertNews: function(news, callback) {

        var schema = {
            user_id: joi.number().required(),
            project_id: joi.number().required(),
            data: joi.string().required(),
            news_type_id: joi.number().required()
        };

        joi.validate(news, schema, function(err, newsVal) {
            if(err) {
                if(callback) {
                    return callback(err);
                } else {
                    // throw err; // note[gio]: this could possibly kill the thread, do we want this?
                    return console.error(err);
                }
            }

            var q = 'INSERT INTO project_news \n'+
                    'SET user_id = %s, '+
                    'project_id = %s, '+
                    'data = %s, '+
                    'news_type_id = %s';

            q = util.format(q,
                dbpool.escape(newsVal.user_id),
                dbpool.escape(newsVal.project_id),
                dbpool.escape(newsVal.data),
                dbpool.escape(newsVal.news_type_id)
            );

            queryHandler(q, function(err, result) {
                if(callback) {
                    if(err) return callback(err);

                    return callback(null, result);
                } else {
                    if(err) {
                        return console.error(err.stack);
                    }
                }
            });

        });
    },

    insertNewsAsync: function(news) {
        let insertNews = util.promisify(this.insertNews)
        return insertNews(news)
    },

    /** Fetches a project's classes.
     * @param {{Object}} project project object.
     * @param {{Integer}} project.project_id
     * @param {{Integer}} class_id (optional) limit the query to this class
     * @param {{Callback}} callback
     */
    getProjectClasses: function(projectId, classId, options, callback){
        if(typeof options == 'function') {
            callback = options;
            options = {};
        } else if(typeof classId == 'function') {
            callback = classId;
            options = {};
            classId = null;
        }

        var params = [projectId];
        var select_clause = [
            "pc.project_class_id as id",
            "pc.project_id as project",
            "pc.species_id as species",
            "pc.songtype_id as songtype",
            "st.taxon",
            "sp.scientific_name as species_name",
            "so.songtype as songtype_name"
        ];
        var from_clause = [
            "project_classes AS pc",
            "JOIN species AS sp ON sp.species_id = pc.species_id",
            "JOIN songtypes AS so ON so.songtype_id = pc.songtype_id",
            "JOIN species_taxons AS st ON st.taxon_id = sp.taxon_id"
        ];
        var where_clause = ['pc.project_id = ?'];
        var groupby_clause = [];


        if(classId) {
            where_clause.push("pc.project_class_id = ?");
            params.push(classId);
        } else if(options.ids){
            if(options.noProject){
                params = [];
                where_clause = [];
            }
            where_clause.push("pc.project_class_id IN (?)");
            params.push(options.ids);
        }

        if(options && options.countValidations) {
            select_clause.push(
                "coalesce(SUM(rv.present), 0) as vals_present",
                "coalesce((COUNT(rv.present) - SUM(rv.present)), 0) as vals_absent"
            );
            from_clause.push(
                "LEFT JOIN recording_validations AS rv ON (\n"+
                "   rv.songtype_id = pc.songtype_id\n" +
                "   AND rv.species_id = pc.species_id\n" +
                "   AND rv.project_id = pc.project_id\n" +
                ")"
            );
            groupby_clause.push("pc.species_id", "pc.songtype_id");
        }

        return q.nfcall(queryHandler, dbpool.format(
            "SELECT " + select_clause.join(", \n") + "\n" +
            "FROM " + from_clause.join("\n") + "\n" +
            "WHERE (" + where_clause.join(") AND (") + ")" +
            (groupby_clause.length ? "\nGROUP BY " + groupby_clause.join(",") : ""),
            params)
        ).get(0).nodeify(callback);
    },

    insertClass: function(project_class, callback) {
        var schema = {
            species: joi.string().required(),
            songtype: joi.string().required(),
            project_id: joi.number().required()
        };
        var value, classSpecies, classSong;

        return q.ninvoke(joi, 'validate', project_class, schema).then(function(_value){
            value = _value;
            return q.all([
                species.findByName(value.species).get(0),
                songtypes.findByName(value.songtype).get(0),
            ]);
        }).then(function (all){
            classSpecies = all[0];
            classSong = all[1];
            console.log("classSpecies", classSpecies, "classSong", classSong);

            if(!classSpecies){
                throw new Error(util.format("species '%s' not in system", value.species));
            }

            if(!classSong){
                throw new Error(util.format("songtype '%s' not in system", value.songtype));
            }
        }).then(function (){
            return dbpool.query(
                "SELECT count(*) as count \n"+
                "FROM project_classes \n"+
                "WHERE project_id = ?\n"+
                "  AND species_id = ?\n"+
                "  AND songtype_id = ?", [
                value.project_id,
                classSpecies.id,
                classSong.id,
            ]).get(0).get('count').then(function(count){
                return count > 0;
            });
        }).then(function insert(classExists){
            if(classExists){
                return { error: "class already in project" };
            }

            return dbpool.query(
                'INSERT INTO project_classes(project_id, species_id, songtype_id) \n'+
                'VALUES (?, ?, ?)', [
                value.project_id,
                classSpecies.id,
                classSong.id
            ]).then(function(result){
                return {
                    class: result.insertId,
                    species: classSpecies.id,
                    songtype: classSong.id
                };
            });
        }).nodeify(callback);
    },

    removeClasses: function(project_classes, callback) {
        var schema = joi.array().min(1).items(joi.number());

        joi.validate(project_classes, schema, function(err, value) {
            if(err) return callback(err);

            value = '(' + dbpool.escape(value) + ')';

            var q = "DELETE FROM project_classes \n"+
                    "WHERE project_class_id IN %s";

            q = util.format(q, value);
            queryHandler(q, callback);
        });
    },

    getUsers: function(project_id, callback){

        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));

        var q = "SELECT u.login AS username, \n"+
                "       u.user_id AS id, \n"+
                "       u.email, \n"+
                "       r.name AS rolename \n"+
                "FROM users AS u \n"+
                "JOIN user_project_role AS upr ON u.user_id = upr.user_id \n"+
                "JOIN roles AS r on upr.role_id = r.role_id \n"+
                "WHERE upr.project_id = %s";

        q = util.format(q, project_id);
        queryHandler(q, callback);
    },

    getUsersAsync: function(project_id) {
        let getUsers = util.promisify(this.getUsers)
        return getUsers(project_id)
    },

    addUser: function(userProjectRole, callback) {
        var schema = {
            user_id: joi.number().required(),
            project_id: joi.number().required(),
            role_id: joi.number().required()
        };

        joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);

            var user_id = dbpool.escape(upr.user_id);
            var project_id = dbpool.escape(upr.project_id);
            var role_id = dbpool.escape(upr.role_id);

            var qFind = 'SELECT * FROM user_project_role WHERE user_id = %s AND project_id = %s';

            qFind = util.format(qFind, user_id, project_id);
            queryHandler(qFind, (err, d) => {
                if (err) {
                    return callback(err)
                }
                if (d) {
                    if (d && d.length) {
                        return callback(new APIError("User already attached to the project", 404));
                    }
                    var q = 'INSERT INTO user_project_role \n'+
                    'SET user_id = %s, role_id = %s, project_id = %s';
                    q = util.format(q, user_id, role_id, project_id);
                    queryHandler(q, callback);
                }
            });
        });

    },

    changeUserRole: function(userProjectRole, callback) {
        var schema = {
            user_id: joi.number().required(),
            project_id: joi.number().required(),
            role_id: joi.number().required()
        };

        joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);

            var user_id = dbpool.escape(upr.user_id);
            var project_id = dbpool.escape(upr.project_id);
            var role_id = dbpool.escape(upr.role_id);

            var q = "UPDATE user_project_role \n"+
                    "SET role_id = %s \n"+
                    "WHERE user_id = %s \n"+
                    "AND project_id = %s";

            q = util.format(q, role_id, user_id, project_id);
            queryHandler(q, callback);
        });
    },

    modelList: function(project_url, callback) {
        var q = "(\n" +
                "SELECT m.model_id, \n"+
                "   CONCAT(UCASE(LEFT(m.name, 1)), \n"+
                "   SUBSTRING(m.name, 2)) as mname, \n"+
                "   UNIX_TIMESTAMP( m.`date_created` )*1000 as date, \n"+
                "   CONCAT( \n"+
                "       CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)), \n"+
                "       ' ', \n"+
                "       CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) \n"+
                "   ) as muser, \n" +
                "   mt.name as mtname, \n"+
                "   mt.enabled, \n"+
                "   0 as imported\n" +
                "FROM `models` as m,  \n"+
                "   `model_types` as mt,  \n"+
                "   `users` as u , `projects` as p \n"+
                "WHERE p.url = " + dbpool.escape(project_url)+
                "AND m.`model_type_id` = mt.`model_type_id` \n"+
                "AND m.user_id = u.user_id \n"+
                "AND p.project_id = m.project_id \n"+
                "AND m.deleted = 0\n" +
                ") UNION(\n" +
                "SELECT m.model_id, \n"+
                "   CONCAT(UCASE(LEFT(m.name, 1)), \n"+
                "   SUBSTRING(m.name, 2)) as mname, \n"+
                "   UNIX_TIMESTAMP( m.`date_created` )*1000 as date, \n"+
                "   CONCAT( \n"+
                "       CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)), \n"+
                "       ' ', \n"+
                "       CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) \n"+
                "   ) as muser, \n" +
                "   mt.name as mtname, \n"+
                "   mt.enabled, \n"+
                "   1 as imported\n" +
                "FROM `project_imported_models` as pim,  \n"+
                "   `models` as m,  \n"+
                "   `model_types` as mt,  \n"+
                "   `users` as u , `projects` as p \n"+
                "WHERE p.url = " + dbpool.escape(project_url)+
                "AND m.`model_type_id` = mt.`model_type_id` \n"+
                "AND m.user_id = u.user_id \n"+
                "AND pim.model_id = m.model_id \n"+
                "AND pim.project_id = p.project_id \n"+
                ")\n";

            queryHandler(q, callback);
    },

    trainingSets: function(project_url, callback) {
        var q = (
            "SELECT ( \n"+
            "        SELECT count(x1) \n"+
            "        FROM `training_set_roi_set_data` tsrsd \n"+
            "        WHERE tsrsd.`training_set_id` = ts.`training_set_id` \n"+
            "    ) as count, \n"+
            "    ts.`training_set_id`, \n"+
            "    CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as name, \n"+
            "    ts.`date_created`,  \n"+
            "    CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype, \n"+
            "    CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name, \n"+
            "    tsrs.`species_id`, \n"+
            "    tsrs.`songtype_id` \n"+
            "FROM `training_sets` ts, \n"+
            "    `projects` p, \n"+
            "    `training_sets_roi_set` tsrs, \n"+
            "    `songtypes` st, \n"+
            "    `species` s \n"+
            "WHERE ts.`training_set_id` = tsrs.`training_set_id` \n"+
            "AND st.`songtype_id` = tsrs.`songtype_id` \n"+
            "AND s.`species_id`  = tsrs.`species_id` \n"+
            "AND ts.`project_id` = p.`project_id` \n"+
            "AND p.`url` = " + dbpool.escape(project_url)
        );

        queryHandler(q, callback);
    },

    validationSets: function(project_url, callback) {
        var q = "SELECT `validation_set_id` , ts.`name` \n" +
                "FROM `validation_set` ts, `projects` p \n" +
                "WHERE ts.`project_id` = p.`project_id` \n" +
                "AND p.`url` = " + dbpool.escape(project_url);

        queryHandler(q, callback);
    },

    validationsStats: function(projectUrl, speciesId, songtypeId, callback) {
        var q = "SELECT SUM( present ) AS present, \n"+
                "    (COUNT( present ) - SUM( present )) AS absent, \n"+
                "    COUNT( present ) AS total \n"+
                "FROM `recording_validations` rv, \n"+
                "    `projects` p \n"+
                "WHERE rv.`project_id` = p.`project_id` \n"+
                "AND p.`url` = ? \n"+
                "AND `species_id` = ? \n"+
                "AND `songtype_id` = ? \n"+
                "GROUP BY species_id, songtype_id";

        queryHandler(dbpool.format(q, [projectUrl, speciesId, songtypeId]), function(err, rows) {
            if(err) return callback(err);

            if(!rows.length) {
                var empty = {
                    present: 0,
                    absent: 0,
                    total: 0,
                };

                callback(null, empty);
            }
            else {
                callback(null, rows[0]);
            }
        });
    },

    validationsCount: function(project_id, callback) {
        var q = "SELECT count(*) AS count \n"+
                "FROM recording_validations AS rv\n"+
                "WHERE rv.project_id = " + dbpool.escape(project_id);
        queryHandler(q, callback);
    },

    modelValidationUri: function(model_id, callback) {
        var q = "SELECT vs.`uri` \n"+
                "FROM `validation_set` vs, `models` m \n"+
                "WHERE m.`validation_set_id` = vs.`validation_set_id` \n"+
                "AND m.`model_id` = "+ dbpool.escape(model_id);

        queryHandler(q, callback);
    },

    removeUser: function(user_id, project_id, callback) {
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));

        if(typeof user_id !== 'number')
            return callback(new Error("invalid type for 'user_id'"));

        var q = "DELETE FROM user_project_role \n"+
                "WHERE user_id = %s AND project_id = %s";

        q = util.format(q, dbpool.escape(user_id), dbpool.escape(project_id));
        queryHandler(q, callback);
    },

    availableRoles: function(callback) {
        var q = "SELECT role_id as id, name, description \n"+
                "FROM roles \n"+
                "WHERE name != 'Owner' order by level";

        queryHandler(q, callback);
    },

    // this includes recordings processing
    totalRecordings: function(project_id, callback) {
        var q = "SELECT count(*) as count \n"+
                "FROM ( \n"+
                "    (SELECT upload_id as id \n"+
                "    FROM uploads_processing  \n"+
                "    WHERE project_id = %1$s AND state != 'uploaded' AND state != 'error') \n"+
                "    UNION \n"+
                "    (SELECT recording_id as id \n"+
                "    FROM recordings AS r \n"+
                "    JOIN sites AS s ON s.site_id = r.site_id \n"+
                "    WHERE s.project_id = %1$s) \n"+
                ") as t";

        q = sprintf(q, dbpool.escape(project_id));
        queryHandler(q, callback);
    },

    // this includes recordings processing
    getStorageUsage: function(project_id, callback) {
        return dbpool.query(
            "SELECT COALESCE(sum(t.duration)/60, 0) as min_usage  \n"+
            "FROM ( \n"+
            "    (SELECT u.duration \n"+
            "    FROM uploads_processing as u \n"+
            "    WHERE project_id = ? AND state != 'uploaded') \n"+
            "    UNION ALL \n"+
            "    (SELECT r.duration \n"+
            "    FROM recordings AS r \n"+
            "    JOIN sites AS s ON s.site_id = r.site_id \n"+
            "    WHERE s.project_id = ?) \n"+
            ") as t;", [project_id, project_id]
        ).get(0);
    },

    createInCoreAPI: async function(project, idToken) {
        const body = {
            name: project.name,
            description: project.description,
            is_public: !project.is_private,
            external_id: project.project_id
        }
        const options = {
            method: 'POST',
            url: `${rfcxConfig.apiBaseUrl}/projects`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify(body)
          }
          return rp(options)
    },

    findInCoreAPI: async function (guid) {
        const token = await auth0Service.getToken();
        const options = {
            method: 'GET',
            url: `${rfcxConfig.apiBaseUrl}/v1/sites/${guid}`, // TODO: this should be changed once Core API fully migrate from MySQL to TimescaleDB
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            json: true
          }

        return rp(options).then(({ body }) => {
            if (!body || !body.length) {
                throw new EmptyResultError('External project with given guid not found.');
            }
            return body[0]
        })
    }
};


module.exports = Projects;
