/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');

router.get('/', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.find({
        project: req.project.project_id
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

module.exports = router;

