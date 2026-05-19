/**
 * Public URL helper for the `arbimon2` S3 bucket — jobs-tree copy.
 *
 * `jobs/` is a separate npm package from the main `app/`, so it cannot
 * `require('../../app/utils/asset-url')` cleanly. This file is the
 * jobs-side duplicate of `app/utils/asset-url.js`; both read the same
 * `ARBIMON2_PUBLIC_URL_BASE` env var and default to the same
 * `https://s3.arbimon.org/arbimon2` rfcx-local endpoint. Keep the two
 * in sync if either ever changes.
 */

const DEFAULT_BASE = 'https://s3.arbimon.org/arbimon2';

function trimTrailingSlash (s) {
    return typeof s === 'string' ? s.replace(/\/+$/, '') : s;
}

function arbimon2PublicUrlBase () {
    const fromEnv = process.env.ARBIMON2_PUBLIC_URL_BASE;
    if (fromEnv && fromEnv.trim()) {
        return trimTrailingSlash(fromEnv.trim());
    }
    return DEFAULT_BASE;
}

function arbimon2PublicUrl (key) {
    if (typeof key !== 'string') return key;
    const k = key.replace(/^\/+/, '');
    return `${arbimon2PublicUrlBase()}/${k}`;
}

module.exports = {
    arbimon2PublicUrl,
    arbimon2PublicUrlBase
};