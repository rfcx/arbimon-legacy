/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../../model');


router.get('/classification', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        return model.CitizenScientist.getClassificationStats({ project: project_id });
    }).then(function(stats){
        res.json({stats: stats});
    }).catch(next);
});

router.get('/classification/:species', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;
    var species_id = req.params.species | 0

    q.resolve().then(function(){
        return model.CitizenScientist.getClassificationStats({
            project: project_id,
            species: species_id,
            groupByMatching: !!species_id,
        });
    }).then(function(stats){
        res.json({stats: stats});
    }).catch(next);
});

router.get('/user', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        return model.CitizenScientist.getUserStats({ project: project_id });
    }).then(function(stats){
        res.json({stats: stats});
    }).catch(next);
});

router.get('/user/:user', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;
    var user_id = req.params.user | 0

    q.resolve().then(function(){
        return model.CitizenScientist.getUserStats({
            project: project_id,
            user: user_id,
            groupBySpecies: !!user_id,
        });
    }).then(function(stats){
        res.json({stats: stats});
    }).catch(next);
});


module.exports = router;
