/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:admin');
var express = require('express');
var request = require('request');
var router = express.Router();
var async = require('async');

var config = require('../../config');
var model = require('../../model');

// only super user can access admin section

router.get('/', function(req, res, next) {
    model.projects.listAll(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.put('/:projectId', function(req, res, next) {
    var project = req.body.project;
    
    project.project_id = req.params.projectId;
    
    model.projects.update(project, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});


router.get('/codes', function(req, res, next) {
    model.ActivationCodes.listAll().then(function(codes){
        res.json(codes);
    }).catch(next);
});


router.post('/codes', function(req, res, next) {
    model.ActivationCodes.createCode(req.session.user, req.body).then(function(){
        res.json(true);
    }).catch(next);
});


module.exports = router;
