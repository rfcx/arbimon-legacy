/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var joi = require('joi');
var q = require('q');
var model = require('../../model');
const request = require('request');

const authentication = require('../../middleware/jwt');
const verifyToken = authentication.verifyToken;
const hasRole = authentication.hasRole;
const { Converter, ValidationError, EmptyResultError, ForbiddenError, httpErrorHandler } = require('@rfcx/http-utils');

const config = require('../../config');
const rfcxConfig = config('rfcx');
const auth0Service = require('../../model/auth0');

var projectSchema = joi.object().keys({
  name: joi.string(),
  url: joi.string(),
  description: joi.string(),
  is_private: joi.boolean(),
});

var freePlan = { ...model.projects.plans.free };

var createProject = function(project, userId) {
  return q.ninvoke(model.projects, "create", project, userId).then(function(projectId) {
      model.projects.insertNews({
          news_type_id: 1, // project created
          user_id: userId,
          project_id: projectId,
          data: JSON.stringify({})
      });

      return model.projects.find({id: projectId}).get(0)
  });
};

// Ensures that user with specified Auth0 token exists in MySQL and creates a project for him
router.get('/user-project', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
  try {
      const user = await model.users.ensureUserExistFromAuth0(req.user);
      const project = {
          is_private: true,
          plan: freePlan,
          name: `${user.firstname} ${user.lastname}'s project`,
          url: `${user.user_id}-${user.firstname.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()}-project`,
          description: `${user.firstname}'s personal project`,
          project_type_id: 1
      };
      await q.ninvoke(joi, 'validate', project, projectSchema, {
          stripUnknown: true,
          presence: 'required',
      });
      const projWithExistingUrl = await model.projects.find({url: project.url}).get(0);
      if (projWithExistingUrl) {
          console.log(`Found existing project by url for user ${user.user_id}`);
          return res.json(projWithExistingUrl);
      }
      const proj = await createProject(project, user.user_id);
      console.log(`Created new personal project for user ${user.user_id}`);
      res.status(201).json(proj);
  } catch (e) {
      httpErrorHandler(req, res, 'Failed creating a project')(e);
  }
})

router.post('/project/:id/sites/create', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
    try {
      const project = await model.projects.find({id: req.params.id}).get(0);
      if (!project) {
        throw new EmptyResultError('Project with given uri not found.');
      }
      const projectUsers = await model.projects.getUsersAsync(project.project_id);
      const user = await model.users.ensureUserExistFromAuth0(req.user);
      const hasPermission = !!projectUsers.find(x => x.id === user.user_id);
      if (!hasPermission) {
        throw new ForbiddenError(`You don't have permission to manage project sites`);
      }
      const convertedParams = {};
      const params = new Converter(req.body, convertedParams);
      params.convert('name').toString();
      params.convert('external_id').toString();
      params.convert('lat').toFloat().minimum(-90).maximum(90);
      params.convert('lon').toFloat().minimum(-180).maximum(180);
      params.convert('alt').toFloat().minimum(0);

      await params.validate();
      const siteData = {
        name: convertedParams.name,
        external_id: convertedParams.external_id,
        lat: convertedParams.lat,
        lon: convertedParams.lon,
        alt: convertedParams.alt,
        project_id: project.project_id,
        legacy: false
      };
      const existingSite = await model.sites.find({ external_id: siteData.external_id, project_id: siteData.project_id }).get(0);
      if (existingSite) {
        return res.json(existingSite);
      }
      const insertData = await model.sites.insertAsync(siteData);
      const site = await model.sites.findByIdAsync(insertData.insertId);
      model.projects.insertNews({
          news_type_id: 2, // site created
          user_id: user.user_id,
          project_id: project.project_id,
          data: JSON.stringify({ site: siteData.name })
      });
      res.status(201).json(site[0]);
    } catch (e) {
        httpErrorHandler(req, res, 'Failed creating a site')(e);
    }
})

router.patch('/sites/:externalId', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
  try {
    const user = await model.users.ensureUserExistFromAuth0(req.user);
    const converter = new Converter(req.body, {});
    converter.convert('name').optional().toString();
    converter.convert('latitude').optional().toFloat().minimum(-90).maximum(90);
    converter.convert('longitude').optional().toFloat().minimum(-180).maximum(180);
    converter.convert('altitude').optional().toFloat().minimum(0);

    const params = await converter.validate();
    const site = await model.sites.find({ external_id: req.params.externalId }).get(0);
    if (!site) {
      // TODO request site from CORE API if not found
      throw new EmptyResultError('Site with given external_id not found.');
    }
    const project = await model.projects.find({id: site.project_id}).get(0);
    const projectUsers = await model.projects.getUsersAsync(project.project_id);
    const hasPermission = !!projectUsers.find(x => x.id === user.user_id);
    if (!hasPermission) {
      throw new ForbiddenError(`You don't have permission to manage project sites`);
    }
    await model.sites.updateAsync({
      site_id: site.site_id,
      name: params.name,
      lat: params.latitude,
      lon: params.longitude,
      alt: params.altitude
    })
    res.sendStatus(200);
  } catch (e) {
    httpErrorHandler(req, res, 'Failed updating a site')(e);
  }
})

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
          const url = externalSite.site.guid
          // Check if we have a project for this site in the DB
          var project = await model.projects.find({ url }).get(0)
          if (!project) {
            // Find info about this project in Core API DB
            const externalProject = await model.projects.findInCoreAPI(url)
            // All guardian sites belong to support user by default
            const user = (await model.users.findByEmailAsync('support@rfcx.org'))[0];
            // Create missing project
            project = await createProject({
              is_private: true,
              plan: freePlan,
              name: externalProject.name,
              url: externalProject.guid,
              description: externalProject.description,
              project_type_id: 1
            }, user.user_id)
          }
          // Create missing site
          const siteInsertData = await model.sites.insertAsync({
            name: externalSite.shortname,
            external_id: externalSite.guid,
            lat: externalSite.latitude || 0,
            lon: externalSite.longitude || 0,
            alt: externalSite.altitude || 0,
            project_id: project.project_id,
            legacy: false
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
    const fileExists = await model.recordings.existsAsync({
      site_id: site.site_id,
      filename: convertedParams.uri
    });
    if (fileExists) {
      // Do nothing
      return res.sendStatus(200);
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
