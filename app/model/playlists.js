// dependencies
var debug = require('debug')('arbimon2:model:playlists');
var async = require('async');
var q = require('q');
var Joi   = require('joi');
var util  = require('util');


var sqlutil = require('../utils/sqlutil');
var dbpool = require('../utils/dbpool');
var APIError = require('../utils/apierror');
// TODO remove circular dependencies
var model = require('../model');
var config = require('../config');

// local variables
var s3;
var queryHandler = dbpool.queryHandler;

// exports
var Playlists = {
    /** Finds playlists, given a (non-empty) query.
     * @param {Object}  query
     * @param {Integer} query.id      find playlists with the given id.
     * @param {Integer} query.project find playlists associated to the given project id.
     * @param {Object}  options [optional]
     * @param {Boolean} options.count add the number of recordings in the playlist
     * @param {Boolean} options.show_info  show the playlist's info
     * @param {Function} callback called back with the queried results.
     * @return {Promise} resolving to array with the matching playlists.
     */
    find: function (query, options, callback) {
        var constraints=[], projection=[], joins=[], agregate=false;
        var data=[];
        if(options instanceof Function){
            callback = options;
            options = null;
        }
        if(!options){
            options = {};
        }

        if (query.id) {
            constraints.push('PL.playlist_id = ?');
            data.push(query.id);
        }
        if (query.project) {
            constraints.push('PL.project_id = ?');
            data.push(query.project);
        }
        if(query.name) {
            constraints.push('PL.name = ?');
            data.push(query.name);
        }

        if(constraints.length === 0){
            callback(new Error("Playlists.find called with invalid query."));
        }

        if(options.count){
            // agregate = true;
            projection.push("(\n" +
            "   SELECT COUNT(*) FROM playlist_recordings PLR WHERE PL.playlist_id = PLR.playlist_id\n" +
            ") as count");
            // joins.push("JOIN playlist_recordings PLR ON PL.playlist_id = PLR.playlist_id");
        }

        if (options.filterPlaylistLimit) {
            constraints.push('PL.total_recordings <= 100000')
        }

        projection.push("PLT.name as type");
        joins.push("JOIN playlist_types PLT ON PL.playlist_type_id = PLT.playlist_type_id");

        return dbpool.query(
            "SELECT PL.playlist_id as id, PL.name, PL.project_id, PL.uri, PL.metadata \n" +
            (projection.length ? ","+projection.join(",")+"\n" : "") +
            "FROM playlists PL \n" +
            (joins.length ? joins.join("\n")+"\n" : "") +
            "WHERE " + constraints.join(" \n  AND ") +
            (agregate ? "\nGROUP BY PL.playlist_id" : ""),
            data
        ).then(function(rows){
            rows.forEach(function(row){
                row.metadata = row.metadata ? JSON.parse(row.metadata) : null;
            });

            if(options.show_info){
                return q.all(rows.map(function(playlist){
                    return Playlists.getInfo(playlist);
                }));
            }
            return rows;
        }).nodeify(callback);
    },


    /** Fetches a playlist's extra info.
     *  The actual info fetched depends on the playlist type.
     * @param {Object}  playlist  playlist object as returned by find().
     * @param {Function} callback(err, path) function to call back with the results.
     * @param {Promise} resolving to the playlist's extra info.
     */
    getInfo: function (playlist, callback) {
        return q.resolve().then(function(){
            if(playlist.type == "soundscape region"){
                return dbpool.query(
                    "SELECT  soundscape_region_id as region, S.soundscape_id as soundscape, S.uri \n" +
                    "FROM soundscape_regions SCR \n" +
                    "JOIN soundscapes S ON SCR.soundscape_id = S.soundscape_id\n" +
                    "WHERE SCR.sample_playlist_id = ?", [
                    playlist.id,
                ]).get(0).then(function(sr){
                    if(sr){
                        playlist.region     = sr.region;
                        playlist.soundscape = sr.soundscape;
                        playlist.soundscape_thumbnail = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + sr.uri;
                    }
                });
            } else if(/union|intersection|subtraction/.test(playlist.type) && playlist.metadata){
                return q.all([
                    playlist.metadata.term1 && Playlists.find({id:playlist.metadata.term1, show_info:true}).get(0),
                    playlist.metadata.term2 && Playlists.find({id:playlist.metadata.term2, show_info:true}).get(0),
                ]).then(function(terms){
                    playlist.term1 = terms[0];
                    playlist.term2 = terms[1];
                });
            }
        }).thenResolve(playlist).nodeify(callback);
    },

    /** Fetches a playlist's data, optionally using a query.
     * @param {Object}  playlist  playlist object as returned by find().
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
     * @param {Object}  query.limit     limit results to the given window interval
     * @param {Function} callback(err, path) function to call back with the results (optional).
     * @return {Promise} resolving to array with the matching playlists.
     */
    fetchData: function (playlist, query, callback) {
        var constraints = [], data=[];
        if(query instanceof Function) {
            callback = query;
            query = null;
        }
        if(!query) {
            query = {};
        }
        // Fetch recordings data for the playlists with audio event detections
        if (query.recordings) {
            if (Array.isArray(query.recordings)) {
                return q.all(query.recordings.map(function(id){
                    return model.recordings.findByUrlMatch({id: Number(id)}, null, {compute:query && query.show}).get(0);
                })).nodeify(callback);
            }
            else {
                return q.all(model.recordings.findByUrlMatch({id: Number(query.recordings)}, null, {compute:query && query.show})).nodeify(callback);
            }
        }

        constraints.push('PLR.playlist_id = ?');
        data.push(playlist.id);

        var limit_clause = '';
        if(query.limit){
            var qlimit = query.limit;
            if(typeof qlimit != "object"){
                qlimit = {count:query.limit};
            }
            limit_clause = " LIMIT " + Math.max(0,(qlimit.count | 0));
            if(qlimit.offset === undefined && query.offset){
                qlimit.offset = query.offset;
            }
            if(qlimit.offset){
                limit_clause += " OFFSET " + Math.max(0, (qlimit.offset | 0));
            }
        }

        if(constraints.length === 0){
            return q.reject(
                new Error("Playlists.fetchData called with invalid query.")
            ).nodeify(callback);
        }

        return dbpool.query(
            "SELECT PLR.recording_id \n" +
            "FROM playlist_recordings PLR \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND ") + limit_clause,
            data
        ).then(function(data){
            if(!data.length){
                return [];
            }
            return q.all(data.map(function(row){
                var id = row.recording_id;
                return model.recordings.findByUrlMatch({id:id}, null, {compute:query && query.show}).get(0);
            }));
        }).nodeify(callback);
    },

    fetchRecordingsAround: function(playlist, recording, radius, callback){
        async.waterfall([
            (function(next){
                dbpool.queryHandler(
                    "SELECT rPLR.row \n" +
                    "FROM (\n"+
                    "   SELECT @rownum:=@rownum+1 row, PLR.*  \n" +
                    "   FROM playlist_recordings PLR, (SELECT @rownum:=0) r \n" +
                    "   WHERE PLR.playlist_id = " + dbpool.escape(playlist.id) + " \n"+
                    ") as rPLR \n" +
                    "WHERE rPLR.recording_id = " + dbpool.escape(recording),
                next);
            }).bind(this),
            function(rows){
                var next = arguments[arguments.length-1];
                next(null, rows.length ? rows[0].row : 0);
            },
            function(rec_row, next){
                --rec_row;
                var intervals = [
                    {offset:rec_row - radius, count:radius},
                    {offset:rec_row         , count:1     },
                    {offset:rec_row + 1     , count:radius}
                ];
                async.map(intervals, function(interval, next_interval){
                    Playlists.fetchData(playlist, {limit:interval}, next_interval);
                }, next);
            },
            function(intervals){
                var next = arguments[arguments.length-1];
                next(null, intervals[0], intervals[1][0], intervals[2]);
            },
        ], callback);
    },

    fetchRecordingPosition: function(playlist, recording, callback){
        async.waterfall([
            function(next){
                dbpool.queryHandler(
                    "SELECT rPLR.row \n" +
                    "FROM (\n"+
                    "   SELECT @rownum:=@rownum+1 row, PLR.*  \n" +
                    "   FROM playlist_recordings PLR, (SELECT @rownum:=0) r \n" +
                    "   WHERE PLR.playlist_id = " + dbpool.escape(playlist.id) + " \n"+
                    ") as rPLR \n" +
                    "WHERE rPLR.recording_id = " + dbpool.escape(recording),
                next);
            },
            function(rows){
                var next = arguments[arguments.length-1];
                next(null, rows.length ? rows[0].row - 1 : null);
            }
        ], callback);
    },

    fetchNextRecording: function(playlist, recording, callback){
        async.waterfall([
            function(next){
                Playlists.fetchRecordingsAround(playlist, recording, 1, next);
            },
            function(before, recording, after){
                var next = arguments[arguments.length-1];
                next(null, after.length ? after[0] : recording);
            }
        ], callback);
    },

    fetchPreviousRecording: function(playlist, recording, callback){
        async.waterfall([
            function(next){
                Playlists.fetchRecordingsAround(playlist, recording, 1, next);
            },
            function(before, recording, after){
                var next = arguments[arguments.length-1];
                next(null, before.length ? before[0] : recording);
            }
        ], callback);
    },

    /** Creates a new playlist.
     * @param {Object} data - object describing playlist to create.
     * @param {Function} callback - callback function (optional)
     * @return {Promise} resolving to created playlists' insert_id
     */
    create: async function(data, callback) {
        let db
        return dbpool.getConnection()
            .then(async (connection) => {
                db = connection
                await db.beginTransaction()
                const query = util.promisify(db.query).bind(db);
                const playlistId = (await query(`INSERT INTO playlists(project_id, name, playlist_type_id) VALUES (?, ?, ?)`, [data.project_id, data.name, 1])).insertId
                if (data.recIdsIncluded || data.aedIdsIncluded) {
                    if (data.aedIdsIncluded) {
                        await this.addRecs(query, playlistId, data.params);
                    }
                    else {
                        const aedData = await model.ClusteringJobs.findRois({ aed: data.params });
                        const recIds = aedData.map(aed => { return aed.recording_id });
                        await this.addRecs(query, playlistId, recIds);
                    }
                } else {
                    data.params.project_id = data.project_id;
                    data.params.sortBy = 'r.site_id, r.datetime'
                    data.params.output = ['list', 'sql']
                    if (data.params.recIds) {
                        await this.addRecs(query, playlistId, data.params.recIds);
                    } else {
                        const sqlParts = await model.recordings.findProjectRecordings(data.params)
                        await query(`INSERT INTO playlist_recordings(recording_id, playlist_id) SELECT DISTINCT r.recording_id, ${playlistId} ${sqlParts[1]} ${sqlParts[2]}`)
                    }
                }
                await this.refreshTotalRecs(playlistId, query)
                await db.commit()
                await db.release()
                return playlistId
            })
            .catch(async (err) => {
                if (db) {
                    await db.rollback()
                    await db.release()
                }
                throw err
            })
            .nodeify(callback)
    },

    /** Adds recordings to a given playlist.
     * @param {object} query - promisified version of connection.query method (used in transaction)
     * @param {Integer} playlistId - id of the associated playlist.
     * @param {Array} recIds - array of recording ids to add to playlist.
     * @return {Promise} resolved after the recordings are added to the playlist.
     */
    addRecs: async function(query, playlistId, recIds) {
        const chunkSize = 10000
        let splittedRecs = []
        if (recIds.length < chunkSize) {
            splittedRecs = [recIds]
        } else {
            while (recIds.length > 0) {
                splittedRecs.push(recIds.splice(0, chunkSize))
            }
        }
        for (let arr of splittedRecs) {
            await query("INSERT INTO playlist_recordings(playlist_id, recording_id) VALUES" + arr.map(recId => `(${playlistId}, ${recId})`).join(", "))
        }
    },

    /** Combines two playlists (from the same project) into one.
     * @param {Object} data - object describing playlist to create.
     * @return {Promise} resolving to created playlists' insert_id
     */
    combine: function(data) {
        var schema = {
            name: Joi.string().required(),
            project: Joi.number().required(),
            operation: Joi.string().required(),
            term1: Joi.number().required(),
            term2: Joi.number().required(),
        };

        return q.ninvoke(Joi, 'validate', data, schema).catch(function(err){
            throw new APIError(err.message);
        }).then(function() {
            return dbpool.query(
                "SELECT COUNT(*) as count\n" +
                "FROM playlists\n" +
                "WHERE playlist_id IN (?, ?) AND project_id = ?", [
                data.term1, data.term2,
                data.project
            ]).get(0).get('count').then(function(termsInProjectCount){
                if(termsInProjectCount != 2){
                    throw new APIError('At least one of the playlists is not form the project.');
                }
            });
        }).then(function(){
            var operation = Playlists.combineOperations[data.operation];
            if(!operation){
                throw new APIError('Invalid playlist operation requested.');
            }

            return dbpool.query(
                "INSERT INTO playlists(project_id, name, playlist_type_id, metadata) \n"+
                "VALUES (?, ?, ?, ?)", [
                    data.project, data.name, operation.type, JSON.stringify({
                        term1:data.term1,
                        term2:data.term2,
                    })
                ]).get('insertId').then(async function(newPlaylistId){
                    const result = await operation.eval(data.term1, data.term2, newPlaylistId);
                    await Playlists.refreshTotalRecs(newPlaylistId)
                    return result
                });
        });
    },

    combineOperations: {
        union: {
            type: 3,
            eval: function(term1, term2, result){
                return dbpool.query(
                "INSERT INTO playlist_recordings(playlist_id, recording_id) \n"+
                "SELECT DISTINCT ?, recording_id\n" +
                "FROM playlist_recordings\n" +
                "WHERE playlist_id IN (?, ?)", [
                    result, term1, term2
                ]);
            }
        },
        intersection: {
            type: 4,
            eval: function(term1, term2, result){
                return dbpool.query(
                "INSERT INTO playlist_recordings(playlist_id, recording_id) \n"+
                "SELECT ?, P1.recording_id\n" +
                "FROM playlist_recordings P1\n" +
                "JOIN playlist_recordings P2 ON P1.recording_id = P2.recording_id\n" +
                "WHERE P1.playlist_id = ? AND P2.playlist_id = ?", [
                    result, term1, term2
                ]);
            }
        },
        subtraction: {
            type: 5,
            eval: function(term1, term2, result){
                return dbpool.query(
                "INSERT INTO playlist_recordings(playlist_id, recording_id) \n"+
                "SELECT DISTINCT ?, P1.recording_id\n" +
                "FROM playlist_recordings P1\n" +
                "LEFT JOIN playlist_recordings P2 ON (\n" +
                "   P1.recording_id = P2.recording_id\n" +
                "   AND P2.playlist_id = ?\n" +
                ")\n" +
                "WHERE P1.playlist_id = ?\n" +
                "  AND P2.recording_id IS NULL", [
                    result, term2, term1
                ]);
            }
        },
    },

    attachAedToPlaylist: function(playlist_id, aed, callback) {
       var schema =  Joi.array().items(Joi.number());

        return q.ninvoke(Joi, 'validate', aed, schema).then(function(items) {
            return dbpool.query(
                "INSERT INTO playlist_aed(playlist_id, aed_id) \n"+
                "VALUES " + items.map(function(aed) {
                    return "(" + (playlist_id|0) + "," + (aed|0) + ")";
                }).join(",\n       ")
            );
        }).nodeify(callback);
    },

    rename: function(playlist, callback) {
        var schema = {
            id: Joi.number().required(),
            name: Joi.string().required()
        };

        Joi.validate(playlist, schema, function(err, pls) {
            var q = "UPDATE playlists \n"+
                    "SET name = %s \n"+
                    "WHERE playlist_id = %s";

            q = util.format(q, dbpool.escape(pls.name), dbpool.escape(pls.id));
            queryHandler(q, callback);
        });
    },

    remove: function(playlist_ids, callback) {
        var schema = Joi.array().items(Joi.number());

        Joi.validate(playlist_ids, schema, function(err, ids) {
            var q = "DELETE FROM playlists \n"+
                    "WHERE playlist_id IN (%s)";

            q = util.format(q, dbpool.escape(ids));
            queryHandler(q, callback);
        });
    },

    getRecordingsCount: async function (playlist_id, connection) {
        const q = 'SELECT COUNT(recording_id) as count FROM playlist_recordings WHERE playlist_recordings.playlist_id = ? GROUP BY playlist_id'
        const con = connection ? connection : dbpool.query
        const pl = (await con(q, [playlist_id]))[0]
        return pl ? pl.count : null
    },

    refreshTotalRecs: async function(playlist_id, connection) {
        const total = await this.getRecordingsCount(playlist_id, connection)
        if (total === null) {
            return
        }
        const q = 'UPDATE playlists SET total_recordings = ? WHERE playlist_id = ?'
        const con = connection ? connection : dbpool.query
        return await con(q, [total, playlist_id])
    },
};

module.exports = Playlists;
