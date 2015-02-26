module.exports = {
    stat : function (file, callback){
        var entry = this.__files__[file];
        if(entry && entry.exists !== false){
            callback(null, entry);
        } else {
            callback(new Error('ENOENT'));
        }
    },
    unlink : function (file, callback){
        delete this.__files__[file];
        callback();
    },
    writeFile : function (filename, data, options, callback){
        if(options instanceof Function){
            callback = options;
            options = undefined;
        }
        var entry = this.__files__[filename];
        if(!entry || entry.can_write !== false){
            this.__files__[filename] = {path:filename, atime:new Date(), data:data};
            callback();
        } else {
            callback(new Error('Error cant mock file entry set to cant write'));
        }
    },
    readdir : function (path, callback){
        var files = this.__files__, subfiles=[];
        var offset = path[path.length-1] == '/' ? 0 : 1;
        var found_dir=false;
        for(var filepath in files){
            var pathidx = filepath.indexOf(path);
            if(pathidx === 0){
                if(filepath.length > path.length + offset){
                    var subpath = filepath.substring(path.length + offset);
                    subfiles.push(subpath);
                } else {
                    found_dir = true;
                }
            }
        }
        if(!subfiles.length && !found_dir){
            callback(new Error("ENOTFOUND folder " + path));
        } else {
            callback(null, subfiles);                    
        }
    },
    __files__:{},
    __set_files__: function(files, options){
        if(!(options && options.keep_existing === true)){
            this.__files__={};
        }
        var __files__ = this.__files__;
        var prefix = (options && options.prefix) || '';
        var pathmap = (options && options.pathmap) || function(x){return x;};
        files.forEach(function(f){
            __files__[prefix + pathmap(f.path)] = f;
        });
    }
};
