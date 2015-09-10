/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var rewire = require('rewire');
var tmpfilecache = rewire('../../utils/tmpfilecache');
var mock_fs = require('../mock_tools/mock_fs');


var mock_config = {
    tmpfilecache : {
        path : '/DUMMYPATH/',
        maxObjectLifetime : 1000,
        cleanupInterval : 500
    }
};
var mocks = {
    tmpfilecache : {
        fs : mock_fs,
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
        beforeEach(function(){
            mocks.tmpfilecache.fs.__set_files__([
                {path: 'this/is/a/test.txt.bmp', atime:new Date(new Date().getTime() - 100)},
                {path: 'this/is/a/barely/valid/test.txt.bmp', atime:new Date(new Date().getTime() - mock_config.tmpfilecache.maxObjectLifetime + 1)},
                {path: 'this/is/a/recently/invalid/test.txt.bmp', atime:new Date(new Date().getTime() - mock_config.tmpfilecache.maxObjectLifetime)},
                {path: 'this/is/a/very/old/file.txt', atime:new Date(0)}
            ], {prefix: mock_config.tmpfilecache.path, pathmap:tmpfilecache.hash_key.bind(tmpfilecache)});
            sinon.spy(mocks.tmpfilecache.fs, 'unlink');
        });
        afterEach(function(){
            mocks.tmpfilecache.fs.unlink.restore();
        });
        it('Should callback with proper arguments for existing valid files', function(done){
            tmpfilecache.checkValidity(tmpfilecache.key2File('this/is/a/test.txt.bmp'), function(err, stat){
                should.not.exist(err);
                should.exist(stat);
                should.exist(stat.path);
                should.exist(stat.stat);
                stat.path.should.equal(tmpfilecache.key2File('this/is/a/test.txt.bmp'));
                done();
            });
        });
        it('Should callback with error for non-existing files', function(done){
            tmpfilecache.checkValidity(tmpfilecache.key2File('this/file/does/not/exists.txt'), function(err, stat){
                should.exist(err);
                should.not.exist(stat);
                done();
            });
        });
        it('Should callback with null for existing very old files, and delete them', function(done){
            tmpfilecache.checkValidity(tmpfilecache.key2File('this/is/a/very/old/file.txt'), function(err, stat){
                should.not.exist(err);
                should.not.exist(stat);
                mocks.tmpfilecache.fs.unlink.calledOnce.should.be.true;
                done();
            });
        });
    });
    
    describe('#get()', function(){
        beforeEach(function(){
            mocks.tmpfilecache.fs.__set_files__([
                {path: 'this/is/a/test.txt.bmp', atime:new Date(new Date().getTime() - 100)},
                {path: 'this/is/a/very/old/file.txt', atime:new Date(0)}
            ], {prefix: mock_config.tmpfilecache.path, pathmap:tmpfilecache.hash_key.bind(tmpfilecache)});
            sinon.spy(mocks.tmpfilecache.fs, 'unlink');
        });
        afterEach(function(){
            mocks.tmpfilecache.fs.unlink.restore();
        });
        it('Should callback with proper arguments for existing valid keys', function(done){
            tmpfilecache.get('this/is/a/test.txt.bmp', function(err, stat){
                should.not.exist(err);
                should.exist(stat);
                should.exist(stat.path);
                should.exist(stat.stat);
                stat.path.should.equal(tmpfilecache.key2File('this/is/a/test.txt.bmp'));
                done();
            });
        });
        it('Should callback with error for non-existing files', function(done){
            tmpfilecache.get('this/file/does/not/exists.txt', function(err, stat){
                should.exist(err);
                should.not.exist(stat);
                done();
            });
        });
        it('Should callback with null for existing very old files, and delete them', function(done){
            tmpfilecache.get('this/is/a/very/old/file.txt', function(err, stat){
                should.not.exist(err);
                should.not.exist(stat);
                mocks.tmpfilecache.fs.unlink.calledOnce.should.be.true;
                done();
            });
        });
    });
    
    describe('#put()', function(){
        beforeEach(function(){
            mocks.tmpfilecache.fs.__set_files__([
                {path: 'unwritable/file.txt', exists:false, can_write:false}
            ], {prefix: mock_config.tmpfilecache.path, pathmap:tmpfilecache.hash_key.bind(tmpfilecache)});
            sinon.spy(mocks.tmpfilecache.fs, 'writeFile');
        });
        afterEach(function(){
            mocks.tmpfilecache.fs.writeFile.restore();
        });
        it('Should callback with proper arguments for existing valid keys', function(done){
            tmpfilecache.put('write/this/file.txt', "data", function(err, stat){
                should.not.exist(err);
                should.exist(stat);
                should.exist(stat.path);
                stat.path.should.equal(tmpfilecache.key2File('write/this/file.txt'));
                mocks.tmpfilecache.fs.writeFile.calledOnce.should.be.true;
                should.exist(mocks.tmpfilecache.fs.__files__[stat.path]);
                done();
            });
        });
        it('Should callback with error for non-writable files', function(done){
            tmpfilecache.put('unwritable/file.txt', "data", function(err, stat){
                var filepath=tmpfilecache.key2File('unwritable/file.txt');
                should.exist(err);
                should.not.exist(stat);
                mocks.tmpfilecache.fs.writeFile.calledOnce.should.be.true;
                should.exist(mocks.tmpfilecache.fs.__files__[filepath]);
                mocks.tmpfilecache.fs.__files__[filepath].exists.should.be.false;
                done();
            });
        });
    });
    
    describe('#fetch()', function(){
        beforeEach(function(){
            mocks.tmpfilecache.fs.__set_files__(
                [
                    {
                        path: 'this/is/a/test.txt.bmp', 
                        atime: new Date(new Date().getTime() - 100)
                    }
                ], 
                {
                    prefix: mock_config.tmpfilecache.path, 
                    pathmap:tmpfilecache.hash_key.bind(tmpfilecache)
                }
            );
            
            sinon.spy(mocks.tmpfilecache.fs, 'writeFile');
        });
        
        afterEach(function(){
            mocks.tmpfilecache.fs.writeFile.restore();
        });
        
        it('Should call the results callback without calling on cache_miss first for existing valid keys', function(done){
            tmpfilecache.fetch('this/is/a/test.txt.bmp', function(cache_miss){
                    done(new Error("cache_miss callback called"));
                },
                function(err, stat){
                    should.not.exist(err);
                    should.exist(stat);
                    should.exist(stat.path);
                    stat.path.should.equal(tmpfilecache.key2File('this/is/a/test.txt.bmp'));
                    done();
                }
            );
        });
        
        it('Should call the cache_miss callback, write the file, and call the results callback for invalid keys and using cache_miss.set_file_data', function(done){
            tmpfilecache.fetch(
                'non/existent/file.txt', 
                function(cache_miss) {
                    cache_miss.set_file_data("new file data");
                }, 
                function(err, stat) {
                    should.not.exist(err, 'Error should not exist');
                    should.exist(stat);
                    should.exist(stat.path);
                    stat.path.should.equal(tmpfilecache.key2File('non/existent/file.txt'));
                    should.exist(mocks.tmpfilecache.fs.__files__[stat.path]);
                    mocks.tmpfilecache.fs.writeFile.calledOnce.should.be.true;
                    mocks.tmpfilecache.fs.__files__[stat.path].data.should.equal('new file data');
                    done();
                }
            );
        });
        
        it('Should call the cache_miss callback, and call the results callback with the new file for invalid keys and using cache_miss.retry_get, having added the file manually', function(done){
            tmpfilecache.fetch('non/existent/file.txt', function(cache_miss){
                mocks.tmpfilecache.fs.writeFile(cache_miss.file, "new file data", function(err){
                    if(err){
                        done(new Error("Could not create "+cache_miss.file+" in mock fs for some reason."));
                    } else {
                        cache_miss.retry_get();                        
                    }
                });
            }, function(err, stat){
                should.not.exist(err);
                should.exist(stat);
                should.exist(stat.path);
                stat.path.should.equal(tmpfilecache.key2File('non/existent/file.txt'));
                mocks.tmpfilecache.fs.writeFile.calledOnce.should.be.true;
                should.exist(mocks.tmpfilecache.fs.__files__[stat.path]);
                mocks.tmpfilecache.fs.__files__[stat.path].data.should.equal('new file data');
                done();
            });
        });
        it('Should call the cache_miss callback, and call the results callback with an error for invalid keys and using cache_miss.retry_get, not having added the file at all.', function(done){
            tmpfilecache.fetch('non/existent/file.txt', function(cache_miss){
                cache_miss.retry_get();                        
            }, function(err, stat){
                should.exist(err);
                should.not.exist(stat);
                done();
            });
        });
    });
    describe('#cleanup()', function(){
        var setCleanupTimeout_stub=null;
        beforeEach(function(){
            mocks.tmpfilecache.fs.__set_files__([
                {path: 'this/is/a/test.txt.bmp', atime:new Date()},
                {path: 'this/is/a/very/old/file.txt', atime:new Date(0)}
            ], {prefix: mock_config.tmpfilecache.path, pathmap:tmpfilecache.hash_key.bind(tmpfilecache)});
            mocks.tmpfilecache.fs.__set_files__([
                {path: '.gitignore', atime:new Date()}
            ], {prefix: mock_config.tmpfilecache.path, keep_existing: true});
            sinon.stub(tmpfilecache, 'setCleanupTimeout', function(){
                if(setCleanupTimeout_stub){
                    setCleanupTimeout_stub();
                }
            });
            sinon.spy(mocks.tmpfilecache.fs, 'unlink');
        });
        afterEach(function(){
            mocks.tmpfilecache.fs.unlink.restore();
            tmpfilecache.setCleanupTimeout.restore();
        });
        it('Should clean invalid files and set a Timeout.', function(done){
            setCleanupTimeout_stub =  function(){
                mocks.tmpfilecache.fs.unlink.callCount.should.equal(1);
                mocks.tmpfilecache.fs.unlink.calledWith(tmpfilecache.key2File('this/is/a/very/old/file.txt'));
                done();
            };
            tmpfilecache.cleanup();
        });
    });
    describe('#setCleanupTimeout()', function(){
        var cleanup_stub, clock;
        beforeEach(function(){
            clock = sinon.useFakeTimers();
            sinon.stub(tmpfilecache, 'cleanup', function(){
                if(cleanup_stub){
                    cleanup_stub();
                }
            });
        });
        afterEach(function(){
            tmpfilecache.cleanup.restore();
            clock.restore();
        });
        it('Should set a timer and call cleanup after `delay` milliseconds.', function(done){
            var cleanupInterval = mock_config.tmpfilecache.cleanupInterval;            
            cleanup_stub = function(){
                done(new Error("cleanup called before the "+cleanupInterval+" millisecond delay."));
            };
            tmpfilecache.setCleanupTimeout();
            should.exist(tmpfilecache.cleanupTimeout);
            clock.tick(cleanupInterval - 1);
            cleanup_stub = function(){
                done();
            };
            clock.tick(1);
        });
        it('Should not set a timer if one is already set.', function(done){
            var cleanupInterval = mock_config.tmpfilecache.cleanupInterval;
            cleanup_stub = function(){
                done(new Error("cleanup should not have been called."));
            };
            tmpfilecache.cleanupTimeout = setTimeout(done, cleanupInterval + 1000);
            tmpfilecache.setCleanupTimeout();
            should.exist(tmpfilecache.cleanupTimeout);
            clock.tick(cleanupInterval);
            clock.tick(1000);
        });
    });

});
