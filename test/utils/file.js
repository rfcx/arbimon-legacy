/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var rewire = require('rewire');
var file = rewire('../../utils/file');
var mock_fs = require('../mock_tools/mock_fs');

file.__set__({
    fs : mock_fs
});


describe('file', function(){
    beforeEach(function(done){
        mock_fs.__files__ = {};
        mock_fs.writeFile('test.txt', "jabberwockykonInterpassivc12345754,.#412", {}, done);
    });
    describe('new', function(){
        beforeEach(function(){
            sinon.spy(mock_fs, 'open');
        });
        afterEach(function(){
            mock_fs.open.restore();
        });
        it('Should return error when opening a non-existing file for read', function(done){
            var f = new file('does-not-exist.txt', 'r', function(err, fd){
                should.exist(err);
                should.not.exist(fd);
                mock_fs.open.calledOnce.should.be.true;
                done();
            });
        });
        it('Should open an existing file for read', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                should.not.exist(err);
                should.exist(fd);
                mock_fs.open.calledOnce.should.be.true;
                done();
            });
        });
    });
    describe('#close()', function(){
        beforeEach(function(){
            sinon.spy(mock_fs, 'close');
        });
        afterEach(function(){
            mock_fs.close.restore();
        });
        it('Should not attempt to close an unopened file, instead it should silently return', function(done){
            var f = new file('does-not-exists.txt', 'r', function(err, fd){
                f.close(function(){
                    arguments.length.should.equal(0);
                    mock_fs.close.called.should.be.false;
                    done();
                });
            });
        });
        it('Should close an opened file', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.close(function(){
                    arguments.length.should.equal(0);
                    mock_fs.close.calledOnce.should.be.true;
                    done();
                });
            });
        });
    });
    describe('#ensure_capacity()', function(){
        it('Should grow the internal buffer to accomodate a given size.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                should.not.exist(f.buffer);
                f.ensure_capacity(10);
                should.exist(f.buffer);
                f.buffer.length.should.equal(10);
                f.ensure_capacity(5);
                f.buffer.length.should.equal(10);
                f.ensure_capacity(500);
                f.buffer.length.should.equal(500);
                done();
            });
        });
    });
    describe('#read()', function(){
        it('Should return a buffer with the requested count of bytes, moving the position forward.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                f.read(10, function(err, bytes_read, buffer){
                    should.not.exist(err);
                    bytes_read.should.equal(10);
                    for(var d=f.fd.data, i=0, e=10; i < e; ++i){
                        buffer.readUInt8(i).should.equal(d.charCodeAt(i));
                    }
                    done();
                });
            });
        });
        it('Should forward any encountered read errors.', function(done){
            var f = new file('does-not-exist.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                should.not.exist(f.fd);
                f.read(10, function(err, bytes_read, buffer){
                    should.exist(err);
                    should.not.exist(bytes_read);
                    should.not.exist(buffer);
                    done();
                });
            });
        });
    });
    describe('#unpack()', function(){
        it('Should return a structure of the specified format, reading the unoacked values from the file.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                f.unpack(">hhhh", 8, function(err, upc){
                    should.not.exist(err);
                    should.exist(upc);
                    upc.should.deep.equal([ 27233, 25186, 25970, 30575 ]);
                    done();
                });
            });
        });
        it('Should accept Q to read 64-bit integers.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                f.unpack(">QhQ", 23, function(err, upc){
                    should.not.exist(err);
                    should.exist(upc);
                    upc.should.deep.equal([ 3486767569, 25451, 3269059539]);
                    done();
                });
            });
        });
        it('Should accept U to read arbitrary byte integers.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                f.unpack("2UUUhh", 8, function(err, upc){
                    should.not.exist(err);
                    should.exist(upc);
                    upc.should.deep.equal([ 27233, 98, 98, 25970, 30575 ]);
                    done();
                });
            });
        });
        it('Should read U and Q in big endian and in little endian.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                f.unpack(">Q2U", 10, function(err, upc){
                    should.not.exist(err);
                    should.exist(upc);
                    upc.should.deep.equal([ 3486767569, 25451 ]);
                    f.unpack("<Q2U", 10, function(err, upc){
                        should.not.exist(err);
                        should.exist(upc);
                        upc.should.deep.equal([ 3554924994, 28786 ]);
                        done();
                    });
                });
            });
        });
        it('Should fail on malformed format strings.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                f.unpack(">hhhh<:-) this string is invalid!!!", 8, function(err, upc){
                    should.exist(err);
                    should.not.exist(upc);
                    done();
                });
            });
        });
        it('Should fail on invalid files.', function(done){
            var f = new file('does-not-exist.txt', 'r', function(err, fd){
                f.position.should.equal(0);
                should.not.exist(f.fd);
                f.unpack("", 10, function(err, upc){
                    should.exist(err);
                    should.not.exist(upc);
                    done();
                });
            });
        });
    });
    describe('#tell()', function(){
        it('Should indicate the current reading position.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.tell().should.equal(0);
                f.read(10, function(){
                    f.tell().should.equal(10);
                    done();
                });
            });
        });
    });
    describe('#seek()', function(){
        it('Should set the position to a given value.', function(done){
            var f = new file('test.txt', 'r', function(err, fd){
                f.tell().should.equal(0);
                f.read(10, function(){
                    f.tell().should.equal(10);
                    f.seek(0);
                    f.tell().should.equal(0);
                    f.seek(15);
                    f.tell().should.equal(15);
                    done();
                });
            });
        });
    });
});
