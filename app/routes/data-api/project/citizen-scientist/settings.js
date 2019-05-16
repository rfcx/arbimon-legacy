/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../../model');


router.get('/', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        return model.CitizenScientist.getSettings(project_id);
    }).then(function(settings){
        res.json(settings);
    }).catch(next);
});

router.post('/', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        if(!req.haveAccess(project_id, "manage project settings")){
            throw new Error({
                error: "You don't have permission to manage project settings"
            });
        }
    }).then(function(){
        return model.CitizenScientist.setSettings({
            project: project_id,
            consensus_number: req.body.consensus_number,
            pattern_matchings: req.body.pattern_matchings,
        });
}).then(function(result){
        res.json({ ok: true, result: result });
    }).catch(next);
});


module.exports = router;
