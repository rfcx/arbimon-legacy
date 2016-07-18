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
    model.users.list(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

module.exports = router;
