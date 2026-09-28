/* jshint node:true */
"use strict";

var fs = require('fs');
var path = require('path');


var debug = require('debug')('arbimon2:tmpfilecache');
var async = require('async');
var Q = require('q');

var config = require('../config');
var sha256 = require('./sha256');

var root = path.resolve(config("tmpfilecache").path);
if (!fs.existsSync(root)) {
    fs.mkdirSync(root);
}

var filesProcessing = {};
var filesProcessingSince = {};
var filesRendering = {};   // cache file path -> true while a CacheMiss renders into it
var reapTimers = {};       // cache file path -> pending reap check

// files that misses after fetch
var CacheMiss = function(cache, key, callback, deferred){
    debug('new CacheMiss');
    this.cache = cache;
    this.key = key;
    this.file = cache.key2File(this.key);
    filesRendering[this.file] = true;
    this.deferred = deferred || Q.defer();
    this.callback = callback;
    if (!deferred) {
        filesProcessing[key] = this.deferred.promise;
        filesProcessingSince[key] = Date.now();
    }

    this.deferred.promise.nodeify(this.callback);
};

CacheMiss.prototype.resolveWaiting = function(err, stats) {
    delete filesRendering[this.file];
    if(err) {
        debug('reject %s', this.key);
        this.deferred.reject(err);
    }
    else {
        debug('resolve %s', this.key);
        this.deferred.resolve(stats);
    }
    if (filesProcessing[this.key] === this.deferred.promise) {
        delete filesProcessing[this.key];
        delete filesProcessingSince[this.key];
    }
};

CacheMiss.prototype.set_file_data = function(data){
    debug('set_file_data');
    this.cache.put(this.key, data, (this.resolveWaiting).bind(this));
};

CacheMiss.prototype.retry_get = function(){
    debug('retry_get');
    this.cache.get(this.key, (this.resolveWaiting).bind(this));
};



