var fs = require('fs');
var Buffer = require('buffer').Buffer;
var bufferpack = require('bufferpack');

var file = function(filename, mode, callback){
    fs.open(filename, mode, (function(err, fd){
        this.fd = fd;
        this.position = 0;
        callback(err, fd);
    }).bind(this));
};

var struct = {
    ensure : function(buffer, size){
        if(!buffer || buffer.length < size){
            return new buffer.Buffer(size);
        } else {
            return buffer;
        }
    },

    readLEUint : function(buffer, offset, count){
        var v=0;
        for(var i=0, e=count - 1; i<=e; ++i){
            v += buffer.readUint8(offset + i) << (8*(i));
        }
        return v;
    },
    readBEUint : function(buffer, offset, count){
        var v=0;
        for(var i=0, e=count - 1; i<=e; ++i){
            v += buffer.readUint8(offset + i) << (8*(e - i));
        }
        return v;
    },
    unpack : function(fmtstr, buffer, bufpos){
        if(!/Q/.test(fmtstr)){
            return bufferpack.unpack(fmtstr, buffer, bufpos);
        } else {
            var is_be = (fmtstr[0] !== '<');
            var readfn = is_be ? this.readBEUint : this.readLEUint;
            var parts = [], last = 0;
            fmtstr.replace(/((\d*)(U|Q)|$)/g, function(_0, _1, _2, _3, i, st){
                if(i > last){
                    var upc = bufferpack.unpack(fmtstr, buffer, bufpos);
                    bufpos += bufferpack.calcLength(fmtstr, upc);
                    parts.push.apply(parts, upc);
                }
                var times = 1, bufdelta = 1;
                switch(_3){
                    case 'Q':
                        times = (_2 | 0) || 1;
                        bufdelta = 8;
                    break;
                    case 'U':
                        bufdelta = (_2 | 0) || 1;
                    break;
                }
                parts.push(readfn(buffer, bufpos, bufdelta));
                bufpos += bufdelta;
                last = i + _0.length;
                return _0;
            });
            return parts;
        }
    }
};

file.prototype = {
    ensure_capacity: function(size){
        if(!this.buffer || this.buffer.length < size){
            this.buffer = new Buffer(size);
        }
    },
        
    read: function(bytes, callback){
        this.ensure_capacity(bytes);
        fs.read(this.fd, this.buffer, 0, bytes, this.position, (function(err, bytesread, buffer){
            this.position += bytesread;
            if(err){ callback(err); return; }
            callback(null, bytesread, buffer);
        }).bind(this));
    },
    
    unpack: function(fmtstr, bytestoread, callback){
        this.read(bytestoread, function(err, bytesread, buffer){
            if(err){ callback(err); return; }
            var upc = struct_unpack(fmtstr, buffer, 0);
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
