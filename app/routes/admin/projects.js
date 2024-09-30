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
    res.type('json');
    model.projects.listAll(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.put('/:projectId', function(req, res, next) {
    res.type('json');
    
    var project = req.body.project;
    
    project.project_id = req.params.projectId;
    
    model.projects.update(project).then(function() {
        return model.projects.find({ id: req.params.projectId }).get(0);
    }).then(function(project){
        res.json(project);
    }).catch(next);
});

module.exports = router;
