/* jshint node:true */
"use strict";

let express = require('express');
let router = express.Router();
let model = require('../../model');
const request = require('request');
const moment = require('moment');
const authentication = require('../../middleware/jwt');
const verifyToken = authentication.verifyToken;
const hasRole = authentication.hasRole;
const { EmptyResultError, httpErrorHandler, ArrayConverter } = require('@rfcx/http-utils');

const config = require('../../config');
const rfcxConfig = config('rfcx');
const auth0Service = require('../../model/auth0');

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
    converter.convert('file_size').toInt();
    converter.convert('bit_rate').toString();
    converter.convert('sample_encoding').toString();
    converter.convert('nameformat').toString().optional().default('AudioMoth');
    converter.convert('recorder').toString().optional().default('Unknown');
    converter.convert('mic').toString().optional().default('Unknown');
    converter.convert('sver').toString().optional().default('Unknown');

    await converter.validate();
    const siteExternalId = converter.transformedArray[0].site_external_id
    let site = await model.sites.find({ external_id: siteExternalId }).get(0);
    if (!site) {
      throw new EmptyResultError('Site with given external_id not found.');
    }
    const timezone = await model.sites.getSiteTimezoneAsync(site.site_id);
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
        meta: metaData
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
    await model.recordings.deleteBySiteAndUris(site.site_id, converter.transformedArray.map(r => r.uri));
    res.sendStatus(204)
  } catch (e) {
    httpErrorHandler(req, res, 'Failed deleting recordings')(e);
  }
})

router.get('/recordings/:attr', async function(req, res) {
  const token = await auth0Service.getToken();
  const apiUrl = `${rfcxConfig.mediaBaseUrl}/internal/assets/streams/${req.params.attr}`;
  request.get(apiUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).pipe(res);
})

module.exports = router;
