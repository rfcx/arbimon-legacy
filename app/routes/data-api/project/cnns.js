/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');
var csv_stringify = require("csv-stringify");


router.get('/', function (req, res, next) {
    res.type('json');
    model.CNN.find({
        project: req.project.project_id,
        showPlaylist: true,
        showModelName: true,
        showUser: true,
        resolveModelUri: true
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/models/', function (req, res, next) {
    res.type('json');
    model.CNN.listModels({
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});


module.exports = router;