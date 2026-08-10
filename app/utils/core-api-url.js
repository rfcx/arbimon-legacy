/**
 * Backend-aware base URLs for the RFCx API.
 *
 * WHY THIS EXISTS
 * ---------------
 * `apiBaseUrl` (https://api.rfcx.org) is NOT one service. The public router
 * fans that hostname out by path (platform/routing/00-public-router.yaml):
 *
 *     ^/streams/[^/]+/segments/[^/]+/file$   -> core-api
 *     ^/(v[12])(/|$)(.*)$                    -> noncore-api   (prefix PRESERVED)
 *     /                                      -> core-api
 *
 * Every use of `apiBaseUrl` in this codebase is a SERVER-SIDE outbound call
 * (12 call sites in app/model/*; the value is never serialised to a browser --
 * that is `bioAnalyticsBaseUrl`, which is deliberately left public). So these
 * calls do not need to leave the cluster at all: resolving api.rfcx.org from a
 * pod goes out to Cloudflare and back in through the tunnel, which costs
 * bandwidth on the constrained link, puts the highest-risk edge surface on an
 * internal hot path, and sends a bearer token over the public internet.
 *
 * They cannot, however, all be pointed at ONE in-cluster Service: the /v1 and
 * /v2 routes are served by noncore-api and core-api returns 404 for them.
 * Verified live from inside the pod (GET, the method the app actually uses):
 *
 *     https://api.rfcx.org/v1/users/touchapi        -> 401  (route exists)
 *     http://noncore-api.../v1/users/touchapi       -> 401  (same handler)
 *     http://core-api.../v1/users/touchapi          -> 404  (WRONG service)
 *
 * Hence the split is by BACKEND, not by "internal vs external": that is the
 * distinction the code actually has, and a mis-assignment fails loudly with a
 * 404 rather than silently.
 *
 * The nginx rewrite is a no-op for a direct call -- it re-adds the prefix
 * (`proxy_pass http://$upstream_noncore/$1/$3`, commented "Preserve the /v1 or
 * /v2 prefix"), so noncore-api serves `/v1/...` itself and callers keep their
 * existing paths unchanged.
 *
 * FALLBACK CONTRACT
 * -----------------
 * Both helpers fall back to `apiBaseUrl` when their own config value is empty.
 * So an environment that sets neither RFCX_COREAPIBASEURL nor
 * RFCX_NONCOREAPIBASEURL behaves EXACTLY as before this change (staging, dev,
 * and any deployment not yet migrated), and the change is reverted by unsetting
 * two env vars -- no code rollback required.
 *
 * NOTE ON CONFIG: app/config.js only applies an env override for keys that
 * already exist in the JSON, so `coreApiBaseUrl`/`noncoreApiBaseUrl` are
 * declared (empty) in config/rfcx.json. Removing them there would silently
 * disable RFCX_COREAPIBASEURL / RFCX_NONCOREAPIBASEURL.
 */

const config = require('../config');

function trimTrailingSlash (s) {
    return typeof s === 'string' ? s.replace(/\/+$/, '') : s;
}

/** Base URL for core-api routes (everything except /v1 and /v2). */
function coreApiBaseUrl () {
    const c = config('rfcx');
    const v = c.coreApiBaseUrl;
    return trimTrailingSlash(v && String(v).trim() ? v : c.apiBaseUrl);
}

/** Base URL for noncore-api routes (the /v1 and /v2 prefixes). */
function noncoreApiBaseUrl () {
    const c = config('rfcx');
    const v = c.noncoreApiBaseUrl;
    return trimTrailingSlash(v && String(v).trim() ? v : c.apiBaseUrl);
}

module.exports = { coreApiBaseUrl, noncoreApiBaseUrl };
