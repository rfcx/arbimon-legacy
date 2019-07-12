/* jshint node:true */
"use strict";

// 3rd party dependencies
var debug = require('debug')('arbimon2:model:pattern_matchings');
var async = require('async');
var joi = require('joi');
var jimp = require('jimp');
var AWS = require('aws-sdk');
var q = require('q');

// local dependencies
var config       = require('../config');
var APIError = require('../utils/apierror');
var tmpfilecache = require('../utils/tmpfilecache');
var sqlutil      = require('../utils/sqlutil');
var SQLBuilder   = require('../utils/sqlbuilder');
var dbpool       = require('../utils/dbpool');
var Recordings   = require('./recordings');
var Projects     = require('./projects');
var Templates     = require('./templates');

// local variables
var s3;
var lambda = new AWS.Lambda();
var queryHandler = dbpool.queryHandler;

var CNN = {
    find: function(options){
        return {'found': 'and stuff'};
    }
};


module.exports = CNN;