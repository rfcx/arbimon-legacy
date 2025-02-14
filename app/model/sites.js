var util = require('util');
var AWS   = require('aws-sdk');
var joi = require('joi');
var q = require('q');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');
const rfcxConfig = config('rfcx');
var request = require('request');
var rp = util.promisify(request);
var tzlookup = require("tz-lookup");
var s3;
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;
const moment = require('moment');
let APIError = require('../utils/apierror');
const projects = require('./projects')

var Sites = {

    find: function (query, callback) {
        var whereExp = [], data=[];
        var selectExtra = '';
        var joinExtra = '';

        whereExp.push('s.deleted_at is null')

        if(query.hasOwnProperty("id")) {
            whereExp.push("s.site_id = ?");
            data.push(query.id);
        }
        if(query.hasOwnProperty("project_id")) {
            whereExp.push("s.project_id = ?");
            data.push(query.project_id);
        }
        if(query.hasOwnProperty("external_id")) {
            whereExp.push("s.external_id = ?");
            data.push(query.external_id);
        }
        if(query.hasOwnProperty("name")) {
            whereExp.push("s.name = ?");
            data.push(query.name);
        }

        if(!whereExp.length) {
            return q.reject(new Error('no query params'));
        }

        return dbpool.query(
            "SELECT s.*" + (selectExtra ? ", \n" + selectExtra : "\n") +
            "FROM sites AS s \n" + joinExtra +
            "WHERE (" + whereExp.join(") \n" +
            "  AND (") + ")", data
        ).nodeify(callback);
    },

    findAsync: function(query) {
        let find = util.promisify(this.find)
        return find(query)
    },

    findById: function (site_id, callback) {
        var query = "SELECT * FROM sites WHERE site_id = " + dbpool.escape(site_id);

        return queryHandler(query , callback);
    },

    findByIdAsync: function(site_id) {
        let find = util.promisify(this.findById)
        return find(site_id)
    },

    getSiteExternalId: function(site_id, callback) {
        return dbpool.query(`SELECT external_id FROM sites WHERE site_id=${site_id}`).get(0).get('external_id').nodeify(callback);
    },

    getSiteTimezone: function(site_id, callback) {
        return dbpool.query(`SELECT timezone FROM sites WHERE site_id=${site_id}`).get(0).get('timezone').nodeify(callback);
    },

    getSiteTimezoneAsync: async function(site_id) {
        return dbpool.query(`SELECT timezone FROM sites WHERE site_id=${site_id}`).get(0).get('timezone');
    },

    isEmptyCoordinate: function(l) {
        if (!l || l === null || l === undefined) return true
        return Number(l) === 0
    },

    insert: function(site, db, callback) {
        var values = [];
        site.hidden = (site.hidden === 1 || site.hidden === true || site.hidden === 'true') ? 1 : 0

        var schema = {
            project_id: joi.number(),
            name: joi.string(),
            lat: joi.number().optional().default(null),
            lon: joi.number().optional().default(null),
            alt: joi.number().optional().default(null),
            site_type_id: joi.number().optional().default(2), // default mobile recorder
            external_id: joi.string().optional().default(null),
            hidden: joi.number().optional().default(0)
        };

        var result = joi.validate(site, schema, {
            stripUnknown: true,
            presence: 'required',
        });

        if(result.error) {
            return callback(result.error);
        }

        site = result.value;
        if (site['lat'] !== undefined && Sites.isEmptyCoordinate(site.lat)) site.lat = null
        if (site['lon'] !== undefined && Sites.isEmptyCoordinate(site.lon)) site.lon = null

        for(var j in site) {
            if(j !== 'id') {
                values.push(util.format('%s = %s',
                    dbpool.escapeId(j),
                    dbpool.escape(site[j])
                ));
            }
        }

        var q = 'INSERT INTO sites \n'+
                'SET %s';

        q = util.format(q, values.join(", "));
        db ? db.query(q, callback) : queryHandler(q, callback);
    },

    insertAsync: function(site, connection) {
        let insert = util.promisify(this.insert)
        return insert(site, connection)
    },

    update: async function(site, connection, callback) {
        let values = [];

        if(site.id)
            site.site_id = site.id;
            delete site.id;

        if(typeof site.site_id === "undefined")
            return callback(new Error("required field 'site_id' missing"));

        if (site['lat'] !== undefined && Sites.isEmptyCoordinate(site.lat)) site.lat = null
        if (site['lon'] !== undefined && Sites.isEmptyCoordinate(site.lon)) site.lon = null

        if (site.name !== undefined) {
            site['updated_at'] = moment.utc(new Date()).format();
        }

        if (site.lat !== undefined || site.lon !== undefined || site.alt !== undefined || site.project_id) {
            site['updated_at'] = moment.utc(new Date()).format();
        }

        if (site.deletedAt) {
            const nowFormatted = moment.utc().format('YYYY-MM-DD HH:mm:ss')
            site['deleted_at'] = nowFormatted
            site['updated_at'] = nowFormatted
        }

        site.hidden = (site.hidden === 1 || site.hidden === true || site.hidden === 'true') ? 1 : 0

        var tableFields = [
            "project_id",
            "name",
            "lat",
            "lon",
            "alt",
            "published",
            "site_type_id",
            "timezone",
            "updated_at",
            "deleted_at",
            "hidden"
        ];

        for( var i in tableFields) {
            if(site[tableFields[i]] !== undefined) {
                var key = tableFields[i];
                var value = site[key];

                values.push(util.format('%s = %s',
                    dbpool.escapeId(key),
                    dbpool.escape(value)
                ));
            }
        }

        var q = 'UPDATE sites \n'+
                'SET %s \n'+
                'WHERE site_id = %s';

        q = util.format(q, values.join(", "), site.site_id);

        connection ? connection.query(q, callback) : queryHandler(q, callback);
    },

    updateAsync: function (site, connection) {
        let update = util.promisify(this.update)
        return update(site, connection)
    },

    exists: function(site_name, project_id, callback) {
        var q = 'SELECT count(*) as count \n'+
                'FROM sites \n'+
                'WHERE name = %s \n'+
                'AND project_id = %s AND deleted_at is null';

        q = util.format(q,
            dbpool.escape(site_name),
            dbpool.escape(project_id)
        );

        queryHandler(q, function(err, rows){
            if(err) return callback(err);

            callback(null, rows[0].count > 0);
        });
    },

    removeFromProject: function(site_id, project_id, connection, callback) {
        if(!site_id || !project_id)
            return callback(new Error("required field missing"));

        Sites.findById(site_id, function(err, rows) {
            if(err) return callback(err);

            if(!rows.length) return callback(new Error("invalid site"));

            site = rows[0];

            if(site.project_id === project_id) {
                Sites.haveRecordings(site_id, function(err, result) {
                    if(result) {
                        Sites.update({
                            id: site_id,
                            published: false,
                            deletedAt: true
                        }, connection, callback);
                    }
                    else {
                        var q = 'UPDATE sites SET deleted_at = NOW(), updated_at = NOW() \n'+
                                'WHERE site_id = %s';
                        q = util.format(q, dbpool.escape(site_id));
                        connection? connection.query(q, callback): queryHandler(q, callback);
                    }
                });
            }
            else {
                var q = 'DELETE FROM project_imported_sites \n'+
                        'WHERE site_id = %s \n'+
                        'AND project_id = %s';

                q = util.format(q, dbpool.escape(site_id), dbpool.escape(project_id));
                connection? connection.query(q, callback): queryHandler(q, callback);
            }
        });
    },

    removeFromProjectAsync: function (siteId, projectId, connection) {
        let remove = util.promisify(this.removeFromProject)
        return remove(siteId, projectId, connection)
    },

    listPublished: function(callback) {
        var q = "SELECT p.name AS project_name, \n"+
                "       p.project_id, \n"+
                "       u.login AS username, \n"+
                "       s.name, \n"+
                "       s.lat, \n"+
                "       s.lon, \n"+
                "       s.site_id AS id, \n"+
                "       count( r.recording_id ) as rec_count \n"+
                "FROM sites AS s \n"+
                "JOIN projects AS p ON s.project_id = p.project_id \n"+
                "JOIN users AS u ON p.owner_id = u.user_id \n"+
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id \n"+
                "WHERE s.published = 1 AND s.deleted_at is null "+
                "GROUP BY s.site_id";

        queryHandler(q, callback);
    },

    haveRecordings: function(site_id, callback) {
        var q = "SELECT r.recording_id\n"+
                "FROM sites AS s \n"+
                "INNER JOIN recordings AS r ON s.site_id = r.site_id  \n"+
                "WHERE s.site_id = %s\n"+
                "LIMIT 1";

        q = util.format(q, dbpool.escape(site_id));

        queryHandler(q, function(err, rows) {
            if(err) return callback(err);

            callback(null, rows.length > 0);
        });
    },

    importSiteToProject: function(site_id, project_id, callback) {
        if(!site_id || !project_id)
            return callback(new Error("required field missing"));

        Sites.findById(site_id, function(err, rows) {
            if(err) return callback(err);

            if(!rows.length) return callback(new Error("invalid site"));

            var site = rows[0];

            if(site.project_id === project_id) {
                return callback(new Error("cant import site to it own project"));
            }

            var q = "INSERT INTO project_imported_sites(site_id, project_id) \n"+
                    "VALUES (%s,%s)";

            q = util.format(q, dbpool.escape(site_id), dbpool.escape(project_id));
            queryHandler(q, callback);
        });
    },

    getUploadStats: function(site, options, callback){
        dbpool.getConnection(function(err, dbconn){
            var m;
            if(err){
                callback(err);
                return;
            }
            var site_id = site.site_id | 0;

            var sql, params=[site_id];
            var group_clause;

            if(options.quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(options.quantize))){
                var scale=m[1]|0, qfunc = {
                    min   : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/60)',
                    hour  : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/3600)',
                    day   : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/86400)',
                    week  : 'FLOOR(UNIX_TIMESTAMP(R.upload_time)/604800)',
                }[m[2]];
                if(scale != 1){
                    qfunc = 'FLOOR('+qfunc+'/'+scale+')*'+scale;
                }
                group_clause = qfunc;
            }

            sql = "SELECT R.upload_time AS datetime, COUNT(*) AS uploads \n" +
            "FROM recordings R\n" +
            "WHERE site_id = ?";
            if (options.dates) {
                sql += " AND DATE(R.upload_time) IN (?)";
                params.push(options.dates);
            }
            if (options.from) {
                if(options.to){
                    sql += " AND R.upload_time BETWEEN ? AND ?";
                    params.push(options.from, options.to);
                } else {
                    sql += " AND R.upload_time >= ?";
                    params.push(options.from);
                }
            } else if(options.to){
                sql += " AND R.upload_time <= ?";
                params.push(options.to);
            }
            if(group_clause){
                sql += " \nGROUP BY " + group_clause;
            }

            var resultstream = dbconn.query(sql, params).stream({highWaterMark:5});
            resultstream.on('error', function(err) {
                callback(err);
            });
            resultstream.on('fields',function(fields,i) {
              callback(null, resultstream, fields);
            });
            resultstream.on('end', function(){
                dbconn.release();
            });
        });
    },

        /** Returns the site's upload stats.
         * @param {Object}  site - an object representing the site.
         * @param {Integer} site.site_id - id of the given site.
         * @param {Object}  options - options object.
         * @param {String}  options.quantize - aggregate entries by the specified time interval.
         *                    Format is a number plus an unit (min(s), hour(s), day(s) or week(s))
         * @param {Date}  options.from - limit returned data to entries after or at this date
         * @param {Date}  options.to   - limit returned data to entries before or at this date
         * @param {Callback} callback    - callback function
         */
    getRecordingStats: function(site, options, callback){
            dbpool.getConnection(function(err, dbconn){
                var m;
                if(err){
                    callback(err);
                    return;
                }
                var site_id = site.site_id | 0;

                var sql, params=[site_id];
                var group_clause;

                if(options.quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(options.quantize))){
                    var scale=m[1]|0, qfunc = {
                        min   : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/60)',
                        hour  : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/3600)',
                        day   : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/86400)',
                        week  : 'FLOOR(UNIX_TIMESTAMP(R.datetime)/604800)',
                    }[m[2]];
                    if(scale != 1){
                        qfunc = 'FLOOR('+qfunc+'/'+scale+')*'+scale;
                    }
                    group_clause = qfunc;
                }

                sql = "SELECT R.datetime AS datetime, COUNT(*) AS count \n" +
                "FROM recordings R\n" +
                "WHERE site_id = ?";
                if (options.dates) {
                    sql += " AND DATE(R.datetime) IN (?)";
                    params.push(options.dates);
                }
                if (options.from) {
                    if(options.to){
                        sql += " AND R.datetime BETWEEN ? AND ?";
                        params.push(options.from, options.to);
                    } else {
                        sql += " AND R.datetime >= ?";
                        params.push(options.from);
                    }
                } else if(options.to){
                    sql += " AND R.datetime <= ?";
                    params.push(options.to);
                }
                if(group_clause){
                    sql += " \nGROUP BY " + group_clause;
                }

                var resultstream = dbconn.query(sql, params).stream({highWaterMark:5});
                resultstream.on('error', function(err) {
                    callback(err);
                });
                resultstream.on('fields',function(fields,i) {
                  callback(null, resultstream, fields);
                });
                resultstream.on('end', function(){
                    dbconn.release();
                });
            });
        },

    createSiteInArbimonAndCoreAPI: async function(site, project, token) {
        var connection;
        return dbpool.getConnection()
            .then(async (con) => {
                connection = con;
                await connection.beginTransaction();
                let result = await this.insertAsync(site, connection);
                console.log('site, result', site, result)
                if (rfcxConfig.coreAPIEnabled) {
                    const coreSite = {
                        site_id: result.insertId,
                        name: site.name,
                        lat: site.lat,
                        lon: site.lon,
                        alt: site['alt'] !== undefined && Sites.isEmptyCoordinate(site.alt) ? null : site.alt,
                        is_public: !project.is_private
                    }
                    if (project.external_id) {
                        coreSite.project_id = project.external_id;
                    }
                    let siteExternalId = await this.createInCoreAPI(coreSite, token);
                    await this.setExternalId(result.insertId, siteExternalId, connection);
                    let { countryCode, timezone } = await this.getCountryCodeAndTimezoneCoreAPI(coreSite, token);
                    await this.setCountryCodeAndTimezone(result.insertId, countryCode, timezone, connection);
                }
                await connection.commit();
                await connection.release();
            })
            .catch(async (err) => {
                console.log('Failed to create site', err);
                if (connection) {
                    await connection.rollback();
                    await connection.release();
                }
                throw new APIError('Failed to create site');
            })
    },

    createInCoreAPI: async function(site, idToken) {
        const body = {
            name: site.name,
            latitude: site.lat,
            longitude: site.lon,
            altitude: site.alt,
            project_id: site.project_id,
            external_id: site.site_id,
            is_public: !!site.is_public
        }
        const options = {
            method: 'POST',
            url: `${rfcxConfig.apiBaseUrl}/streams`,
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
                const regexResult = /\/streams\/(\w+)$/.exec(response.headers.location)
                if (regexResult) {
                    return regexResult[1]
                }
                throw new Error(`Unable to parse location header: ${response.headers.location}`)
            }
            throw new Error(`Unexpected status code or location header: ${response.statusCode} ${response.headers.location}`)
        })
    },

    getCountryCodeAndTimezoneCoreAPI: async function(coreSite, idToken) {
        const options = {
            method: 'GET',
            url: `${rfcxConfig.apiBaseUrl}/streams?projects[]=${coreSite.project_id}&name[]=${encodeURIComponent(coreSite.name)}`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            json: true
          }
          return rp(options).then((response) => {
            if (response.body && !response.body.error) {
                const body  = response.body
                return { countryCode: body[0].country_code, timezone: body[0].timezone }
            } else throw new Error('Failed to get site data')
        })
    },

    updateSite: async function(site, options, idToken) {
        let db;
        return dbpool.getConnection()
            .then(async (connection) => {
                db = connection;
                await db.beginTransaction();
                await this.updateAsync(site, db);
                if (rfcxConfig.coreAPIEnabled) {
                    const updatedSite = await this.updateInCoreAPI({
                        site_id: site.site_id,
                        name: site.name,
                        lat: site.lat,
                        lon: site.lon,
                        alt: site['alt'] !== undefined && Sites.isEmptyCoordinate(site.alt) ? null : site.alt,
                        project_id: site.project_id
                    }, idToken)
                    await this.setCountryCodeAndTimezone(site.site_id, updatedSite.country_code, updatedSite.timezone, connection);
                };
                const { originalProjectId } = options
                if (site.project_id !== undefined && originalProjectId !== site.project_id) {
                    // Update project in validations if any site is moving to another project
                    const newProject = site.project_id
                    const validations = await projects.getProjectValidationsBySite(originalProjectId, site.site_id, db)
                    if (validations.length) {
                        for (let validation of validations) {
                            const projectClass = {
                                projectId: newProject,
                                specieId: validation.species_id,
                                songtypeId: validation.songtype_id
                            };
                            const newProjectClass = await projects.checkClassAsync(projectClass, db)
                            if (!newProjectClass.length) await projects.insertClassAsync(projectClass, db)
                        }
                        await projects.updateProjectInAnalyses(originalProjectId, newProject, site.site_id, db)
                    }
                }
                await db.commit();
                await db.release();
            })
            .catch(async (err) => {
                console.log('err', err);
                if (db) {
                    await db.rollback();
                    await db.release();
                }
                throw new Error('Failed to update site');
            })
    },

    updateInCoreAPI: async function(data, idToken) {
        let body = {}
        data.name !== undefined && (body.name = data.name)
        data.lat !== undefined && (body.latitude = data.lat)
        data.lon !== undefined && (body.longitude = data.lon)
        data.alt !== undefined && (body.altitude = data.alt)
        data.project_id !== undefined && (body.project_external_id = data.project_id)
        const options = {
            method: 'PATCH',
            url: `${rfcxConfig.apiBaseUrl}/internal/arbimon/streams/${data.site_id}`,
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
                    throw new Error('Failed to update site');
                }
                return body;
            } catch (e) {
                throw new Error('Failed to update site');
            }
        })
    },

    removeSite: async function(siteIds, project_id, idToken) {
        let db;
        return dbpool.getConnection()
            .then(async (connection) => {
                db = connection;
                await db.beginTransaction();
                for (let site_id of siteIds) {
                    const validationIds = await this.getRecordingValidationBySiteId(site_id)
                    if (validationIds.length) {
                        await this.resetRecValidationById(project_id, validationIds.map(v => v.recording_validation_id), connection)
                    }
                    const recIdsBySite = await this.getRecordingIdsbySite(site_id)
                    const recIds = recIdsBySite.map(rec => rec.recording_id)
                    if (recIds && recIds.length) {
                        await this.deleteRecordingInAnalyses(recIdsBySite.map(rec => rec.recording_id), db)
                    }
                    await this.removeFromProjectAsync(site_id, project_id, db);
                    if (rfcxConfig.coreAPIEnabled) {
                        await this.deleteInCoreAPI(site_id, idToken)
                    };
                }
                await db.commit();
                await db.release();
            })
            .catch(async (err) => {
                console.log('err', err);
                if (db) {
                    await db.rollback();
                    await db.release();
                }
                throw new Error('Failed to delete site');
            })
    },

    deleteRecordingInAnalyses: async function(recIds, connection) {
        let queries = [
            `DELETE FROM pattern_matching_rois WHERE recording_id in (${recIds})`,
            `UPDATE templates set deleted=1 WHERE recording_id in (${recIds})`,
        ];

        console.log('--deleteRecordingInAnalyses recIds', recIds)
        const executeQuery = connection ? (sql) => dbpool.queryWithConn(connection, sql) : dbpool.query;
        for (const query of queries) {
            await executeQuery(query);
        }
    },

    getRecordingIdsbySite: async function(site_id) {
        const q = `SELECT recording_id
            FROM recordings
            WHERE site_id in (${site_id})`
        return dbpool.query(q);
    },

    getRecordingValidationBySiteId: async function(siteIds) {
        const q = `SELECT rv.recording_validation_id
            FROM recording_validations rv
            JOIN recordings r ON r.recording_id = rv.recording_id
            WHERE r.site_id in (${siteIds})`
        return dbpool.query(q);
    },

    resetRecValidationById: async function(projectId, validationIds, connection) {
        const q = `UPDATE recording_validations SET present = NULL, present_review = 0, present_aed = 0
        WHERE project_id=${projectId} AND recording_validation_id IN (${validationIds})`;

        if (connection) {
            return dbpool.queryWithConn(connection, q);
        }
        return dbpool.query(q);
    },

    deleteInCoreAPI: async function(site_id, idToken) {
        const options = {
            method: 'DELETE',
            url: `${rfcxConfig.apiBaseUrl}/internal/arbimon/streams/${site_id}`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`,
                source: 'arbimon'
            }
        }
        return rp(options).then((response) => {
            if (response.statusCode !== 204) {
                throw new Error('Failed to delete site');
            }
        })
    },

    getDeployedData: async function(projectId, idToken) {
        const options = {
            method: 'GET',
            url: `${rfcxConfig.deviceBaseUrl}/deployments?projectIds=${projectId}`,
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            }
        }
        return rp(options).then((response) => {
            return response.body
        })
    },

    setExternalId: function (siteId, externalId, connection) {
        return (connection? connection.query : dbpool.query)(`UPDATE sites SET external_id = "${externalId}" WHERE site_id = ${siteId}`, [])
    },

    setCountryCodeAndTimezone: async function (siteId, countryCode, timezone, connection) {
        console.log('------setCountryCodeAndTimezone', countryCode, timezone);
        const isCountryCodeNull = countryCode === null || countryCode === '' || countryCode === undefined || countryCode === 'undefined';
        const isTimezoneNull = !timezone || timezone === null || timezone === '' || timezone === undefined || timezone === 'undefined';
        const timezoneToInsert = isTimezoneNull ? 'UTC' : timezone
        console.log('------timezoneToInsert', timezoneToInsert);
        return (connection? connection.query : dbpool.query)(`UPDATE sites SET country_code = ${isCountryCodeNull ? null : ('"' + countryCode + '"')}, timezone = "${timezoneToInsert}" WHERE site_id = ${siteId}`, [])
    },

    /**
     * Checks whether user has permission for the project or not
     * @param {object} site
     * @param {integer} userId
     */
    userHasPermission: async function (site, userId) {
        return projects.userHasPermission(site.project_id, userId)
    },

    countAllSites: function(callback) {
        var q = 'SELECT count(*) AS count \n'+
                'FROM `sites` \n'+
                'WHERE deleted_at is null';

        queryHandler(q, callback);
    },

    countProjectSites: function(projectId) {
        return dbpool.query(`SELECT COUNT(site_id) AS count FROM sites WHERE project_id = ${dbpool.escape(projectId)} AND deleted_at is null`).get(0).get('count');
    },

    countSitesToday: function(callback) {
        var q = 'SELECT count(*) AS count \n'+
                'FROM `sites` \n' +
                'WHERE DATE(created_at) = DATE(NOW()) AND deleted_at is null';

        queryHandler(q, callback);
    }
};

module.exports = Sites;
