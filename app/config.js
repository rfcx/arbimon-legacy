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

    Object.keys(cache[config_file]).forEach(key => {
        const envVarName = `${config_file.toUpperCase()}_${key.toUpperCase()}`;
        if (process.env[envVarName]) {
            cache[config_file][key] = process.env[envVarName];
        }
    })
    
    return cache[config_file];
};
