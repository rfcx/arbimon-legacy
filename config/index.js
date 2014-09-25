/**
 * configuration module.
 */
var fs   = require('fs')
  , path = require('path')

// config folder 
var config_folder = __dirname;
// cache
var cache = {};

console.log("watching config folder in :", config_folder);
fs.watch(config_folder, {persistent:false}, function(event, filename){
    var filename_parts = /^(.*)(\.local)?(\.json)$/.exec(filename);
    if(filename_parts && event == 'change') {
        console.log("Config " + filename_parts[1] + " changed. (file :" + filename + ")");
        delete cache[filename_parts[1]];
    }
})

module.exports = function(config_file){
    if(typeof cache[config_file] == 'undefined') {
        var files = [
            path.join(config_folder, file + '.local.json'),
            path.join(config_folder, file + '.json'      )
        ];
        
        for(var i=0, e=files.length; i < e; ++i){
            var filename = files[i];
            if(fs.existsSync(filename)) {
                cache[config_file] = JSON.parse(fs.readFileSync(filename));
                break;
            }
        }
    }
    
    return cache[config_file];
}