/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../../model');
var csv_stringify = require("csv-stringify");
var APIError = require('../../../../utils/apierror');

router.use('/', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "view citizen scientist admin interface")){
        return next(new APIError({
            error: "You don't have permission to use the admin stats api"
        }));
    } else {
        next();
    }
});

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
        return Promise.all([
            model.CitizenScientist.getUserStats({ project: project_id, groupByUser: true, showUser: true }),
            model.CitizenScientist.getUserStats({ project: project_id })
        ]);
    }).then(function(stats){
        res.json({
            stats: stats[0],
            groupStats: stats[1][0]
        });
    }).catch(next);
});

router.get('/user/:user', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;
    var user_id = req.params.user | 0

    q.resolve().then(function(){
        return Promise.all([
            model.CitizenScientist.getUserStats({
                project: project_id,
                user: user_id,
                groupBySpecies: true,
            }),
            model.CitizenScientist.getUserStats({
                project: project_id,
                groupBySpecies: true,
            }),
        ]);
    }).then(function(stats){
        res.json({
            stats: stats[0],
            groupStats: stats[1]
        });
    }).catch(next);
});

router.get('/mine', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;
    var user = req.session.user;

    q.resolve().then(function(){
        return Promise.all([
            model.CitizenScientist.getUserStats({
                project: project_id,
                user: user.id,
                groupBySpecies: true,
            }),
            model.CitizenScientist.getUserStats({
                project: project_id,
                groupBySpecies: true,
            }),
        ]);
    }).then(function(stats){
        res.json({
            stats: stats[0],
            groupStats: stats[1]
        });
    }).catch(next);
});

router.get('/export/user-stats.csv', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.type('text/csv');
    }

    try {
        var filters = JSON.parse(req.query.filters || '{}') || {};
    } catch(e) {
        return next(e);
    }

    res.attachment(req.project.name + '-user-stats.csv')

    return model.CitizenScientist.getUserStats({
        project: req.project.project_id | 0,
        showUser: true,
        hideUserId: true,
        hideSpeciesIds: true,
        hideSpeciesCount: true,
        hideLastUpdate: true,
        groupByUser: true,
        groupBySpecies: true,
        streamQuery: true,
    }).then(function(results) {
        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});
        var colOrder={
            user: -8,
            species: -7,
            songtype: -6,
            validated: -5,
            consensus: -4,
            non_consensus: -3,
            pending: -2,
            reached_th: -1,
            last_update:1000,
        };
        fields.sort(function(a, b){
            var ca = colOrder[a] || 0, cb = colOrder[b] || 0;
            return ca < cb ? -1 : (
                ca > cb ?  1 : ( a <  b ? -1 : ( a >  b ?  1 : 0 ) )
            );
        });

        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            .pipe(res);
    }).catch(next);
});


module.exports = router;
