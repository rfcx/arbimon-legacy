/* jshint node:true */
"use strict";

let express = require('express');
let router = express.Router();
let model = require('../../model');
const moment = require('moment');
const authentication = require('../../middleware/jwt');
const verifyToken = authentication.verifyToken;
const hasRole = authentication.hasRole;
const { EmptyResultError, httpErrorHandler, ArrayConverter } = require('@rfcx/http-utils');

/**
 * Resolve the distinct uploader emails in one batch to arbimon users.user_id
 * (one bounded SELECT per request, never per row). Unknown emails are simply
 * absent from the map -> the caller stores NULL. Fail-open by design: an
 * attribution lookup must never fail an ingest.
 */
async function resolveUploaderIds(rows) {
  const emails = Array.from(new Set(rows
    .map(r => r.uploaded_by_email)
    .filter(e => typeof e === 'string' && e.length > 0)
    .map(e => e.toLowerCase())));
  if (!emails.length) return {};
  try {
    const found = await model.users.findByEmailsAsync(emails);
    const map = {};
    for (const u of found) { if (u && u.email) map[String(u.email).toLowerCase()] = u.user_id; }
    return map;
  } catch (e) {
    console.warn('[ingest] uploaded_by resolution failed (storing NULL):', e && e.message);
    return {};
  }
}

router.post('/recordings/create', verifyToken(), hasRole(['systemUser']), async function(req, res) {
  try {
    const converter = new ArrayConverter(req.body)
    converter.convert('site_external_id').toString();
    converter.convert('uri').toString();
    converter.convert('datetime').toMomentUtc();
    converter.convert('sample_rate').toInt();
    converter.convert('precision').toInt();
    converter.convert('duration').toFloat();
    converter.convert('samples').toInt();
    // ⚠️ This is the WRITE side and is CORRECT as of 2026-08-21 (rfcx-api#670
    // restored the value, ingest-service#125 made it the stored FLAC rather than
    // the intermediate WAV). But READERS must not trust the column for
    // historical rows: 58.7% of `recordings` still carry 0/NULL from the
    // 2023-07-22 regression. Backfill deferred — OPEN-ITEMS §189.
    converter.convert('file_size').toInt();
    converter.convert('bit_rate').toString();
    converter.convert('sample_encoding').toString();
    converter.convert('nameformat').toString().optional().default('AudioMoth');
    converter.convert('recorder').toString().optional().default('Unknown');
    converter.convert('mic').toString().optional().default('Unknown');
    converter.convert('sver').toString().optional().default('Unknown');
    // 2026-09-22 (rfcx-local OPEN-ITEMS 375): the uploader's EMAIL, forwarded by
    // core-api from ingest.stream_uploads via core users. Email is the identity
    // bridge the two user tables already share (arbimon users.email is UNIQUE;
    // the legacy user-sync keys on it as rfcx_id). Resolved to users.user_id
    // below; unresolvable or absent => NULL, never invented.
    converter.convert('uploaded_by_email').toString().optional();

    await converter.validate();
    const siteExternalId = converter.transformedArray[0].site_external_id
    let site = await model.sites.find({ external_id: siteExternalId }).get(0);
    if (!site) {
      throw new EmptyResultError('Site with given external_id not found.');
    }
    const timezone = await model.sites.getSiteTimezoneAsync(site.site_id);
    const uploaderIds = await resolveUploaderIds(converter.transformedArray);
    const recordings = converter.transformedArray.map((data) => {
      const metaData = data.meta.replace(/'/g, "\\'");
      let recordingData = {
        site_id: site.site_id,
        uri: data.uri,
        datetime_utc: data.datetime.toISOString(),
        mic: data.mic,
        recorder: data.recorder,
        version: data.sver,
        sample_rate: data.sample_rate,
        precision: data.precision,
        duration: data.duration,
        samples: data.samples,
        file_size: data.file_size,
        bit_rate: data.bit_rate,
        sample_encoding: data.sample_encoding,
        upload_time: moment.utc().toISOString(),
        meta: metaData,
        uploaded_by: data.uploaded_by_email ? (uploaderIds[data.uploaded_by_email.toLowerCase()] || null) : null
      };
      const parsedData = data.meta ? JSON.parse(data.meta) : null;
			const artist = parsedData && parsedData.ARTIST ? parsedData.ARTIST : parsedData.artist
      const comment = parsedData && parsedData.comment
			const isAudioMoth = artist && artist.includes('AudioMoth')
			const songMeterOptions = ['SongMeter', 'Song Meter']
			const isSongMeter = comment && songMeterOptions.some(sm => comment.includes(sm)) ||
				artist && songMeterOptions.some(sm => artist.includes(sm))
      if (isAudioMoth) {
        recordingData.recorder = 'AudioMoth';
      }
      if (isSongMeter) {
        recordingData.recorder = 'Song Meter';
      }
      const datetimeUtc = data.datetime;
      const format = 'YYYY-MM-DD HH:mm:ss';
      const datetimeLocal = datetimeUtc ? moment.tz(datetimeUtc, timezone).format(format) : null;
      recordingData.datetime = datetimeLocal ? datetimeLocal : moment.utc(datetimeUtc).format(format);
      return recordingData
    })
    await model.recordings.insertBatchAsync(recordings);
    res.sendStatus(201);
  } catch (e) {
    httpErrorHandler(req, res, 'Failed creating a recording')(e);
  }

})

router.post('/recordings/delete', verifyToken(), hasRole(['systemUser']), async function(req, res) {
  try {
    const converter = new ArrayConverter(req.body)
    converter.convert('site_external_id').toString();
    converter.convert('uri').toString();

    await converter.validate();
    const siteExternalId = converter.transformedArray[0].site_external_id
    let site = await model.sites.find({ external_id: siteExternalId }).get(0);
    if (!site) {
      throw new EmptyResultError('Site with given external_id not found.');
    }
    // PHASE B (2026-09-09): archive rather than hard-delete. See
    // model.recordings.archiveBySiteAndUris for why (analysis results stay
    // attached, and a hard delete here is invisible to the PG read side).
    await model.recordings.archiveBySiteAndUris(site.site_id, converter.transformedArray.map(r => r.uri));
    res.sendStatus(204)
  } catch (e) {
    httpErrorHandler(req, res, 'Failed deleting recordings')(e);
  }
})

// NOTE: `GET /recordings/:attr` (the media-api asset proxy) used to live here.
// It has NO guard of its own, so mounting it in `non-session.js` alongside
// these JWT-guarded POSTs left it fully public -- anonymous callers could pull
// spectrograms AND raw audio for private projects. It now lives in
// `ingest-assets.js` and is mounted behind the "Force login" gate in
// `routes/index.js`. See that file's header for the full rationale, including
// why it could not be retired with its server-side callers on 2026-08-11.
//
// The two POSTs above stay here: they are called SERVER-SIDE by rfcx-api
// (core/_services/arbimon) with a systemUser JWT and must remain reachable
// without a browser session.

module.exports = router;
