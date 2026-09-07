/**
 * Media pre-warm PRODUCER — the recordings-LIST surface (rfcx-local
 * OPEN-ITEMS §217 step 2).
 *
 * WHAT THIS DOES
 * --------------
 * When the recordings list page assembles a page of rows, this module LPUSHes
 * ONE message `{"urls": [<media-api attr>, ...]}` onto a Redis list. The
 * rfcx-local `roi-prewarm-consumer` BRPOPs that list when its AMQP lanes are
 * idle and renders each attr through media-api into the hot cache, so the
 * user's SECOND visit (visualizer open, list re-render) is served warm
 * (measured 2026-08-25: base spectrogram 5,165 ms cold vs 93–175 ms warm, 55×).
 * Pre-warm makes the second visit fast, never the first.
 *
 * THE RULES THIS MODULE EXISTS TO ENFORCE (each one was earned)
 * --------------------------------------------------------------
 * 1. NEVER let pre-warm break the thing it accelerates. Every call here is
 *    fire-and-forget: nothing is awaited by the request path, every rejection
 *    is swallowed, and the module is INERT unless BOTH env vars are set.
 *    (roi_prewarm_publish.py rule 1; a channel-level 403 CrashLooped every PM
 *    worker on 2026-08-10.)
 * 2. Its OWN Redis client, NOT `app/utils/redis.js`. That client is the
 *    express-session store — a blocked or erroring command there degrades
 *    LOGIN. Also unavoidable: the producer authenticates as a SCOPED redis
 *    user (`prewarm_producer`: `~prewarm:media:*` + lpush/ltrim ONLY — no
 *    reads, no session keys, no rfcxctl, no admin), and a redis credential is
 *    per-connection.
 * 3. `client.v4.*` ONLY. The client is created `legacyMode: true` to match
 *    the app's other client; under legacyMode a bare `client.lPush(...)` is
 *    the CALLBACK form and returns undefined — a silent no-op if awaited.
 *    Proven by execution on the prod image 2026-09-04.
 * 4. NO client `name`. node-redis sends `CLIENT SETNAME` during the handshake
 *    when `name` is set; the scoped user is NOPERM'd for it, so `connect()`
 *    never resolves and the producer is silently dead for the pod's life.
 *    (Measured: connect() timed out; only repeated 'error' events.)
 * 5. LTRIM after every push, and treat loss as NORMAL. redis-ha is
 *    `appendonly no` + `allkeys-lru`: the list is evictable and a failover can
 *    drop it. A lost message = render-on-demand, the plane's accepted,
 *    non-data-loss degradation. Do NOT copy this transport for anything that
 *    must not be lost.
 * 6. Attrs come from `mediaAssetUrl(...).attr` — the app's own minted names —
 *    never hand-built. Six implementations of that grammar had drifted across
 *    three repos once; media-api canonicalises component order so the attr is
 *    the cache key.
 * 7. Reads to media-api by the consumer are TRUSTED (its systemUser token
 *    skips per-user readableBy scoping). Hence the scoped user (rule 2) and
 *    the env-qualified list name: prod uses `prewarm:media:urls`; the demo
 *    tier, which shares this redis, must use a `:demo`-suffixed name that no
 *    consumer reads. The ACL admits both; the ConfigMap key is the boundary.
 *
 * CONFIG (both required; either missing ⇒ inert, logged once at startup)
 *   PREWARM_REDIS_URL   redis://prewarm_producer:<pw>@redis-ha-master.data.svc.cluster.local:6379
 *   PREWARM_REDIS_LIST  prewarm:media:urls
 * Optional:
 *   PREWARM_LIST_CAP    max list length kept by LTRIM (default 1000)
 */
'use strict';

const moment = require('moment');

const LIST_CAP_DEFAULT = 1000;
const ERROR_LOG_INTERVAL_MS = 60 * 1000;

const url = process.env.PREWARM_REDIS_URL || '';
const list = process.env.PREWARM_REDIS_LIST || '';
const cap = Math.max(1, parseInt(process.env.PREWARM_LIST_CAP, 10) || LIST_CAP_DEFAULT);
const enabled = Boolean(url && list);

let client = null;
let connecting = null;
let lastErrorLog = 0;
const stats = { pushed: 0, dropped: 0, errors: 0 };

function logErrorRateLimited(prefix, err) {
    stats.errors += 1;
    const now = Date.now();
    if (now - lastErrorLog < ERROR_LOG_INTERVAL_MS) return;
    lastErrorLog = now;
    console.log(`prewarm producer: ${prefix}`, err && err.message ? err.message : err);
}

if (!enabled) {
    console.log('prewarm producer: INERT (PREWARM_REDIS_URL and PREWARM_REDIS_LIST must both be set)');
}

