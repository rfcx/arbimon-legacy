var should = require('chai').should();
var async = require('async');
var rewire = require('rewire');
var tmpfilecache = rewire('../../utils/tmpfilecache');

var mock_config = {
    tmpfilecache : {
        path : '/!!MOCKPATH!!/',
        maxObjectLifetime : 1000,
        cleanupInterval : 500
    }
};
var mocks = {
    tmpfilecache : {
        fs : {
            stat : function (file, callback){
                if(this.__files__[file]){
                    callback(null, this.__files__[file]);
                } else {
                    callback(new Error('ENOENT'));
                }
            },
            unlink : function mock_fs_unlink(file, callback){
                delete this.__files__[file];
                callback();
            },
            writeFile : function (){},
            readdir : function (){},
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
        },
        config : function (key){
            return mock_config[key];
        }
    }
};

tmpfilecache.__set__(mocks.tmpfilecache);


describe('tmpfilecache', function(){
    describe('#hash_key()', function(){
        it('Should return a sha256 hash of a given path, escaping the file extension.', function(){
            tmpfilecache.hash_key('this/is/a/test.txt').should.equal('7857951942d9f9d5ec2c0ba33dd9c2e3a0506c8f839dfb731607b5e8d155b7f7.txt');
            tmpfilecache.hash_key('this/is/an/other/test.txt').should.equal('c7a7c625af1ad53348d7b634ca63fca1a1600d6a2a45ac805f3444785e5a2955.txt');
            tmpfilecache.hash_key('this/is/an/other/test.bmp').should.equal('c7a7c625af1ad53348d7b634ca63fca1a1600d6a2a45ac805f3444785e5a2955.bmp');
            tmpfilecache.hash_key('').should.equal('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        });
        it('Should allow for multiple file extensions.', function(){
            tmpfilecache.hash_key('this/is/a/test.txt.bmp').should.equal('7857951942d9f9d5ec2c0ba33dd9c2e3a0506c8f839dfb731607b5e8d155b7f7.txt.bmp');
            tmpfilecache.hash_key('this/is/an/other/test.txt.wav').should.equal('c7a7c625af1ad53348d7b634ca63fca1a1600d6a2a45ac805f3444785e5a2955.txt.wav');
            tmpfilecache.hash_key('this/is/an/other/test.bmp.scaled-25.png').should.equal('c7a7c625af1ad53348d7b634ca63fca1a1600d6a2a45ac805f3444785e5a2955.bmp.scaled-25.png');
            tmpfilecache.hash_key('a.txt.bmp.wav.zip.tar.gz.7z.exe.qt.prog.data.txt').should.equal('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb.txt.bmp.wav.zip.tar.gz.7z.exe.qt.prog.data.txt');
        });
        it('Should work on stringified values.', function(){
            [
                null, undefined, 0, {}, new Date(), [1,2,3], /qserty/, 1.2e3, Infinity
            ].forEach(function(v){
                tmpfilecache.hash_key(v).should.equal(tmpfilecache.hash_key(''+v));
            });
        });
    });
    describe('#key2File()', function(){
        it('Should convert a key to a file path.', function(){
            tmpfilecache.key2File('this/is/a/test.txt.bmp').should.equal(
                mock_config.tmpfilecache.path + tmpfilecache.hash_key('this/is/a/test.txt.bmp')
            );
        });
    });
    describe('#checkValidity()', function(){
        it('Should return callback with existing valid files.', function(done){
            mocks.tmpfilecache.fs.__set_files__([
                {path: 'this/is/a/test.txt.bmp', atime:new Date(new Date().getTime() - 100)}
            ], {prefix: mock_config.tmpfilecache.path, pathmap:tmpfilecache.hash_key.bind(tmpfilecache)});
            
            tmpfilecache.checkValidity(tmpfilecache.key2File('this/is/a/test.txt.bmp'), function(err, stat){
                should.not.exist(err);
                should.exist(stat);
                should.exist(stat.path)
                stat.path.should.equal(tmpfilecache.key2File('this/is/a/test.txt.bmp'));
                stat.should.have.ownProperty('stat');
                done();
            });
        });
    });
    // define('#get()', function(){});
    // define('#put()', function(){});
    // define('#fetch()', function(){});
    // define('#cleanup()', function(){});
});
