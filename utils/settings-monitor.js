/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:utils:settings_monitor');
var model = require('../model');

var settings = {};
var monitorLoop;

var settingsMonitor = function() {
    debug('getting settings');
    model.settings.get(function(err, rows) {
        if(err) {
            console.error(err);
            console.error(err.stack);
            return;
        }
        
        for(var i=0; i < rows.length; i++) {
            settings[rows[i].key] = rows[i].value;
        }
        
        debug(settings);
    });
};

var settingGetter = function(key) {
    return settings[key];
};

var init = function(argument) {
    settingsMonitor();
    monitorLoop = setInterval(settingsMonitor, 30000);
};

exports.middleware = function() {
    init();
    
    return function(req, res, next) {
        req.systemSettings = settingGetter;
        next();
    };
};

exports.settings = settingGetter;
exports.monitorLoop = monitorLoop;
