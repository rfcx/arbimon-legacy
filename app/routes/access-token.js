/* jshint node:true */
"use strict";

// var debug = require('debug')('arbimon2:route:access-token');
var express = require('express');
var router = express.Router();
var model = require('../model/');
var formatParse = require('../utils/format-parse');


router.post('/request-token', function(req, res, next) {
    res.type('json');
    model.AccessTokens.requestAccessToken({
        token: req.body.token,
        username : req.body.username,
        password : req.body.password,
        project  : req.body.project,
        site     : req.body.site,
        scope  : req.body.scope,
    }).then(function(result){
        res.json(result);
    }).catch(next);
});

router.post('/resolve-token', function(req, res, next) {
    res.type('json');
    model.AccessTokens.resolveAccessToken(req.body.token, {resolveIds:true}).then(function(resolvedToken){
        res.json(resolvedToken);
    }).catch(next);
});

router.post('/at/projectlist', function(req, res, next){
    res.type('json');
    model.AccessTokens.verifyTokenAccess(req.body.token, null, {allowEmptyScope:true}).then(function(resolvedToken){
        console.log('1', model.users.getProjectList);
        return model.users.getProjectList(resolvedToken.user);
    }).then(function(projectList){
        res.json(projectList);
    }).catch(next);
});


router.post('/at/project', function(req, res, next){
    res.type('json');
    model.AccessTokens.verifyTokenAccess(req.body.token, null, {allowEmptyScope:true}).then(function(resolvedToken){
        return model.users.hasProjectAccess(resolvedToken.user, req.body.project, {required:true});
    }).then(function(){
        return model.projects.find({id: req.body.project, basicInfo:true}).get(0);
    }).then(function(project){
        res.json(project);
    }).catch(next);
});


router.post('/at/project/sites', function(req, res, next){
    res.type('json');
    model.AccessTokens.verifyTokenAccess(req.body.token, null, {allowEmptyScope:true}).then(function(resolvedToken){
        return model.users.hasProjectAccess(resolvedToken.user, req.body.project, {required:true});
    }).then(function(){
        return model.projects.getProjectSites(req.body.project);
    }).then(function(sites){
        res.json(sites);
    }).catch(next);
});

router.post('/at/recording/check-exists', function(req, res, next) {
    res.type('json');
    model.AccessTokens.verifyTokenAccess(req.body.token, null, {allowEmptyScope:true}).then(function(resolvedToken){
        return model.users.hasProjectAccess(resolvedToken.user, req.body.project, {required:true});
    }).then(function(){
        var filename = req.body.filename;
        try {
            filename = formatParse("any", filename).filename;
        } catch(e) {
            // ignore if cannot parse
        }

        return model.recordings.exists({
            site_id: req.body.site,
            filename: filename,
        });
    }).then(function(result){
        res.json({exists: result});
    }).catch(next);
});


module.exports = router;
