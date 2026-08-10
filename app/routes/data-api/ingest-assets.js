/* jshint node:true */
"use strict";

/**
 * SESSION-GATED media asset proxy.
 *
 * `GET /legacy-api/ingest/recordings/:attr` renders a spectrogram (or audio)
 * for an arbitrary stream + time window by proxying core media-api's
 * `/internal/assets/streams/:attr`.
 *
 * WHY THIS LIVES HERE AND NOT IN `ingest.js` / `non-session.js`
 * -------------------------------------------------------------
 * This route used to sit in `non-session.js` alongside the ingest POSTs. Those
 * POSTs carry their own JWT guards (`verifyToken()` + `hasRole(['systemUser'])`)
 * and are called SERVER-SIDE by rfcx-api, so they legitimately belong outside
 * the session. This GET does NOT have a guard of its own -- it was protected
 * only by the session middleware until commit f6240fd2 (2023-03-06,
 * "don't use sessions for urls which use jwt") moved `/ingest` out of the
 * session-gated router. That commit's reasoning held for 8 of the 9 routes it
 * moved; this one was the exception and silently became public.
 *
 * The effect was that ANY anonymous caller could fetch spectrograms AND raw
 * audio (`_fwav.wav`, `_fmp3.mp3`) for ANY stream -- including private projects
 * -- because the proxy mints a machine-to-machine `systemUser` Auth0 token,
 * which makes media-api skip its per-user `readableBy` scoping entirely.
 * Verified live against production on 2026-08-10 before this change.
 *
 * Mounting it in `routes/index.js` AFTER the "Force login" middleware restores
 * the pre-2023 protection. That works for a bare `<img src=...>` because the
 * gate is COOKIE-based, not header-based: `parseTokenData()` reads the JWT from
 * `req.session.idToken` (set at login in `model/users.js`) when no
 * `Authorization` header is present, and a same-origin `<img>` sends the
 * `arbimon` session cookie automatically. An `<img>` cannot send an
 * `Authorization` header -- it does not need to.
 *
 * DO NOT move this back into `non-session.js`.
 */

let express = require('express');
let router = express.Router();
const request = require('request');

const config = require('../../config');
const rfcxConfig = config('rfcx');
const auth0Service = require('../../model/auth0');

router.get('/recordings/:attr', async function(req, res) {
  const token = await auth0Service.getToken();
  const apiUrl = `${rfcxConfig.mediaBaseUrl}/internal/assets/streams/${req.params.attr}`;
  // Proxy the media-api asset. media-api pipes its response headers through
  // verbatim (Content-Disposition: attachment + a short Cache-Control),
  // which makes browsers treat inline spectrogram <img> resources as file
  // downloads and re-fetch/re-render them on every page view. These asset
  // URLs are CONTENT-ADDRESSED (every render param is encoded in
  // req.params.attr), so for images we rewrite the headers to serve INLINE
  // + immutable so browsers and the CDN cache them. Audio keeps download
  // semantics. We must use res.writeHead (not setHeader + request.pipe)
  // because the 'request' lib copies the upstream headers onto res during
  // pipe, which would clobber our Content-Disposition.
  //
  // NOTE: the upstream URL is built from `req.params.attr` ALONE and NO query
  // string is forwarded. That is deliberate and load-bearing: media-api
  // supports `?refresh=true`, which skips the result cache and forces a
  // re-render (a CPU/DoS amplifier). DO NOT add query-string forwarding here.
  const attr = req.params.attr || '';
  const isImage = /\.(png|jpe?g|webp)$/i.test(attr);
  const upstream = request.get(apiUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.status(502);
    res.end();
  });
  upstream.on('response', (upRes) => {
    const h = {};
    const passthrough = ['content-type', 'content-length', 'accept-ranges',
      'content-range', 'rfcx-stream-next-timestamp', 'rfcx-stream-gaps',
      'access-control-expose-headers', 'last-modified', 'etag'];
    passthrough.forEach((k) => {
      if (upRes.headers[k] !== undefined) h[k] = upRes.headers[k];
    });
    if (isImage) {
      if (!h['content-type']) h['content-type'] = 'image/png';
      h['content-disposition'] = `inline; filename="${attr}"`;
      // Private-project assets are now session-gated, so they must NOT be
      // stored by shared caches (Cloudflare/proxies) where they could be
      // served to a different, unauthenticated viewer. `private` keeps the
      // long-lived browser caching that makes the render cache pay off while
      // preventing shared-cache storage.
      h['cache-control'] = 'private, max-age=31536000, immutable';
    } else {
      if (upRes.headers['content-disposition']) h['content-disposition'] = upRes.headers['content-disposition'];
      if (upRes.headers['cache-control']) h['cache-control'] = upRes.headers['cache-control'];
    }
    res.writeHead(upRes.statusCode, h);
    upRes.on('data', (chunk) => res.write(chunk));
    upRes.on('end', () => res.end());
    upRes.on('error', () => { try { res.end(); } catch (e) {} });
  });
})

module.exports = router;
