/* jshint node:true */
"use strict";

const util = require('util');
const joi = require('joi');
const q = require('q');
const request = require('request');
const rp = util.promisify(request);
const { ValidationError } = require('@rfcx/http-utils');

const config = require('../config');
const rfcxConfig = config('rfcx');
const fileHelper = require('../utils/file-helper')
const dbpool = require('../utils/dbpool');
const sqlutil = require('../utils/sqlutil');
const queryHandler = dbpool.queryHandler;
const APIError = require('../utils/apierror');
const species = require('./species');
const songtypes = require('./songtypes');
const roles = require('./roles')

const projectSchema = joi.object().keys({
    name: joi.string(),
    url: joi.string(),
    description: joi.string().optional(),
    is_private: joi.boolean(),
    external_id: joi.string().optional(),
});

var Projects = {

    countAllProjects: async function() {
        const q = 'SELECT count(*) AS count FROM projects';

        return dbpool.query(q).get(0).get('count')
    },

    getCachedMetrics: async function(key) {
        const q = `SELECT * FROM cached_metrics cm
                 WHERE cm.key = '${key}'`

        return dbpool.query(q)
    },

    updateCachedMetrics: async function(opts) {
        const q = `UPDATE cached_metrics cm
                SET cm.value = ${opts.value}, cm.expires_at = '${opts.expiresAt}'
                WHERE cm.key = '${opts.key}'`

        return dbpool.query(q)
    },

    insertCachedMetrics: async function(opts) {
        const {key, value, expiresAt} = opts
        const q = 'INSERT INTO cached_metrics(`key`, value, expires_at) VALUES (?,?,?)'
        return dbpool.query(q, [
            key,
            value,
            expiresAt
        ])
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
        if(query.hasOwnProperty("external_id")) {
            whereExp.push("p.external_id = ?");
            data.push(query.external_id);
        }
        if(query.hasOwnProperty("url")) {
            whereExp.push("p.url = ?");
            data.push(query.url);
        }
        if(query.hasOwnProperty("name")) {
            whereExp.push("p.name = ?");
            data.push(query.name);
        }
        if(query.hasOwnProperty("user_id")) {
            selectExtra += 'upr.role_id, '
            joinExtra += 'JOIN user_project_role AS upr ON (p.project_id = upr.project_id) \n'
            whereExp.push("upr.user_id = ?");
            data.push(query.user_id);
        }
        if(query.hasOwnProperty("include_location")) {
            selectExtra += 'site.lat as lat, site.lon as lon, '
            joinExtra += 'LEFT JOIN (SELECT project_id, lat, lon, MAX(site_id) as maxSiteId FROM sites GROUP BY project_id) site ON p.project_id = site.project_id \n'
            whereExp.push("1 = 1");
        }
        if(query.hasOwnProperty('q')) {
            whereExp.push("(p.name LIKE '%"+query.q+"%' OR p.description LIKE '%"+query.q+"%')");
        }
        if(query.hasOwnProperty('featured')) {
            selectExtra += 'featured, image, '
            whereExp.push("p.featured = 1 OR p.featured = 2");
        }

        if(!whereExp.length) {
            return q.reject(new Error('no query params'));
        }

        if (query.hasOwnProperty('publicTemplates')) {
            whereExp.push('p.deleted_at IS NULL');
        }

        if(!query.basicInfo){
            selectExtra += "   p.citizen_scientist_enabled, \n"+
                          "   p.pattern_matching_enabled, \n"+
                          "   p.reports_enabled, \n"+
                          "   p.is_partner, \n"+
                          "   p.cnn_enabled \n";
        } else {
            selectExtra += "p.project_id as id \n";
        }

        let que = "SELECT p.* " + (selectExtra ? ", \n" + selectExtra : "\n") +
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
        return dbpool.query({ sql:
                "SELECT s.site_id as id, \n"+
                "       s.name, \n"+
                "       s.lat, \n"+
                "       s.lon, \n"+
                "       s.alt, \n"+
                "       s.timezone, \n"+
                "       s.published, \n"+
                "       s.updated_at, \n"+
                "       s.external_id, \n"+
                "       s.timezone_locked, \n"+
                "       s.project_id != ? AS imported, \n"+
                "       s.token_created_on, s.country_code \n" +
                "FROM sites AS s \n"+
                "LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = ? \n"+
                "WHERE (s.project_id = ? OR pis.project_id = ?) AND s.deleted_at is null",  typeCast: sqlutil.parseUtcDatetime },
                [project_id, project_id, project_id, project_id]
        ).then(function(sites){
            if(sites.length && options && options.compute){
                var sitesById={}, siteIds = sites.map(function(site){
                    sitesById[site.id] = site;
                    return site.id;
                });

                return q.all([
                    options.compute.rec_count ? dbpool.query(
                        "SELECT site_id, COUNT(recording_id) as rec_count "+
                        "FROM recordings "+
                        "WHERE site_id IN (?) " +
                        "GROUP BY site_id",
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
                    if (options.utcDiff) {
                        const result = sites.map(s => {
                            return {
                                ...s,
                                utcOffset: fileHelper.formattedTzOffsetFromTimezoneName(s.timezone)
                            }
                        })
                        return result
                    }
                    else return sites;
                });
            }
            return sites;
        });
    },

    exportProjectSites(project_id){
        const sql = `SELECT s.site_id as Id, s.name as Name, s.lat as Latitude, s.lon as Longitude, s.alt as Altitude, s.timezone as Timezone, COUNT(recording_id) as Recordings_Count
            FROM sites AS s
            LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id=${project_id}
            LEFT JOIN recordings as r ON s.site_id = r.site_id
            WHERE (s.project_id=${project_id} OR pis.project_id=${project_id}) AND s.deleted_at is null
            GROUP BY s.site_id ORDER by s.name;`;
        return dbpool.streamQuery({ sql })
    },

    getProjectDates: function(project_id, format){
        return dbpool.query({ sql:
            `SELECT COALESCE(DATE_FORMAT(r.datetime, "${format}")) as date
            FROM recordings AS r
            JOIN sites as s ON s.site_id = r.site_id AND s.project_id = ? AND s.deleted_at is null
            LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = ?
            WHERE s.project_id = ? OR pis.project_id = ?
            GROUP BY YEAR(r.datetime), MONTH(r.datetime), DAY(r.datetime) ORDER BY r.datetime ASC`,  typeCast: sqlutil.parseUtcDatetime },
            [project_id, project_id, project_id, project_id]
        )
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
     * creates a project and adds the creator to the project as
     * owner on user_project_role
     * @param {Object} project
     * @param {String} project.name
     * @param {String} project.url
     * @param {String} project.description
     * @param {Number} project.owner_id - creator id
     * @param {Number} project.project_type_id
     * @param {Boolean} project.is_private
    */
    create: async function(project, owner_id, db) {
        var schema = joi.object().keys({
            name: joi.string(),
            url: joi.string(),
            description: joi.string().optional(),
            external_id: joi.string().optional(),
            project_type_id: joi.number(),
            is_private: joi.boolean()
        });

        var result = joi.validate(project, schema, {
            stripUnknown: true,
            presence: 'required',
        });

        if(result.error) {
            return callback(result.error);
        }

        project = result.value;

        project.storage_usage = 0;
        project.processing_usage = 0;
        project.pattern_matching_enabled = 1;
        project.aed_enabled = 1;
        project.clustering_enabled = 1;
        project.reports_enabled = 1;
        project.public_templates_enabled = 1;

        if (!db) {
            db = await dbpool.getConnection()
            await db.beginTransaction()
        }
        try {
            const result = await this.runProjectCreationQueue(db, project, owner_id);
            await db.commit()
            return result
        } catch (e) {
            await db.rollback();
            await db.release();
        }
    },

    runProjectCreationQueue: async function(connection, project, owner_id) {
        let queryAsync = util.promisify(connection.query);
        let result = await queryAsync('INSERT INTO projects SET ?', project);
        let projectId = result.insertId;
        let values = {
            user_id: owner_id,
            project_id: projectId,
            role_id: 4
        };
        await queryAsync('INSERT INTO user_project_role SET ?', values);
        return projectId;
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
     * @param {Number} project.storage_usage
     * @param {Number} project.processing_usage
     * @param {Function} callback(err, projectId)
     *
     * @return {Promise} resolved after the update.
    */
    update: function(project, db, callback) {

        var schema = {
            project_id: joi.number().required(),
            name: joi.string(),
            url: joi.string(),
            description: joi.string().allow(null, '').optional(),
            project_type_id: joi.number(),
            is_private: [joi.number().valid(0,1), joi.boolean()],
            is_enabled: [joi.number().valid(0,1), joi.boolean()],
            storage_usage: joi.number().allow(null),
            processing_usage: joi.number().allow(null),
            citizen_scientist_enabled: [joi.number().valid(0,1), joi.boolean()],
            pattern_matching_enabled: [joi.number().valid(0,1), joi.boolean()],
            cnn_enabled: [joi.number().valid(0,1), joi.boolean()],
            aed_enabled: [joi.number().valid(0,1), joi.boolean()],
            clustering_enabled: [joi.number().valid(0,1), joi.boolean()],
            reports_enabled: [joi.number().valid(0,1), joi.boolean()],
            public_templates_enabled: [joi.number().valid(0,1), joi.boolean()]
        };
        return q.ninvoke(joi, 'validate', project, schema).then(function(projectInfo){
            var projectId = projectInfo.project_id;
            delete projectInfo.project_id;

            return q.all([
                (db? db.query : dbpool.query)(
                    'UPDATE projects\n'+
                    'SET ?\n'+
                    'WHERE project_id = ?', [
                    projectInfo, projectId
                ])
            ]);
        }).nodeify(callback);
    },

    updateAsync: function (project, connection) {
        let update = util.promisify(this.update)
        return update(project, connection)
    },

    updateProjectLocation: async function(projectId, lat, lon) {
        if (!projectId || !lat || !lon) return
        const config = {
            method: 'get',
            url: `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=5a8e8fdff1f44dbda20ca67b4e99362b`,
            headers: { }
        };
        console.log('config', config)
        return rp(config).then((response) => {
            try {
                const body = JSON.parse(response.body);
                console.log('body.features[0].properties', body.features[0].properties)
                if (body && body.error) {
                    throw new Error('Failed to update project location');
                }
                const props = body.features[0].properties
                if (!props.country || !props.state) return
                const q = `UPDATE projects SET country = '${props.country}', state = '${props.state}' WHERE project_id=${projectId}`;
                console.log(q)
                return dbpool.query(q);
            } catch (e) {
                throw new Error('Failed to update project location');
            }
        })
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

        let select_clause = [
            "pc.project_class_id as id",
            "pc.project_id as project",
            "pc.species_id as species",
            "pc.songtype_id as songtype",
            "st.taxon",
            "sp.scientific_name as species_name",
            "so.songtype as songtype_name"
        ];
        let from_clause = [
            "project_classes AS pc",
            "JOIN species AS sp ON sp.species_id = pc.species_id",
            "JOIN songtypes AS so ON so.songtype_id = pc.songtype_id",
            "JOIN species_taxons AS st ON st.taxon_id = sp.taxon_id"
        ];
        let params = [];
        let where_clause = [];
        let groupby_clause = [];

        where_clause.push('pc.project_id = ?')
        params.push(projectId)
        if(classId) {
            where_clause.push("pc.project_class_id = ?");
            params.push(classId);
        }
        if(options && options.ids){
            if(options.noProject){
                params = [];
                where_clause = [];
            }
            where_clause.push("pc.project_class_id IN (?)");
            params.push(options.ids);
        }
        if (options.q) {
            where_clause.push(`sp.scientific_name LIKE '%${options.q}%'`);
        }
        if (options && options.speciesId && options.songtypeId) {
            where_clause.push('pc.species_id = ? AND pc.songtype_id = ?');
            params.push(options.speciesId);
            params.push(options.songtypeId);
        }
        if (options && options.countValidations) {
            // Get count of present/absent values for the Recordings filter.
            select_clause.push(
                "coalesce(SUM(CASE WHEN rv.present_review > 0 OR rv.present_aed > 0 THEN 1 ELSE rv.present END), 0) as vals_present",
                "coalesce(SUM(CASE WHEN rv.present = 0 AND rv.present_review = 0 AND rv.present_aed = 0 THEN 1 ELSE 0 END), 0) as vals_absent"
            );
            from_clause.push(
                `LEFT JOIN recording_validations AS rv ON (
                    rv.songtype_id = pc.songtype_id
                    AND rv.species_id = pc.species_id
                    AND rv.project_id = pc.project_id
                )`
            );
            groupby_clause.push("pc.species_id", "pc.songtype_id");
        }

        return q.nfcall(queryHandler, dbpool.format(
            "SELECT " + select_clause.join(", \n") + "\n" +
            "FROM " + from_clause.join("\n") + "\n" +
            "WHERE (" + where_clause.join(") AND (") + ")" +
            (groupby_clause.length ? "\nGROUP BY " + groupby_clause.join(",") : ""),
            params) +
            (options.limit ? ("\nLIMIT " + Number(options.limit) + " OFFSET " + Number(options.offset)) : "")
        ).get(0).nodeify(callback);
    },

    getProjectClassesAsync: function(projectId, classId, options) {
        let getProjectClasses = util.promisify(this.getProjectClasses)
        return getProjectClasses(projectId, classId, options)
    },

    getProjectClassesWithPagination: async function (projectId, options) {
        const count = options.q ? await Projects.totalProjectClasses(
            projectId,
            `JOIN species AS sp ON sp.species_id = pc.species_id
             JOIN songtypes AS so ON so.songtype_id = pc.songtype_id
             JOIN species_taxons AS st ON st.taxon_id = sp.taxon_id`,
            ` AND sp.scientific_name LIKE '%${options.q}%'`
        ) : await Projects.totalProjectClasses(projectId);
        console.log('count', count)
        if (count) {
            const list =  await Projects.getProjectClassesAsync(projectId, null, options);
            return { list: list, count: count }
        }
        else return { list: [], count: 0 }
    },

    totalProjectClasses: async function(projectId, join, where) {
        let q = `SELECT count(*) as count
        FROM project_classes as pc
        ${join ? join : ''}
        WHERE pc.project_id = ${dbpool.escape(projectId)} ${where ? where : ''}`;
        return dbpool.query(q).get(0).get('count');
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

    insertClassAsync: function(projectClass) {
        const {projectId, specieId, songtypeId} = projectClass
        const sql = `INSERT INTO project_classes(project_id, species_id, songtype_id)
        VALUES(${projectId}, ${specieId}, ${songtypeId})`
        return dbpool.query(sql)
    },

    checkClassAsync: function(projectClass) {
        const {projectId, specieId, songtypeId} = projectClass
        const sql = `SELECT * FROM project_classes
        WHERE project_id = ${projectId} AND species_id = ${specieId} AND songtype_id = ${songtypeId}`
        return dbpool.query(sql)
    },

    updateProjectInAnalyses: async function(originalProjectId, newProjectId, siteId) {
        const sql = `UPDATE recording_validations rv
        LEFT JOIN recordings r on r.recording_id = rv.recording_id
        SET rv.project_id = ${newProjectId}
        WHERE rv.project_id = ${originalProjectId}
            AND r.site_id = ${siteId}`
        return dbpool.query(sql);
    },

    getProjectValidationsBySite: async function(projectId, siteId) {
        const sql = `SELECT rv.species_id, rv.songtype_id
        FROM recording_validations rv
        LEFT JOIN recordings r on r.recording_id = rv.recording_id
        WHERE rv.project_id = ${projectId}
            AND r.site_id = ${siteId}
            AND (rv.present = 1 OR rv.present_review > 0 OR rv.present_aed > 0);`
        return dbpool.query(sql);
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

    removeClassesAsync: function(project_classes) {
        let removeClasses = util.promisify(this.removeClasses)
        return removeClasses(project_classes)
    },

    getUsers: function(project_id, callback){

        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));

        var q = "SELECT u.login AS username, \n"+
                "       u.firstname, u.lastname, \n"+
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

    findByEmail: function(email, callback) {
        var q = 'SELECT * \n' +
                'FROM users \n' +
                'WHERE email = %s';
        q = util.format(q, dbpool.escape(email));
        queryHandler(q, callback);
    },

    findByEmailAsync: function(email) {
        let findByEmail = util.promisify(this.findByEmail)
        return findByEmail(email)
    },

    addUser: function(userProjectRole, connection, callback) {
        var schema = {
            user_email: joi.string(),
            project_id: joi.number().required(),
            role_id: joi.number().required()
        };

        joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);

            var user_email = upr.user_email;
            var project_id = dbpool.escape(upr.project_id);
            var role_id = dbpool.escape(upr.role_id);

            var qFind = `SELECT upr.* FROM users u
                JOIN user_project_role upr on upr.user_id = u.user_id
                WHERE u.email = '%s' AND upr.project_id = %s`;

            qFind = util.format(qFind, user_email, project_id);
            queryHandler(qFind, async (err, d) => {
                if (err) {
                    return callback(err)
                }
                if (d) {
                    const [user] = await Projects.findByEmailAsync(user_email)
                    if (d && d.length) {
                        var q = "UPDATE user_project_role \n"+
                        "SET role_id = %s \n"+
                        "WHERE user_id = %s \n"+
                        "AND project_id = %s";
                        q = util.format(q, role_id, user.user_id, project_id);
                        connection ? connection.query(q, callback) : queryHandler(q, callback);
                    }  else {
                        var q = 'INSERT INTO user_project_role \n'+
                        'SET user_id = %s, role_id = %s, project_id = %s';
                        q = util.format(q, user.user_id, role_id, project_id);
                        connection ? connection.query(q, callback) : queryHandler(q, callback);
                    }
                }
            });
        });

    },

    addUserAsync: function(userProjectRole, connection) {
        let addUser = util.promisify(this.addUser)
        return addUser(userProjectRole, connection)
    },

    changeUserRole: function(userProjectRole, connection, callback) {
        var schema = {
            user_email: joi.string(),
            project_id: joi.number().required(),
            role_id: joi.number().required()
        };

        joi.validate(userProjectRole, schema, async function(err, upr){
            if(err) return callback(err);

            const [user] = await Projects.findByEmailAsync(userProjectRole.user_email)
            var user_id = user.user_id;
            var project_id = dbpool.escape(upr.project_id);
            var role_id = dbpool.escape(upr.role_id);

            var q = "UPDATE user_project_role \n"+
                    "SET role_id = %s \n"+
                    "WHERE user_id = %s \n"+
                    "AND project_id = %s";

            q = util.format(q, role_id, user_id, project_id);
            connection ? connection.query(q, callback) : queryHandler(q, callback);
        });
    },

    changeUserRoleAsync: function(userProjectRole, connection) {
        let changeUserRole = util.promisify(this.changeUserRole);
        return changeUserRole(userProjectRole, connection);
    },

    updateUserRoleInArbimonAndCoreAPI: async function(options, token, action) {
        let connection;
        return dbpool.getConnection()
            .then(async (con) => {
                connection = con;
                await connection.beginTransaction();
                switch (action) {
                    case 'add':
                        await this.addUserAsync(options.userRole, connection);
                        if (rfcxConfig.coreAPIEnabled) {
                            await this.updateUserRoleInCoreAPI(options.userRole, token);
                        }
                        break;
                    case 'change':
                        await this.changeUserRoleAsync(options.userRole, connection);
                        if (rfcxConfig.coreAPIEnabled) {
                            await this.updateUserRoleInCoreAPI(options.userRole, token);
                        }
                        break;
                    case 'remove':
                      await this.removeUserRoleAsync(options.user_email, options.project_id, connection);
                      if (rfcxConfig.coreAPIEnabled) {
                        await this.removeUserRoleInCoreAPI(options.user_email, options.project_id, token);
                    }
                      break;
                }
                await connection.commit();
                await connection.release();
            })
            .catch(async (err) => {
                console.log('err', err);
                if (connection) {
                    await connection.rollback();
                    await connection.release();
                }
                throw new APIError('Failed to set user role', err.status ? err.status : 500);
            })
    },

    updateUserRoleInCoreAPI: async function(userProjectRole, token) {
        const project = await this.findById(userProjectRole.project_id)
        if (!project.external_id) {
            throw new ValidationError(`Project "${project.name}" data is invalid. Please contact to support.`)
        }

        const role = roles.getCoreRoleById(userProjectRole.role_id)
        var body = {
            email: userProjectRole.user_email,
            role: role
        }

        const options = {
            method: 'PUT',
            url: `${rfcxConfig.apiBaseUrl}/projects/${project.external_id}/users`,
            headers: {
                'content-type': 'application/json',
                Authorization: token,
                source: 'arbimon'
            },
            body: JSON.stringify(body)
        }
        const result = await rp(options)
        if (result.statusCode !== 201) {
            console.error(result.body)
            throw new Error(result.body)
        }
    },

    removeUserRoleInCoreAPI: async function(user_email, project_id, token) {
        const project = await this.findById(project_id)
        if (!project.external_id) {
            throw new ValidationError(`Project "${project.name}" data is invalid. Please contact to support.`)
        }

        var body = {
            email: user_email
        }

        const options = {
            method: 'DELETE',
            url: `${rfcxConfig.apiBaseUrl}/projects/${project.external_id}/users`,
            headers: {
                'content-type': 'application/json',
                Authorization: token,
                source: 'arbimon'
            },
            body: JSON.stringify(body)
        }
        const result = await rp(options)
        if (result.statusCode !== 200) {
            console.error(result.body)
            throw new Error(result.body)
        }
    },

    modelList: function(project_url, callback) {
        var q = "(\n" +
                "SELECT m.model_id, \n"+
                "   CONCAT(UCASE(LEFT(m.name, 1)), \n"+
                "   SUBSTRING(m.name, 2)) as mname, \n"+
                "   UNIX_TIMESTAMP( m.`date_created` )*1000 as date, \n"+
                "   m.date_created, \n"+
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
                "   m.date_created, \n"+
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
                ") ORDER BY date_created DESC\n";
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
        var q = "SELECT coalesce(SUM(CASE WHEN present_review > 0 OR present_aed > 0 THEN 1 ELSE present END), 0) AS present, \n"+
                "coalesce(SUM(CASE WHEN present = 0 AND present_review = 0 AND present_aed = 0 THEN 1 ELSE 0 END), 0) AS absent, \n"+
                "(coalesce(SUM(CASE WHEN present_review > 0 OR present_aed > 0 THEN 1 ELSE present END), 0)+coalesce(SUM(CASE WHEN present = 0 AND present_review = 0 AND present_aed = 0 THEN 1 ELSE 0 END), 0)) AS total \n"+
                "FROM `recording_validations` rv, `projects` p \n"+
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
        const q = "SELECT count(*) AS count \n"+
                "FROM recording_validations AS rv\n"+
                "WHERE rv.project_id = " + dbpool.escape(project_id) + " \n"+
                "AND rv.present is not null OR rv.present_review > 0 OR rv.present_aed > 0";
        queryHandler(q, callback);
    },

    modelValidationUri: function(model_id, callback) {
        var q = "SELECT vs.`uri` \n"+
                "FROM `validation_set` vs, `models` m \n"+
                "WHERE m.`validation_set_id` = vs.`validation_set_id` \n"+
                "AND m.`model_id` = "+ dbpool.escape(model_id);

        queryHandler(q, callback);
    },

    removeUser: function(user_email, project_id, connection, callback) {
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));

        var q = "DELETE FROM user_project_role \n"+
                "WHERE user_id = %s AND project_id = %s";

        Projects.findByEmailAsync(user_email).then((user) => {
            q = util.format(q, user[0].user_id, dbpool.escape(project_id));
            connection ? connection.query(q, callback) : queryHandler(q, callback);
        })
    },

    removeUserRoleAsync: function(user_email, project_id, connection) {
        let removeUser = util.promisify(this.removeUser)
        return removeUser(user_email, project_id, connection)
    },

    availableRoles: function(callback) {
        var q = "SELECT role_id as id, name, description \n"+
                "FROM roles \n"+
                "WHERE name != 'Owner' order by level";

        queryHandler(q, callback);
    },

    // this includes recordings processing
    totalRecordings: function(projectId) {
        const q = "SELECT count(recording_id) as count \n" +
                "FROM recordings AS r JOIN sites AS s ON s.site_id = r.site_id AND s.deleted_at is null \n"+
                "WHERE s.project_id = " + dbpool.escape(projectId);
        return dbpool.query(q).get(0).get('count');
    },

    recordingsMinMaxDates: function (project_id, callback) {
        const q = `SELECT min(r.datetime) as min, max(r.datetime) as max FROM recordings r
            JOIN sites s ON r.site_id = s.site_id WHERE s.project_id = ` + dbpool.escape(project_id)
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

    createProjectInArbimonAndCoreAPI: async function(project, userId, token) {
        let connection;
        return dbpool.getConnection()
            .then(async (con) => {
                connection = con;
                await connection.beginTransaction();
                let newProjectId = await this.createProject(project, userId, connection);
                project.project_id = newProjectId;
                if (rfcxConfig.coreAPIEnabled) {
                    let externalProjectId = await this.createInCoreAPI(project, token);
                    await this.setExternalId(project.project_id, externalProjectId, connection);
                }
                await connection.commit()
                await connection.release()
            })
            .catch(async (err) => {
                console.log('Failed to create project', err);
                if (connection) {
                    await connection.rollback();
                    await connection.release();
                }
                throw new APIError('Failed to create project');
            })
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
                Authorization: `Bearer ${idToken}`,
                source: 'arbimon'
            },
            body,
            json: true
          }
        return rp(options).then((response) => {
            if (response.statusCode === 201 && response.headers.location) {
                const regexResult = /\/projects\/(\w+)$/.exec(response.headers.location)
                if (regexResult) {
                    return regexResult[1]
                }
                throw new Error(`Unable to parse location header: ${response.headers.location}`)
            }
            throw new Error(`Unexpected status code or location header: ${response.statusCode} ${response.headers.location}`)
        })
    },

    updateProjectInArbimonAndCoreAPI: async function(data, token) {
        let connection;
        return dbpool.getConnection()
            .then(async (con) => {
                connection = con;
                await connection.beginTransaction();
                await this.update(data, connection);
                if (rfcxConfig.coreAPIEnabled) {
                    await this.updateInCoreAPI(data, token);
                }
                await connection.commit()
                await connection.release()
            })
            .catch(async (err) => {
                console.log('Failed to update project', err);
                if (connection) {
                    await connection.rollback();
                    await connection.release();
                }
                throw new APIError('Failed to update project');
            })
    },


    updateInCoreAPI: async function(data, idToken) {
        let body = {}
        data.name !== undefined && (body.name = data.name)
        data.description !== undefined && (body.description = data.description)
        data.is_private !== undefined && (body.is_public = !data.is_private)
        const options = {
            method: 'PATCH',
            url: `${rfcxConfig.apiBaseUrl}/internal/arbimon/projects/${data.project_id}`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`,
                source: 'arbimon'
            },
            body: JSON.stringify(body)
        }
        return rp(options).then((response) => {
            try {
                const body = JSON.parse(response.body);
                if (body && body.error) {
                    throw new APIError('Failed to update project');
                }
            } catch (e) { }
        })
    },

    deleteInCoreAPI: async function(project_id, idToken) {
        let body = {}
        const options = {
            method: 'DELETE',
            url: `${rfcxConfig.apiBaseUrl}/projects/${project_id}`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`,
                source: 'arbimon'
            },
            body: JSON.stringify(body)
        }
        return rp(options).then((response) => {
            try {
                const body = JSON.parse(response.body);
                if (body && body.error) {
                    throw new APIError('Failed to delete project');
                }
            } catch (e) { }
        })
    },

    setExternalId: function (projectId, externalId, connection) {
        return (connection? connection.query : dbpool.query)(`UPDATE projects SET external_id = "${externalId}" WHERE project_id = ${projectId}`, [])
    },

    /**
     * Finds unique url value which doesn't exist in db by iterating over several combinations
     * @param {*} name project name
     * @param {*} externalId external id
     * @param {*} userId user id
     */
    findUniqueUrl: async function (name, externalId, userId) {
        const n = this.nameToUrl(name)
        const random = Math.round(Math.random() * 100000000)
        const possibilities = [ n, `${externalId}-${n}`,  `${userId}-${externalId}-${n}`, `${userId}-${externalId}-${random}-${n}`]
        for (let url of possibilities) {
            const existingProject = await this.find({ url }).get(0)
            if (!existingProject) {
                return url
            }
        }
    },

    /**
     * Creates a project with given data
     * @param {*} data
     * @param {string} data.name
     * @param {string} data.description
     * @param {string} data.url
     * @param {boolean} data.is_private
     * @param {integer} userId
     */
    createProject: async function (data, userId, connection) {
        const projectData = {
            project_type_id: 1,
            ...data
        }
        await q.ninvoke(joi, 'validate', projectData, projectSchema, {
            stripUnknown: true,
            presence: 'required',
        });
        const id = await this.create(projectData, userId, connection);
        return id;
    },

    removeProject: async function(options) {
        let db;
        return dbpool.getConnection()
            .then(async (connection) => {
                db = connection;
                await db.beginTransaction();
                await this.deleteInArbimobDb(options.project_id, db);
                if (rfcxConfig.coreAPIEnabled) {
                    await this.deleteInCoreAPI(options.external_id, options.idToken)
                };
                await db.commit();
                await db.release();
            })
            .catch(async (err) => {
                console.log('err', err)
                if (db) {
                    await db.rollback();
                    await db.release();
                }
                throw new APIError('Failed to delete project');
            })
    },

    deleteInArbimobDb: async function(project_id, db) {
        return db.query(
            "UPDATE projects SET deleted_at = NOW() \n"+
            "WHERE project_id = ?",[
                project_id
            ]);
    },

    /**
     * Gets personal project url for given user
     * @param {*} user
     * @param {integer} user.user_id
     * @param {string} user.firstname
     */
    getPersonalProjectUrl: function (user) {
        return `${user.user_id}-${this.nameToUrl(user.firstname)}-project`
    },

    /**
     * Removes everything except latin characters, replaces spaces with dashes
     * @param {*} name
     */
    nameToUrl: function (name) {
        return name.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()
    },

    /**
     * Creates personal project for given user
     * @param {*} user
     * @param {integer} user.user_id
     * @param {string} user.firstname
     * @param {string} user.lastname
     */
    findOrCreatePersonalProject: async function (user) {
        const projectData = {
            is_private: true,
            name: `${user.firstname} ${user.lastname}'s project`,
            url: this.getPersonalProjectUrl(user),
            description: `${user.firstname}'s personal project`,
            project_type_id: 1
        };
        await q.ninvoke(joi, 'validate', projectData, projectSchema, {
            stripUnknown: true,
            presence: 'required',
        });
        const projWithExistingUrl = await this.find({ url: projectData.url }).get(0);
        if (projWithExistingUrl) {
            return projWithExistingUrl
        }
        const projectId = await q.ninvoke(this, "create", projectData, user.user_id)
        return this.find({ id: projectId }).get(0)
    },

    /**
     * Checks whether user has permission for the project or not
     * @param {integer} projectId
     * @param {integer} userId
     */
    userHasPermission: async function (projectId, userId) {
        const projectUsers = await this.getUsersAsync(projectId);
        const hasPermission = !!projectUsers.find(x => x.id === userId);
        return !!hasPermission
    }
};


module.exports = Projects;