function getClient() {
    if (!enabled) return Promise.resolve(null);
    if (client && client.isOpen) return Promise.resolve(client);
    if (connecting) return connecting;
    let redis;
    try {
        redis = require('redis');
    } catch (e) {
        logErrorRateLimited('redis module unavailable', e);
        return Promise.resolve(null);
    }
    const c = redis.createClient({
        url,
        legacyMode: true,
        // Never queue commands while disconnected: a pre-warm message that
        // cannot be sent NOW is worthless later, and an unbounded offline
        // queue is a memory leak in a user-facing process.
        disableOfflineQueue: true,
        // NO `name:` — see rule 4.
        socket: {
            connectTimeout: 3000,
            // Bounded, slow reconnect: a permanently-NOPERM'd or unreachable
            // redis must cost the web process nothing but one log line/min.
            reconnectStrategy: (retries) => Math.min(30000, 1000 * Math.pow(2, Math.min(retries, 5)))
        }
    });
    c.on('error', (e) => logErrorRateLimited('client error', e));
    connecting = c.connect().then(() => {
        client = c;
        connecting = null;
        console.log(`prewarm producer: connected (list=${list}, cap=${cap})`);
        return c;
    }).catch((e) => {
        connecting = null;
        logErrorRateLimited('connect failed', e);
        try { c.disconnect().catch(() => {}); } catch (_) { /* ignore */ }
        return null;
    });
    return connecting;
}

/**
 * Fire-and-forget: push one `{"urls": [...]}` message. Returns nothing,
 * never throws, never blocks the caller. Empty / non-string entries are
 * dropped; an empty result is not sent.
 */
function publishUrls(urls) {
    if (!enabled) return;
    let clean;
    try {
        clean = Array.isArray(urls)
            ? Array.from(new Set(urls.filter((u) => typeof u === 'string' && u.length > 0)))
            : [];
    } catch (_) {
        clean = [];
    }
    if (!clean.length) return;
    let body;
    try {
        body = JSON.stringify({ urls: clean });
    } catch (_) {
        return;
    }
    getClient().then((c) => {
        if (!c) { stats.dropped += 1; return; }
        // v4 promise API (rule 3). LTRIM keeps the newest `cap` entries: LPUSH
        // puts newest at index 0, so `0..cap-1` = the newest cap messages.
        return c.v4.lPush(list, body)
            .then(() => c.v4.lTrim(list, 0, cap - 1))
            .then(() => { stats.pushed += 1; });
    }).catch((e) => {
        stats.dropped += 1;
        logErrorRateLimited('publish failed', e);
    });
}

/**
 * Build the pre-warm attrs for one recordings-LIST row: the list thumbnail
 * (what the page requests once per row) and the base spectrogram (what the
 * visualizer opens on click). Both minted by mediaAssetUrl() so the names are
 * byte-identical to what the app will request. Returns [] for any row that
 * cannot be rendered (no stream id / no datetime_utc): the must-retain set —
 * those rows' stored PNG is the only copy and there is nothing to warm.
 */
function attrsForListRow(recording, deps) {
    const { mediaAssetUrl, mediaStreamId, specWidthForDuration } = deps;
    try {
        if (!recording) return [];
        const site = recording.site_external_id;
        const streamId = mediaStreamId(recording.uri, site);
        if (!streamId) return [];
        // Same datetime rule as __compute_thumbnail_path_async: legacy rows
        // REQUIRE datetime_utc (no TZ-shifted `datetime` fallback); modern rows
        // always carry it. A row without it renders nothing, so warm nothing.
        const base = recording.datetime_utc;
        if (!base) return [];
        // moment.utc, exactly as __compute_thumbnail_path_async derives its
        // window: a bare `new Date(string)` would parse a naked datetime as
        // LOCAL time and mint a different (never-requested) attr.
        const startMs = moment.utc(base).valueOf();
        if (!isFinite(startMs)) return [];
        const durationSec = Number(recording.duration);
        const durationMs = isFinite(durationSec) ? Math.trunc(durationSec * 1000) : 0;
        const endMs = startMs + durationMs;
        const out = [];
        const thumb = mediaAssetUrl(streamId, startMs, endMs, 'z95_wdolph_g1_fspec_mtrue_d420.154.png');
        if (thumb && thumb.attr) out.push(thumb.attr);
        const w = specWidthForDuration(recording.duration);
        const spec = mediaAssetUrl(streamId, startMs, endMs, `rfull_g1_fspec_mtrue_d${w}.255_wdolph_z120.png`);
        if (spec && spec.attr) out.push(spec.attr);
        return out;
    } catch (_) {
        return [];
    }
}

module.exports = {
    enabled,
    publishUrls,
    attrsForListRow,
    stats,
    // exposed for tests only
    _config: { url: url ? '<set>' : '', list, cap }
};