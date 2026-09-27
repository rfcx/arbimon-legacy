/**
 * configuration module.
 */
var fs   = require('fs');
var path = require('path');
var debug = require('debug')('arbimon2:config');


// config folder 
var config_folder = path.resolve(__dirname, '..', 'config');
// cache
var cache = {};

debug("watching config folder in :", config_folder);

fs.watch(config_folder, { persistent:false }, function(event, filename){
    var filename_parts = /^(.*)(\.local)?(\.json)$/.exec(filename);
    
    if(filename_parts && event == 'change') {
        debug("Config " + filename_parts[1] + " changed. (file :" + filename + ")");
        delete cache[filename_parts[1]];
    }
});

// An env override arrives as a STRING. When the config file's default for that
// key is a JSON boolean, a string override used to replace it verbatim, so
// RFCX_COREAPIENABLED=false set `coreAPIEnabled` to the string "false", which
// is TRUTHY: every `if (rfcxConfig.coreAPIEnabled)` still fired (measured
// 2026-09-27 on the demo sandbox; rfcx-local FINDING-2026-09-27-legacy-env-bool-
// string-audit.md). Coerce ONLY for boolean-default keys, and only the
// unambiguous spellings; anything else is kept as the raw string (unchanged
// behaviour) with a one-time warning, so a typo is visible but never silently
// flipped. Non-boolean defaults (strings, numbers, objects) are untouched.
var TRUE_STRINGS = ['true', '1', 'yes', 'on'];
var FALSE_STRINGS = ['false', '0', 'no', 'off'];
var warned = {};
function coerceEnvOverride(fileDefault, raw, envVarName) {
    if (typeof fileDefault !== 'boolean') { return raw; }
    var v = String(raw).trim().toLowerCase();
    if (TRUE_STRINGS.indexOf(v) !== -1) { return true; }
    if (FALSE_STRINGS.indexOf(v) !== -1) { return false; }
    if (!warned[envVarName]) {
        warned[envVarName] = true;
        console.warn('config: ' + envVarName + '=' + JSON.stringify(raw) +
            ' is not a recognised boolean (true/false/1/0/yes/no/on/off); keeping the raw string');
    }
    return raw;
}

module.exports = function(config_file){
    if(typeof cache[config_file] == 'undefined') {
        var files = [
            path.join(config_folder, config_file + '.local.json'),
            path.join(config_folder, config_file + '.json'      )
        ];
        
        for(var i=0, e=files.length; i < e; ++i){
            var filename = files[i];
            if(fs.existsSync(filename)) {
                var contents = fs.readFileSync(filename);
                debug("Parsing config " + config_file + " (file : " + filename + ")");
                cache[config_file] = JSON.parse(contents);
                break;
            }
        }
    }
    // Enable config to be pulled in from environment variables
    Object.keys(cache[config_file]).forEach(key => {
        const envVarName = `${config_file.toUpperCase()}_${key.toUpperCase()}`;
        if (process.env[envVarName]) {
            cache[config_file][key] = coerceEnvOverride(cache[config_file][key], process.env[envVarName], envVarName);
        }
    })
    
    return cache[config_file];
};
module.exports._coerceEnvOverride = coerceEnvOverride; // exported for test/config-env-bool.test.js
