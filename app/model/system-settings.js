/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:system_settings');
var mysql = require('mysql');
var async = require('async');
var joi = require('joi');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var settings = {
    get: function(key, callback) {
        if(typeof key === 'function' && !callback) {
            callback = key;
            key = null;
        }
        
        var q = "SELECT * \n"+
                "FROM system_settings \n";
        
        if(key) {
            q += "WHERE `key` = " + dbpool.escape(key);
        }
        
        queryHandler(q, callback);
    },
    
    set: function(key, value, callback) {
        var q = "REPLACE INTO system_settings \n"+
                "SET `key` = ?, `value` = ?";
        queryHandler(dbpool.format(q, [key, value]), callback);
    }
};

module.exports = settings;