var cache = {
    hash_key: function(key){
        var match = /^(.*?)((\.[^.\/]*)*)?$/.exec(key);
        return sha256(match[1]) + (match[2] || '');
    },

    key2File: function(key){
        return path.join(root, this.hash_key(key));
    },

    checkValidity: function(file, callback){
        fs.stat(file, function(err, stats){
            if(err) return callback(err);

            var now = (new Date()).getTime();

            if (stats.atime.getTime() + parseInt(config("tmpfilecache").maxObjectLifetime) >= now ) {
                debug('file is fresh %s', file);
                callback(null, {
                    path : file,
                    stat : stats
                });
            }
            else {
                debug('file is expired %s', file);
                fs.unlink(file, function() {
                    callback(null, null);
                });
            }
        });
    },

    get:  function(key, callback){
        cache.checkValidity(cache.key2File(key), callback);
    },

    put: function(key, data, callback){
        var file = cache.key2File(key);
        fs.writeFile(file, data, function(err){
            if(err) return callback(err);

            callback(null, { path: file });
        });
    },

    fetch: function(key, oncachemiss, callback, opts){
        // rfcx-local 2026-09-27 (FINDING-2026-09-27-prc-autogain-concurrent-legacy-audio):
        // every caller SERVES the file and then UNLINKS the path it was handed
        // (res.sendFile -> fs.unlink). With one shared path per key, two
        // concurrent requests for the same asset raced: the first to finish
        // unlinked the file the second was rendering into / about to open, and
        // the second answered 500 ENOENT (6-7 of 10 concurrent pairs,
        // reproduced on the production model code). Two changes, both here so
        // no caller has to change:
        //  (1) a request that finds a render IN FLIGHT for its key WAITS for it
        //      instead of starting a second render into the same file (the
        //      join was commented out in 2024-04 #1507). The wait is BOUNDED:
        //      several miss handlers report some errors straight to their own
        //      callback without resolving the miss, so an unbounded join could
        //      hang every later request for that key. Past the bound the entry
        //      is dropped and this request renders for itself (the old path).
        //  (2) a caller that DELETES what it is handed (serve-then-unlink: the
        //      asset routes, the export job) asks for its OWN path with
        //      `{ ownLink: true }`: a hard link to the cached bytes (same dir,
        //      same filesystem, O(1), no copy), so its unlink removes only its own
        //      name. OPT-IN, not default (IRR 2026-09-28): internal readers that
        //      KEEP the shared file (fetchInfo, spectrogram/thumbnail renders
        //      reading the raw recording, scidx reads) would otherwise leave one
        //      extra link per call until the 24 h sweep.
        var self = this;
        if (opts && opts.ownLink) {
            var userCallback = callback;
            callback = function(err, data){
                if (err || !data || !data.path) { return userCallback(err, data); }
                cache.linkForCaller(data, userCallback);
            };
        }
        var inflight = filesProcessing[key];
        if (inflight) {
            var left = cache.joinTimeoutMs() - (Date.now() - (filesProcessingSince[key] || 0));
            if (left > 0) {
                var settled = false;
                var timer = setTimeout(function(){
                    if (settled) { return; }
                    settled = true;
                    if (filesProcessing[key] === inflight) {
                        console.warn('tmpfilecache: in-flight miss for %s exceeded the join bound; rendering again', key);
                        delete filesProcessing[key];
                        delete filesProcessingSince[key];
                    }
                    self.fetchOwn(key, oncachemiss, callback);
                }, left);
                inflight.then(function(stats){
                    if (settled) { return; }
                    settled = true; clearTimeout(timer);
                    callback(null, stats);
                }, function(err){
                    if (settled) { return; }
                    settled = true; clearTimeout(timer);
                    callback(err);
                });
                return;
            }
            // a stale entry (its miss never resolved): forget it and render
            delete filesProcessing[key];
            delete filesProcessingSince[key];
        }
        this.fetchOwn(key, oncachemiss, callback);
    },

    /** Upper bound on how long a request waits for someone else's in-flight
     * render of the same key (config tmpfilecache.inflightJoinTimeout, or env
     * TMPFILECACHE_INFLIGHTJOINTIMEOUT; default 30 s).
     */
    joinTimeoutMs: function(){
        var v = parseInt(config("tmpfilecache").inflightJoinTimeout, 10);
        return v > 0 ? v : 30000;
    },

    fetchOwn: function(key, oncachemiss, callback){
        // Reserve the in-flight slot BEFORE the async stat, so a request that
        // arrives while this one is still stat-ing joins it instead of
        // starting a second render. A HIT (or a stat error) releases the
        // slot to anyone who joined, with the same result this request gets.
        var slot = Q.defer();
        filesProcessing[key] = slot.promise;
        filesProcessingSince[key] = Date.now();
        var release = function(err, data){
            if (filesProcessing[key] === slot.promise) {
                delete filesProcessing[key];
                delete filesProcessingSince[key];
            }
            if (err) { slot.reject(err); } else { slot.resolve(data); }
        };
        slot.promise.catch(function(){}); // a joiner-less rejection must not be 'unhandled'
        this.get(key, function(err, data){
            if(!data || err){
                if(err && err.code && err.code !== "ENOENT"){
                    release(err);
                    callback(err);
                }
                else {
                    // rfcx-local 2026-08-30: several oncachemiss callbacks are
                    // `async` functions (e.g. recordings.fetchRecordingFile), so
                    // they return a promise this call site used to DISCARD. Any
                    // throw inside then became an unhandled rejection in a bare
                    // async context — and for a SYNCHRONOUS throw inside the
                    // callback's first tick, an uncaughtException that bin/www
                    // deliberately fail-stops on (process.exit(1)). Measured:
                    // every crash in the 08-29T15:02Z storm was this path, hit
                    // during a ~12 req/s bulk recordings/download run when the
                    // s3 layer returned a non-XML 404 body (now also fixed
                    // infra-side). Contain BOTH shapes: route a rejected promise
                    // AND a synchronous throw into the CacheMiss's own deferred,
                    // which nodeifies to the caller's callback — the error
                    // reaches the request handler instead of killing the pod.
                    var miss = new CacheMiss(cache, key, callback, slot);
                    try {
                        var ret = oncachemiss(miss);
                        if (ret && typeof ret.catch === 'function') {
                            ret.catch(function (e) { miss.resolveWaiting(e); });
                        }
                    } catch (e) {
                        miss.resolveWaiting(e);
                    }
                }
            }
            else {
                release(null, data);
                callback(null, data);
            }
        });
    },

    /** Give one caller its own hard link to a cached file (see fetch). The link
     * keeps the cache file's extension (routes derive Content-Type/filename
     * from it) and lives beside it, so the caller's unlink and the cleanup
     * sweep treat it like any other cache file. If linking fails (e.g. the
     * source vanished between stat and link), fall back to the shared path:
     * exactly the old behaviour, never worse.
     */
    linkNonce: 0,
    linkForCaller: function(data, callback){
        var src = data.path;
        var ext = path.extname(src);
        var dst = src.slice(0, src.length - ext.length) + '.r' + process.pid + '-' + Date.now().toString(36) + '-' + (++cache.linkNonce) + ext;
        fs.link(src, dst, function(err){
            if (err) {
                debug('link failed for %s (%s); serving the shared path', src, err.code);
                return callback(null, data);
            }
            var out = {};
            for (var k in data) { if (Object.prototype.hasOwnProperty.call(data, k)) { out[k] = data[k]; } }
            out.path = dst;
            // the shared cache path, for callers that derive SIBLING names from
            // it (legacy spectrogram tiles: tyler -> '<sha>.tile_x_y.png')
            out.cachePath = src;
            cache.scheduleReap(src, 0);
            callback(null, out);
        });
    },

    /** Keep the OLD disk lifetime. Before per-caller links, a serve-then-unlink
     * caller deleted the cached bytes right after sending (2023, "Remove temp
     * files after using them"). With links, its unlink removes only its own
     * name, so the shared original would otherwise linger until the 24 h
     * sweep. Once every handed-out link is gone (st_nlink back to 1) the
     * original is removed, as before. While any caller still holds a link
     * (e.g. the tile path, which keeps its source for the next tile) it stays,
     * also as before. Never while a render is writing into it.
     */
    reapDelayMs: function(){
        var v = parseInt(config("tmpfilecache").handoutReapDelay, 10);
        return v > 0 ? v : 60000;
    },
    scheduleReap: function(file, attempt){
        if (reapTimers[file]) { return; }
        var t = setTimeout(function(){
            delete reapTimers[file];
            if (filesRendering[file]) { return; }
            fs.stat(file, function(err, st){
                if (err) { return; }                       // already gone
                if (filesRendering[file]) { return; }
                if (st.nlink <= 1) {
                    fs.unlink(file, function(){});
                } else if (attempt < 10) {
                    cache.scheduleReap(file, attempt + 1);  // a slow sender still holds a link
                }                                           // else: the regular sweep takes it
            });
        }, cache.reapDelayMs());
        if (t && typeof t.unref === 'function') { t.unref(); }
        reapTimers[file] = t;
    },

    cleanupTimeout: 0,

    cleanup: function(){
        console.info('Cleaning up tmpcache.');
        fs.readdir(root, function(err, files){
            if(err) return console.error(err.stack);
            async.each(files, function(subfile, next){
                if (/\.gitignore|\.placeholder/.test(subfile)) {
                    next();
                    return;
                }
                var file = path.join(root, subfile);
                cache.checkValidity(file, next);
            }, function(err){
                cache.setCleanupTimeout();
            });
        });
    },

    setCleanupTimeout: function(){
        if(cache.cleanupTimeout) {
            return;
        }

        var delay = parseInt(config("tmpfilecache").cleanupInterval);
        debug('tmpfilecache cleanup will run in: %d seconds.', (delay/1000.0));
        cache.cleanupTimeout = setTimeout(function(){
            cache.cleanupTimeout = 0;
            cache.cleanup();
        }, delay);
    }
};

module.exports = cache;
