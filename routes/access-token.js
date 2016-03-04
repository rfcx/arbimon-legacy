/* jshint node:true */
"use strict";

// var debug = require('debug')('arbimon2:route:access-token');
var express = require('express');
var router = express.Router();
var model = require('../model/');


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

module.exports = router;
