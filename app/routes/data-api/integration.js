/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../model');

const authentication = require('../../middleware/jwt');
const verifyToken = authentication.verifyToken;
const hasRole = authentication.hasRole;
const { Converter, EmptyResultError, ForbiddenError, httpErrorHandler } = require('@rfcx/http-utils');

router.post('/projects', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
  try {
    const converter = new Converter(req.body, {});
    converter.convert('name').toString();
    converter.convert('is_private').toBoolean().default(true);
    converter.convert('external_id').toString();
    const params = await converter.validate();
    const user = await model.users.ensureUserExistFromAuth0(req.user);
    const url = await model.projects.findUniqueUrl(params.name, params.external_id, user.user_id)
    const { name, is_private, external_id } = params
    const projectId = await model.projects.createProject({ name, is_private, external_id, url }, user.user_id);
    const project = await model.projects.find({ id: projectId }).get(0);
    res.status(201).json(project);
  } catch (e) {
    httpErrorHandler(req, res, 'Failed creating a site')(e);
  }
})

router.patch('/projects/:externalId', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
  try {
    const user = await model.users.ensureUserExistFromAuth0(req.user);
    const converter = new Converter(req.body, {});
    converter.convert('name').optional().toString();
    converter.convert('url').optional().toString();

    const params = await converter.validate();
    const project = await model.projects.find({ external_id: req.params.externalId }).get(0);
    if (!project) {
      throw new EmptyResultError('Project with given external_id not found.');
    }
    if (!await model.projects.userHasPermission(project.project_id, user.user_id)) {
      throw new ForbiddenError(`You don't have permission to manage project`);
    }
    await model.projects.updateAsync({
      project_id: project.project_id,
      name: params.name !== undefined ? params.name : project.name,
      url: params.url !== undefined ? params.url : project.url,
      is_private: project.is_private,
    })
    res.sendStatus(200);
  } catch (e) {
    httpErrorHandler(req, res, 'Failed updating a project')(e);
  }
})

router.post('/sites', verifyToken(), hasRole(['appUser', 'rfcxUser', 'guardianCreator']), async function(req, res) {
  try {
    const converter = new Converter(req.body, {});
    converter.convert('name').toString();
    converter.convert('latitude').optional().toFloat().minimum(-90).maximum(90)
    converter.convert('longitude').optional().toFloat().minimum(-180).maximum(180)
    converter.convert('altitude').optional().toFloat()
    converter.convert('external_id').toString();
    converter.convert('country_code').toString().default(null)
    converter.convert('timezone').toString();
    converter.convert('project_id').optional().toString();
    converter.convert('project_external_id').optional().toString();
    const params = await converter.validate();
    const user = await model.users.ensureUserExistFromAuth0(req.user);
    const isSuperUser = user.is_super

    let project
    if (!params.project_id && !params.project_external_id) {
      project = await model.projects.findOrCreatePersonalProject(user)
    } else {
      if (params.project_id) {
        project = await model.projects.find({id: params.project_id}).get(0);
      } else if (params.project_external_id) {
        project = await model.projects.find({ external_id: params.project_external_id }).get(0);
        // TODO: request project and permissions from Core API
      }
      if (!project) {
        throw new EmptyResultError('Project with given parameters not found.');
      }
      const hasPermission = await model.projects.userHasPermission(project.project_id, user.user_id)
      if (!hasPermission && !isSuperUser) {
        throw new ForbiddenError(`You don't have permission to manage project sites`);
      }
    }

    const siteData = {
      name: params.name,
      lat: params.latitude,
      lon: params.longitude,
      alt: params.altitude,
      external_id: params.external_id,
      project_id: project.project_id
    };
    const existingSite = await model.sites.find({ external_id: siteData.external_id, project_id: siteData.project_id }).get(0);
    if (existingSite) {
      return res.json(existingSite);
    }
    if (!params.latitude && !params.longitude) siteData.hidden = 1
    const insertData = await model.sites.insertAsync(siteData);
    await model.sites.setCountryCodeAndTimezone(insertData.insertId, params.country_code, params.timezone);
    const site = await model.sites.findByIdAsync(insertData.insertId);
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
    if (!await model.sites.userHasPermission(site, user.user_id)) {
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

router.delete('/sites/:externalId', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
  try {
    const user = await model.users.ensureUserExistFromAuth0(req.user);
    const site = await model.sites.find({ external_id: req.params.externalId }).get(0);
    if (site) {
      if (!await model.sites.userHasPermission(site, user.user_id)) {
        throw new ForbiddenError(`You don't have permission to manage project sites`);
      }
      await model.sites.removeFromProjectAsync(site.site_id, site.project_id)
    }
    res.sendStatus(204);
  } catch (e) {
    httpErrorHandler(req, res, 'Failed deleting a site')(e);
  }
})

router.post('/users', verifyToken(), hasRole(['systemUser']), async function(req, res) {
    const converter = new Converter(req.body, {})
    converter.convert('firstname').optional()
    converter.convert('lastname').optional()
    converter.convert('guid').default('')
    converter.convert('email').default('')
    converter.convert('picture').optional()
    converter.convert('user_id').optional()
    return converter.validate()
      .then(async (params) => {
        await model.users.ensureUserExistFromAuth0({
          given_name: params.firstname,
          family_name: params.lastname,
          sub: params.user_id,
          email: params.email,
        });
        res.sendStatus(200)
      })
      .catch(httpErrorHandler(req, res, 'Failed creating a user'))
})

module.exports = router;
