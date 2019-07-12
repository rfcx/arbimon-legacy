/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');
var csv_stringify = require("csv-stringify");


/** Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    //model.patternMatchings.find({ project:req.project.project_id, deleted:0, showUser:true, showTemplate: true, showPlaylist:true}).then(function(count) {
    //    res.json(count);
    //}).catch(next);
    res.json(model.CNN.find());
    //next();
});

module.exports = router;