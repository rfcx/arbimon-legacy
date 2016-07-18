var fs = require('fs');
var Buffer = require('buffer').Buffer;
var bufferpack = require('bufferpack');

var file = function(filename, mode, callback){
    fs.open(filename, mode, (function(err, fd){
        this.fd = fd;
        this.position = 0;
        if(err){
            callback(err);
            return;
        }
        fs.stat(filename, (function(err2, stat){
            if(err2){
                callback(err2);
            } else {
                this.size = stat.size;
                callback(null, fd);
            }
        }).bind(this));
    }).bind(this));
};

var struct = {
    // ensure : function(buffer, size){
    //     if(!buffer || buffer.length < size){
    //         return new buffer.Buffer(size);
    //     } else {
    //         return buffer;
    //     }
    // },

    readLEUint : function(buffer, offset, count){
        var v=0;
        for(var i=0, e=count - 1; i<=e; ++i){
            v += buffer.readUInt8(offset + i) << (8*(i));
        }
        return v;
    },
    readBEUint : function(buffer, offset, count){
        var v=0;
        for(var i=0, e=count - 1; i<=e; ++i){
            var b = buffer.readUInt8(offset + i);
            v += b << (8*(e - i));
        }
        return v;
    },
    unpack : function(fmtstr, buffer, bufpos){
        var bufdelta, upc;
        if(!/Q|U/.test(fmtstr)){
            return bufferpack.unpack(fmtstr, buffer, bufpos);
        } else {
            var ech = /<|>|!/.test(fmtstr[0]) ? fmtstr[0] : '';
            var is_be = (ech !== '<');
            var readfn = is_be ? this.readBEUint : this.readLEUint;
            var parts = [], last = ech.length, times;
            fmtstr.replace(/((\d*)(U|Q)|$)/g, function(_0, _1, _2, _3, i, st){
                if(i > last){
                    var subfmtstr = ech + fmtstr.substr(last, i-last);
                    upc = bufferpack.unpack(subfmtstr, buffer, bufpos);
                    bufdelta = bufferpack.calcLength(subfmtstr, upc);
                    bufpos += bufdelta;
                    parts.push.apply(parts, upc);
                }
                times = 1;
                bufdelta = 1;
                if(_3 !== undefined){
                    if(_3 == 'Q'){
                        times = (_2 | 0) || 1;
                        bufdelta = 8;
                    } else /* if(_3 == 'U') */ {
                        bufdelta = (_2 | 0) || 1;
                    }
                    for(var ti=0, te=times; ti < te; ++ti){
                        var v = readfn(buffer, bufpos, bufdelta);
                        parts.push(v);
                    }
                    bufpos += bufdelta;
                    last = i + _0.length;
                }
                return _0;
            });
            return parts;
        }
    }
};

file.prototype = {
    close : function(callback){
        if(!this.fd){
            callback();
        } else {
            fs.close(this.fd, callback);
        }
    },
    
    ensure_capacity: function(size){
        if(!this.buffer || this.buffer.length < size){
            this.buffer = new Buffer(size);
        }
    },
        
    read: function(bytes, callback){
        this.ensure_capacity(bytes);
        if(this.position >= this.size){
            callback(new Error("EOF"));
            return;
        }
        fs.read(this.fd, this.buffer, 0, bytes, this.position, (function(err, bytesread, buffer){
            var lp = this.position;
            this.position += bytesread;
            if(err){ callback(err); return; }
            callback(null, bytesread, buffer);
        }).bind(this));
    },
    
    unpack: function(fmtstr, bytestoread, callback){
        this.read(bytestoread, function(err, bytesread, buffer){
            if(err){ callback(err); return; }
            var upc = struct.unpack(fmtstr, buffer, 0);
            if(upc === undefined){
                callback(new Error("Invalid format string"));
                return;
            }
            callback(null, upc);
        });
    },
      
    tell: function(p){
        return this.position;
    },
    
    seek: function(p){
        this.position = p;
    }
};


module.exports = file;
