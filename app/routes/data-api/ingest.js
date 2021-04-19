/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../model');
const request = require('request');

const authentication = require('../../middleware/jwt');
const verifyToken = authentication.verifyToken;
const hasRole = authentication.hasRole;
const { Converter, EmptyResultError, httpErrorHandler } = require('@rfcx/http-utils');

const config = require('../../config');
const rfcxConfig = config('rfcx');
const auth0Service = require('../../model/auth0');

router.post('/recordings/create', verifyToken(), hasRole(['systemUser']), async function(req, res) {
  try {
    const convertedParams = {};
    const params = new Converter(req.body, convertedParams);
    params.convert('site_external_id').toString();
    params.convert('uri').toString();
    params.convert('datetime').toMomentUtc();
    params.convert('sample_rate').toInt();
    params.convert('precision').toInt();
    params.convert('duration').toFloat();
    params.convert('samples').toInt();
    params.convert('file_size').toInt();
    params.convert('bit_rate').toString();
    params.convert('sample_encoding').toString();
    params.convert('nameformat').toString().optional().default('AudioMoth');
    params.convert('recorder').toString().optional().default('Unknown');
    params.convert('mic').toString().optional().default('Unknown');
    params.convert('sver').toString().optional().default('Unknown');

    await params.validate();
    var site = await model.sites.find({ external_id: convertedParams.site_external_id }).get(0);
    if (!site) {
      if (rfcxConfig.coreAPIEnabled) {
        try {
          // Find info about this site (guardian) in Core API DB
          const externalSite = await model.sites.findInCoreAPI(convertedParams.site_external_id)
          // Check if we have a project for this site in the DB
          var project = await model.projects.find({ url }).get(0)
          if (!project) {
            // Find info about this project in Core API DB
            const externalProject = await model.projects.findInCoreAPI(url)
            // All guardian sites belong to support user by default
            const user = (await model.users.findByEmailAsync('support@rfcx.org'))[0];
            // Create missing project
            const url = await model.projects.findUniqueUrl(externalProject.name, externalProject.id, user.user_id)
            project = await model.projects.createProject({
              name: externalProject.name,
              description: externalProject.description,
              is_private: true,
              external_id: externalProject.id,
              url: externalSite.site.guid
            }, user.user_id)
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
    const recordingData = {
      site_id: site.site_id,
      uri: convertedParams.uri,
      datetime: convertedParams.datetime.format('YYYY-MM-DD HH:mm:ss.SSS'), // required format to avoid timezone issues in joi
      mic: convertedParams.mic,
      recorder: convertedParams.recorder,
      version: convertedParams.sver,
      sample_rate: convertedParams.sample_rate,
      precision: convertedParams.precision,
      duration: convertedParams.duration,
      samples: convertedParams.samples,
      file_size: convertedParams.file_size,
      bit_rate: convertedParams.bit_rate,
      sample_encoding: convertedParams.sample_encoding,
      upload_time: new Date()
    };
    const datetimeLocal = await model.recordings.calculateLocalTimeAsync(recordingData.site_id, recordingData.datetime);
    recordingData.datetime_local = datetimeLocal? datetimeLocal : recordingData.datetime;
    const insertData = await model.recordings.insertAsync(recordingData);
    const recording = await model.recordings.findByIdAsync(insertData.insertId);
    res.status(201).json(recording);
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
