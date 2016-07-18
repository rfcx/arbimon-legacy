/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:plans');
var mysql = require('mysql');
var async = require('async');
var joi = require('joi');

var config = require('../config');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var plans = {
    insert: function(planData, callback) {
        var q = "INSERT INTO project_plans \nSET ?";
        
        queryHandler(mysql.format(q, planData), callback);
    },
    find: function(params, callback) {
        var q = "SELECT * \nFROM project_plans \nWHERE ";
        
        var schema = joi.object().keys({
            id: joi.number().required(),
            project_id: joi.number(),
        }).or('id', 'project_id');
        
        var result = joi.validate(params, schema);
        
        if(result.err) {
            return callback(result.err);
        }
        
        params = result.value;
        var query = [];
        
        if(params.id) {
            query.push("plan_id = " + mysql.escape(params.id));
        }
        
        if(params.project_id) {
            query.push("project_id = " + mysql.escape(params.project_id));
        }
        
        q += query.join(' \nAND ');
        
        queryHandler(q, callback);
    },
    
    update: function(planId, planData, callback) {
        var q = "UPDATE project_plans \nSET ? WHERE plan_id = ?";
        
        queryHandler(mysql.format(q, [planData, planId]), callback);
    }
};

module.exports = plans;
