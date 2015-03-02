function mock_fs_fd(entry){
    this.entry = entry;
    this.data = entry.data || ''; 
}

mock_fs_fd.prototype = {
    read : function(buffer, offset, length, position){
        var data = this.data, len = data.length;
        if(position === null){
            position = this.position;
            this.position += length;
        }
        var startp = position, endp = position + length;
        var bytes_read = 0;
        if(endp > len){
            endp = len;
        }
        var pp='';
        for(var p=startp, i=offset; p < endp; ++i, ++p){
            pp+=i+',';
            buffer.writeUInt8(data.charCodeAt(p), i);
            ++bytes_read;
        }
        return bytes_read;
    }
};

module.exports = {
    stat : function (file, callback){
        var entry = this.__files__[file];
        if(entry && entry.exists !== false){
            setImmediate(callback, null, entry);
        } else {
            setImmediate(callback, new Error('ENOENT'));
        }
    },
    unlink : function (file, callback){
        delete this.__files__[file];
        setImmediate(callback);
    },
    writeFile : function (filename, data, options, callback){
        if(options instanceof Function){
            callback = options;
            options = undefined;
        }
        var entry = this.__files__[filename];
        if(!entry || entry.can_write !== false){
            this.__files__[filename] = {path:filename, atime:new Date(), data:data};
            setImmediate(callback);
        } else {
            setImmediate(callback, new Error('Error cant mock file entry set to cant write'));
        }
    },
    read: function(fd, buffer, offset, length, position, callback){
        if(!(fd instanceof mock_fs_fd)){
            setImmediate(callback, new Error("Invalid file descriptor, cannot read"));
        } else if(!(buffer instanceof Buffer)){
            setImmediate(callback, new Error("Invalid buffer, cannot read"));
        } else {
            setImmediate(callback, null, fd.read(buffer, offset, length, position), buffer);
        }
    },
    readFileSync : function(filename){
        var entry = this.__files__[filename];
        return (entry && entry.data) || '';
    },
    existsSync : function(filename){
        var entry = this.__files__[file];
        return entry && entry.exists !== false;        
    },
    open : function(filename, flags, mode, callback){
        if(mode instanceof Function && callback === undefined){
            callback = mode;
            mode = undefined;
        }
        var options={};
        switch(flags){
            case 'r'   : options={read:true, must_exist:true}; break;
            case 'r+'  : options={read:true, write:true, must_exist:true}; break;
            case 'rs'  : options={read:true, must_exist:true, bypass_cache:true}; break;
            case 'rs+' : options={read:true, write:true, must_exist:true, bypass_cache:true}; break;
            case 'w'   : options={write:true, truncate:true}; break;
            case 'wx'  : options={write:true, truncate:true, must_not_exist:true}; break;
            case 'w+'  : options={read:true, write:true, truncate:true}; break;
            case 'wx+' : options={read:true, write:true, truncate:true, must_not_exist:true}; break;
            case 'a'   : options={write:true}; break;
            case 'ax'  : options={write:true, must_not_exist:true}; break;
            case 'a+'  : options={read:true, write:true}; break;
            case 'ax+' : options={read:true, write:true, must_not_exist:true}; break;
        }
        var entry = this.__files__[filename];
        if(options.must_exist && !entry){
            setImmediate(callback, new Error('ENOENT : file does not exist.'));
        } else if(options.must_not_exist && entry){
            setImmediate(callback, new Error('EEXIST : file already exists.'));
        } else {
            if((entry && options.truncate) || !entry){
                this.__files__[filename] = {path:filename, atime:new Date(), data:''};
            }
            var fd = new mock_fs_fd(this.__files__[filename]);
            setImmediate(callback, null, fd);
        }
    },
    close : function(fd, callback){
        if(fd instanceof mock_fs_fd && fd.entry){
            fd.entry.data = fd.data;
            setImmediate(callback);
        } else {
            setImmediate(callback, new Error("Not a valid file descriptor, cannot close."));
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
            setImmediate(callback, new Error("ENOTFOUND folder " + path));
        } else {
            setImmediate(callback, null, subfiles);                    
        }
    },
    
    watch: function(path, options, callback){
        if(!this.__watchers__){
            this.__watchers__={};
        }
        if(!this.__watchers__[path]){
            this.__watchers__[path] == [];
        }
        this.__watchers__[path].push(callback);
    },
    __watch_notify__: function(path, event, filename){
        var list = this.__watchers__ && this.__watchers__[path];
        if(list){
            for(var i=0, e=list.length; i<e; ++i){
                list[i](event, filename)
            }
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
