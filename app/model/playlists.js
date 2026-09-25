// dependencies
var debug = require('debug')('arbimon2:model:playlists');
var async = require('async');
var q = require('q');
var Joi   = require('joi');
var util  = require('util');
const moment = require('moment');

var sqlutil = require('../utils/sqlutil');
var dbpool = require('../utils/dbpool');
// Nullable actor for attribution columns (rfcx-local OPEN-ITEMS 375): an
// absent user is stored as NULL, never as 0 or a sentinel.
const actorId = (v) => (v === undefined || v === null) ? null : Number(v);
var APIError = require('../utils/apierror');
// TODO remove circular dependencies
var model = require('../model');
var config = require('../config');
const { soundscapeImageUrl } = require('../utils/arbimon2-asset-url');

// local variables
var s3;
var queryHandler = dbpool.queryHandler;

const status = { WAITING: 0, CREATED: 20, FAILED: 30 }

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

        constraints.push(`PL.status = ${ status.CREATED }`)

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
            // `count` is served from the maintained `playlists.total_recordings`
            // column (2026-09-22). It used to be a correlated
            //   (SELECT COUNT(*) FROM playlist_recordings PLR WHERE PLR.playlist_id = PL.playlist_id)
            // per row -- on puerto-rico-island-wide that is 1,710 loops over
            // 43.3 M index rows: 25.9 s cold / 3.7 s warm on the replica,
            // 2.1-3.7 s as seen by the visualizer on EVERY page load (it was
            // the slowest call in every sample), to fill a dropdown badge.
            //
            // The column is exact on every write this code can see (create,
            // combine, soundscape-region samples, archive/delete -- each
            // goes through `refreshTotalRecs` or sets it from affectedRows
            // inside its own transaction; see `setTotalRecsForPlaylists`), and
            // the rfcx-local `count-repair-plane` CronJob audits + repairs
            // drift from writers this code cannot see (same contract as
            // sites.rec_count, operator ruling 2026-09-22 10:52).
            projection.push("PL.total_recordings as count");
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
                    "SELECT  soundscape_region_id as region, S.soundscape_id as soundscape, S.uri, \n" +
                    "        S.visual_palette, S.visual_max_value, S.normalized, S.threshold, S.threshold_type \n" +
                    "FROM soundscape_regions SCR \n" +
                    "JOIN soundscapes S ON SCR.soundscape_id = S.soundscape_id\n" +
                    "WHERE SCR.sample_playlist_id = ?", [
                    playlist.id,
                ]).get(0).then(function(sr){
                    if(sr){
                        playlist.region     = sr.region;
                        playlist.soundscape = sr.soundscape;
                        playlist.soundscape_thumbnail = sr.uri ? soundscapeImageUrl({ id: sr.soundscape, visual_palette: sr.visual_palette, visual_max_value: sr.visual_max_value, normalized: sr.normalized, threshold: sr.threshold, threshold_type: sr.threshold_type }) : null; // 2026-09-24: auth-gated, never a public s3.arbimon.org/arbimon2 url
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

        // ORDER BY is REQUIRED, not cosmetic: this query pages with LIMIT/OFFSET,
        // and its offsets are computed from the row numbers produced by
        // fetchRecordingsAround/fetchRecordingPosition below. Without a shared,
        // explicit ordering the two can disagree (an unordered LIMIT/OFFSET scan
        // is plan-dependent in PostgreSQL), which silently returns the wrong
        // "next" recording. playlist_recordings' PK is (playlist_id, recording_id),
        // so ordering by recording_id is both stable and index-backed.
        return dbpool.query(
            "SELECT PLR.recording_id \n" +
            "FROM playlist_recordings PLR \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND ") + " \nORDER BY PLR.recording_id" + limit_clause,
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
                // ROW_NUMBER() replaces the MySQL `@rownum:=@rownum+1` session-variable
                // idiom, which PostgreSQL cannot parse at all (42601, "syntax error at
                // or near :=") -- so under DB_ENGINE=pg this route 500'd on every call.
                // ORDER BY recording_id must match fetchData()'s ORDER BY above: the row
                // number produced here is turned into that query's OFFSET.
                dbpool.queryHandler(
                    "SELECT rPLR.row \n" +
                    "FROM (\n"+
                    "   SELECT ROW_NUMBER() OVER (ORDER BY PLR.recording_id) AS row, PLR.*  \n" +
                    "   FROM playlist_recordings PLR \n" +
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
                // Same PG-incompatible @rownum idiom as fetchRecordingsAround (42601);
                // same ORDER BY as fetchData() so positions and paging agree.
                dbpool.queryHandler(
                    "SELECT rPLR.row \n" +
                    "FROM (\n"+
                    "   SELECT ROW_NUMBER() OVER (ORDER BY PLR.recording_id) AS row, PLR.*  \n" +
                    "   FROM playlist_recordings PLR \n" +
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
    create: async function(data) {
        const connection = await dbpool.getConnection();
        let playlistId;

        try {
            await dbpool.queryWithConn(connection, 'START TRANSACTION');
            try {
                // user_id (2026-09-22, user-attribution slice 2 -- rfcx-local
                // OPEN-ITEMS 375): the creating user, nullable, go-forward only.
                // NULL = created before the column shipped or by a path with no
                // acting user; history is deliberately not backfilled.
                playlistId = (await dbpool.queryWithConn(connection,
                    `INSERT INTO playlists(project_id, name, playlist_type_id, status, user_id) VALUES (?, ?, ?, ?, ?)`,
                    [data.project_id, data.name, 1, status.WAITING, actorId(data.user_id)]
                )).insertId;
            } catch (err) {
                // P7 dup-key port: PG raises SQLSTATE 23505, not ER_DUP_ENTRY.
                // sqlutil.isDuplicateKeyError is the dual-dialect check (the
                // projects.js:42 precedent) — do not string-compare codes here.
                if (!sqlutil.isDuplicateKeyError(err)) {
                    throw err;
                }

                const duplicate = (await dbpool.queryWithConn(connection,
                    'SELECT playlist_id, status FROM playlists WHERE project_id = ? AND name = ? LIMIT 1',
                    [data.project_id, data.name]
                ))[0];

                if (!duplicate || duplicate.status === status.CREATED) {
                    throw new APIError('Playlist name in use');
                }

                playlistId = duplicate.playlist_id;
                await dbpool.queryWithConn(connection, 'DELETE FROM playlist_recordings WHERE playlist_id = ?', [playlistId]);
                await dbpool.queryWithConn(connection,
                    'UPDATE playlists SET playlist_type_id = ?, uri = NULL, metadata = NULL, total_recordings = ?, status = ? WHERE playlist_id = ?',
                    [1, 0, status.WAITING, playlistId]
                );
            }

            let totalInserted = 0;
            if (data.recIdsIncluded || data.aedIdsIncluded) {
                if (data.aedIdsIncluded) {
                    totalInserted = await this.addRecs(playlistId, data.params, connection);
                }
                else {
                    const aedData = await model.ClusteringJobs.findRois({ aed: data.params });
                    const recIds = aedData.map(aed => { return aed.recording_id });
                    totalInserted = await this.addRecs(playlistId, [...new Set(recIds)], connection);
                }
            } else {
                data.params.project_id = data.project_id;
                data.params.sortBy = 'r.site_id, r.datetime';
                data.params.output = ['list', 'sql'];
                if (data.params.recIds) {
                    totalInserted = await this.addRecs(playlistId, data.params.recIds, connection);
                } else {
                    const sqlParts = await model.recordings.findProjectRecordings(data.params);
                    const testCreatingTime = moment().format('YYYY-MM-DD HH:mm:ss');
                    console.log('Playlist: start insert', testCreatingTime);
                    const insertSelect =
                        `INSERT INTO playlist_recordings(recording_id, playlist_id) SELECT DISTINCT r.recording_id, ${playlistId} ${sqlParts[1]} ${sqlParts[2]}`;
                    const result = await dbpool.queryWithConn(connection, insertSelect);
                    totalInserted = result.affectedRows || 0;
                    const testInsertingTime = moment().format('YYYY-MM-DD HH:mm:ss');
                    console.log('Playlist: inserted', testInsertingTime, playlistId, totalInserted);
                }
            }

            await dbpool.queryWithConn(connection,
                'UPDATE playlists SET total_recordings = ?, status = ? WHERE playlist_id = ?',
                [totalInserted, status.CREATED, playlistId]
            );
            await dbpool.queryWithConn(connection, 'COMMIT');
            return playlistId;
        } catch (err) {
            await dbpool.queryWithConn(connection, 'ROLLBACK').catch(function(rollbackErr) {
                console.error('Error rolling back playlist creation', rollbackErr);
            });
            throw err;
        } finally {
            connection.release();
        }
    },

    /** Adds recordings to a given playlist.
     * @param {object} query - promisified version of connection.query method (used in transaction)
     * @param {Integer} playlistId - id of the associated playlist.
     * @param {Array} recIds - array of recording ids to add to playlist.
     * @return {Promise} resolved after the recordings are added to the playlist.
     */
    addRecs: async function(playlistId, recIds, connection) {
        const chunkSize = 10000
        let splittedRecs = []
        let totalInserted = 0
        recIds = recIds.map(function(recId) {
            return Number(recId)
        })
        if (recIds.some(function(recId) { return !Number.isInteger(recId) || recId <= 0 })) {
            throw new APIError('Invalid recording id in playlist request')
        }
        if (recIds.length < chunkSize) {
            splittedRecs = [recIds]
        } else {
            while (recIds.length > 0) {
                splittedRecs.push(recIds.splice(0, chunkSize))
            }
        }
        for (let arr of splittedRecs) {
            if (!arr.length) {
                continue
            }
            const result = connection
                ? await dbpool.queryWithConn(connection, "INSERT INTO playlist_recordings(playlist_id, recording_id) VALUES" + arr.map(recId => `(${playlistId}, ${recId})`).join(", "))
                : await dbpool.query("INSERT INTO playlist_recordings(playlist_id, recording_id) VALUES" + arr.map(recId => `(${playlistId}, ${recId})`).join(", "))
            totalInserted += result.affectedRows || 0
        }
        return totalInserted
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
            user_id: Joi.number().allow(null).optional(),
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
                "INSERT INTO playlists(project_id, name, playlist_type_id, metadata, status, user_id) \n"+
                "VALUES (?, ?, ?, ?, ?, ?)", [
                    data.project, data.name, operation.type, JSON.stringify({
                        term1:data.term1,
                        term2:data.term2,
                    }), status.WAITING, actorId(data.user_id)
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

    getRecordingsCount: async function (playlist_id) {
        const q = 'SELECT COUNT(recording_id) as count FROM playlist_recordings WHERE playlist_recordings.playlist_id = ? GROUP BY playlist_id'
        const pl = (await dbpool.query(q, [playlist_id]))[0]
        return pl ? pl.count : null
    },

    refreshTotalRecs: async function(playlist_id) {
        const total = await this.getRecordingsCount(playlist_id)
        console.log('total inserted', total)
        // A playlist whose LAST recording was just removed has zero rows in
        // playlist_recordings, and the GROUP BY count above returns no row
        // (null) -- the old early-return here left `total_recordings` at its
        // stale pre-removal value forever. Zero is a real count; write it.
        const q = 'UPDATE playlists SET total_recordings = ?, status = ? WHERE playlist_id = ?'
        return await dbpool.query(q, [total === null ? 0 : total, status.CREATED , playlist_id])
    },

    /**
     * Recompute `playlists.total_recordings` for every playlist that contains
     * any of `recIds`, on the SAME connection as the membership change (so it
     * commits or rolls back with it). One statement, no per-playlist loop:
     * a recording can sit in many playlists (an archive of a site's day can
     * touch hundreds), and the visualizer reads the column on every load.
     *
     * Call this AFTER the DELETE FROM playlist_recordings, passing the SAME
     * id list -- the affected playlists are found from playlist_recordings
     * BEFORE the delete by the caller (`findRecordingsPlaylists`) or, more
     * simply, by passing the playlist ids directly. Both forms accepted.
     *
     * @param {Function} execQuery (sql, params) -> Promise on the transaction's connection
     * @param {number[]} playlistIds
     */
    setTotalRecsForPlaylists: async function(execQuery, playlistIds) {
        const ids = (playlistIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0)
        if (!ids.length) return
        return execQuery(
            'UPDATE playlists SET total_recordings = (' +
            '  SELECT COUNT(*) FROM playlist_recordings PLR WHERE PLR.playlist_id = playlists.playlist_id' +
            ') WHERE playlist_id IN (' + ids.join(',') + ')'
        )
    },

    findRecordingsPlaylists: function(recIds) {
        const sql = `SELECT DISTINCT(playlist_id) FROM arbimon2.playlist_recordings WHERE recording_id in (${recIds})`
        return dbpool.query(sql)
    },

    countProjectPlaylists: function(projectId) {
        return dbpool.query(`SELECT COUNT(playlist_id) AS count FROM playlists WHERE project_id = ${dbpool.escape(projectId)} AND status = ${ status.CREATED }`).get(0).get('count');
    },
};

module.exports = Playlists;
