/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');

router.post('/new', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    return model.ClusteringModel.requestNewClusteringModelJob({
        project    : project_id,
        user       : req.session.user.id,
        name       : req.body.name,
        playlist   : req.body.playlist_id,
        params     : req.body.params,
    })
    .then(function(result){
        res.json({ create: true, result: result });
    }).catch(next);
});


module.exports = router;

