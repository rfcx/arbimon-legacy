/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../model');
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
    var site = await model.sites.find({ external_id: siteExternalId }).get(0);
    if (!site) {
      if (rfcxConfig.coreAPIEnabled) {
        try {
          // Find info about this site (guardian) in Core API DB
          const externalSite = await model.sites.findInCoreAPI(siteExternalId)
          // Check if we have a project for this site in the DB
          var project = await model.projects.find({ url }).get(0)
          if (!project) {
            // Find info about this project in Core API DB
            const externalProject = await model.projects.findInCoreAPI(url)
            // All guardian sites belong to support user by default
            const user = (await model.users.findByEmailAsync('support@rfcx.org'))[0];
            // Create missing project
            const url = await model.projects.findUniqueUrl(externalProject.name, externalProject.id, user.user_id)
            let projectId = await model.projects.createProject({
              name: externalProject.name,
              description: externalProject.description,
              is_private: true,
              external_id: externalProject.id,
              url: externalSite.site.guid
            }, user.user_id)
            project = await model.projects.find({ projectId }).get(0);
          }
          // Create missing site
          const siteInsertData = await model.sites.insertAsync({
            name: externalSite.shortname,
            external_id: externalSite.guid,
            lat: externalSite.latitude || 0,
            lon: externalSite.longitude || 0,
            alt: externalSite.altitude || 0,
            project_id: project.project_id
          });
          site = (await model.sites.findByIdAsync(siteInsertData.insertId))[0];
        }
        catch (e) {
          console.error('/ingest/recordings/create sync error', e)
          throw new EmptyResultError('Site with given external_id not found.');
        }
      }
      else {
        throw new EmptyResultError('Site with given external_id not found.');
      }
    }
    for (let data of converter.transformedArray) {
      var recordingData = {
        site_id: site.site_id,
        uri: data.uri,
        datetime_utc: data.datetime.format('YYYY-MM-DD HH:mm:ss.SSS'), // We get datetime in UTC from Core API. Required format to avoid timezone issues in joi
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
        upload_time: new Date(),
        meta: data.meta
      };
      const parsedData = data.meta ? JSON.parse(data.meta) : null;
      if (parsedData && parsedData.ARTIST && parsedData.ARTIST.startsWith('AudioMoth')) {
        recordingData.recorder = 'AudioMoth';
      }
      const datetimeUtc = recordingData.datetime_utc;
      const timezone = await model.sites.getSiteTimezoneAsync(recordingData.site_id);
      const format = 'YYYY-MM-DD HH:mm:ss';
      const datetimeLocal = datetimeUtc ? moment.tz(datetimeUtc, timezone).format(format) : null;
      recordingData.datetime = datetimeLocal ? datetimeLocal : moment.utc(datetimeUtc).format(format);
      await model.recordings.insertAsync(recordingData);
    }
    res.sendStatus(201);
  } catch (e) {
    httpErrorHandler(req, res, 'Failed creating a recording')(e);
  }

})

router.get('/recordings/:attr', async function(req, res) {
  const token = await auth0Service.getToken();
  const apiUrl = `${rfcxConfig.mediaBaseUrl}/internal/assets/streams/${req.params.attr}`;
  request.get(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }).pipe(res);
})

module.exports = router;
