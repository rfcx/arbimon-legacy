/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var joi = require('joi');
var q = require('q');
var model = require('../../model');

const authentication = require('../../middleware/jwt')
const verifyToken = authentication.verifyToken
const hasRole = authentication.hasRole
const { httpErrorHandler } = require('../../utils/http-error-handler.js')
const Converter = require('../../utils/converter/converter')
const EmptyResultError = require('../../utils/converter/empty-result-error')
const ForbiddenError = require('../../utils/converter/forbidden-error')

var projectSchema = joi.object().keys({
  name: joi.string(),
  url: joi.string(),
  description: joi.string(),
  is_private: joi.boolean(),
});

var freePlan = {
  cost: 0,
  storage: 100,
  processing: 1000,
  tier: 'free'
};

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
router.post('/user-project', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
  try {
      const user = await model.users.ensureUserExistFromAuth0(req.user)
      const project = {
          is_private: true,
          plan: freePlan,
          name: `${user.firstname} ${user.lastname}'s project`,
          url: `${user.user_id}-${user.firstname.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()}-project`,
          description: `${user.firstname}'s personal project`,
          project_type_id: 1
      }
      await q.ninvoke(joi, 'validate', project, projectSchema, {
          stripUnknown: true,
          presence: 'required',
      })
      const projWithExistingUrl = await model.projects.find({url: project.url}).get(0)
      if (projWithExistingUrl) {
          console.log(`Found existing project by url for user ${user.user_id}`)
          return res.json(projWithExistingUrl)
      }
      const proj = await createProject(project, user.user_id)
      console.log(`Created new personal project for user ${user.user_id}`)
      res.status(201).json(proj)
  } catch (e) {
      httpErrorHandler(req, res, 'Failed creating a project')(e)
  }
})

router.post('/project/:uri/sites/create', verifyToken(), hasRole(['appUser', 'rfcxUser']), async function(req, res) {
    try {
      const project = await model.projects.find({url: req.params.uri}).get(0)
      if (!project) {
        throw new EmptyResultError('Project with given uri not found.')
      }
      const projectUsers = await model.projects.getUsersAsync(project.project_id)
      const user = await model.users.ensureUserExistFromAuth0(req.user)
      const hasPermission = !!projectUsers.find(x => x.id === user.user_id)
      if (!hasPermission) {
        throw new ForbiddenError(`You dont have permission to manage project sites`)
      }
      const convertedParams = {}
      const params = new Converter(req.body, convertedParams)
      params.convert('name').toString()
      params.convert('lat').toFloat().minimum(-90).maximum(90)
      params.convert('lon').toFloat().minimum(-180).maximum(180)
      params.convert('alt').toFloat().minimum(0)

      await params.validate()
      const siteData = {
        name: convertedParams.name,
        lat: convertedParams.lat,
        lon: convertedParams.lon,
        alt: convertedParams.alt,
        project_id: project.project_id,
        legacy: false
      }
      const insertData = await model.sites.insertAsync(siteData)
      const site = await model.sites.findByIdAsync(insertData.insertId)
      model.projects.insertNews({
          news_type_id: 2, // site created
          user_id: user.user_id,
          project_id: project.project_id,
          data: JSON.stringify({ site: siteData.name })
      });
      res.status(201).json(site[0])
    } catch (e) {
        httpErrorHandler(req, res, 'Failed creating a site')(e)
    }
})

module.exports = router;
