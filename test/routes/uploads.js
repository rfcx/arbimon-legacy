/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), 
    should = chai.should(), 
    expect = chai.expect;
var sinon = require('sinon');
var rewire = require('rewire');

var uploadsRouter = rewire('../../app/routes/uploads');

var TestResponse = function(done) {
    var self = this;
    
    self._responseMethods = [
        "redirect",
        "render",
        "send",
        "status",
        "sendStatus",
        "json"
    ];
    
    self.expect = {};
    self.expectations = {};
    
    self._responseMethods.forEach(function(fn){
        if(fn === "status") {
            self[fn] = sinon.stub();
            self[fn].returnsThis();
        }
        else {
            self[fn]  = sinon.spy(function() {
                if(done) done();
            });
        }
        
        self.expect[fn] = function() {
            self.expectations[fn] = Array.prototype.slice.call(arguments);
            
            return self.expect;
        };
    });
    
    self.verify = function() {
        var self = this;
        self.actual = {};
        
        self._responseMethods.forEach(function(fn){
            if(self.expectations[fn]) {
                expect(self[fn].callCount).to.equal(1, 'req.'+fn+'() callCount');
                expect(self[fn].firstCall.args).to.deep.equal(self.expectations[fn]);
            }
            else {
                var args = self[fn].firstCall && self[fn].firstCall.args;
                expect(self[fn].callCount)
                    .to.equal(0, 'unexpected call to req.'+ fn +'('+ args +')');
            }
        });
    };
};

describe('routes/uploads.js', function(){
    describe('POST /audio', function(){
        var request; 
        var response;
        var next;
        var mock;
        var restoreMocked;
        
        before(function() {
            mock = {
                fs: {},
                model: {},
                audioTools: {},
                tmpFileCache: {},
                uploadQueue: {},
            };
            restoreMocked = uploadsRouter.__set__(mock);
        });
        
        beforeEach(function() {
            response = new TestResponse();
            next = sinon.stub();
        });
        
        after(function() {
            restoreMocked();
        });
        
        describe('authorize', function() {
            var authorize;
            
            before(function() {
                authorize = uploadsRouter.__get__('authorize');
            });
            
            it('should call next() if valid user session with permission to upload', function() {
                request = {
                    session: {
                        loggedIn: true,
                        user: {
                            id: 1
                        }
                    },
                    query: {
                        project: 100,
                        site: 20,
                        nameformat: 'Arbimon'
                    },
                    haveAccess: sinon.stub().returns(true)
                };
                
                authorize(request, response, next);
                
                expect(next.callCount).to.equal(1);
                response.verify();
                
                expect(request.upload).to.deep.equal({
                    userId: request.session.user.id,
                    projectId: request.query.project,
                    siteId: request.query.site,
                    nameFormat: request.query.nameformat,
                });
            });
            
            it('should respond "400 Bad Request" if missing query parameters', function() {
                request = {
                    session: {
                        loggedIn: true,
                        user: {
                            id: 1
                        }
                    },
                    query: {},
                    haveAccess: sinon.stub().returns(true)
                };
                
                authorize(request, response, next);
                
                response.expect.status(400).json({ error: "missing parameters" });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'unexpected call next()');
                
            });
            
            it('should respond "401 Unauthorized" if user session with NO permission to upload', function() {
                request = {
                    session: {
                        loggedIn: true,
                        user: {
                            id: 1
                        }
                    },
                    query: {
                        project: '100',
                        site: '20',
                        nameformat: 'Arbimon'
                    },
                    haveAccess: sinon.stub().returns(false)
                };
                
                authorize(request, response, next);
                
                response.expect.status(401).json({
                    error: "you dont have permission to 'manage project recordings'"
                });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'unexpected call next()');
            });
            
            it('should call next() if valid token', function() {
                request = {
                    token: {
                        project: 10,
                        site: 200,
                    },
                };
                
                authorize(request, response, next);
                
                response.verify({});
                expect(next.callCount).to.equal(1);
                
                expect(request.upload).to.deep.equal({
                    userId: 0,
                    projectId: request.token.project,
                    siteId: request.token.site,
                    nameFormat: 'Arbimon',
                });
            });
            
            it('should respond "401 Unauthorized" if NO valid token and NO user session', function() {
                request = {};
                
                authorize(request, response, next);
                
                expect(next.callCount).to.equal(0, 'unexpected call next()');
                response.expect.sendStatus(401);
                response.verify();
            });
        });
        
        describe('verifySite', function() {
            var verifySite;
            var findById;
            var siteInfo;
            
            before(function() {
                verifySite = uploadsRouter.__get__('verifySite');
            });
            
            beforeEach(function() {
                findById = sinon.stub();
                mock.model.sites = {
                    findById: findById
                };
                
                siteInfo = {
                    token_created_on: 123456,
                    project_id: 100
                };
                
                request = {
                    upload: {
                        userId: 2,
                        projectId: 100,
                        siteId: 20,
                        nameFormat: "Arbimon",
                    },
                    token: {
                        iat: 123456
                    }
                };
            });
            
            after(function() {
                delete mock.model.sites;
            });
            
            it('should call next() if site is valid', function() {
                findById.callsArgWith(1, null, [siteInfo]);
                
                verifySite(request, response, next);
                
                expect(next.callCount).to.equal(1);
                expect(next.firstCall.args).to.deep.equal([]);
                response.verify();
            });
            
            it('should call next(err) if model.sites.findById fails', function() {
                findById.callsArgWith(1, new Error('err'));
                
                verifySite(request, response, next);
                
                expect(next.callCount).to.equal(1);
                expect(next.firstCall.args[0]).to.be.an.instanceof(Error);
                response.verify();
            });
            
            it('should respond "403 Forbidden" if site is not found', function() {
                findById.callsArgWith(1, null, []);
                
                verifySite(request, response, next);
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
                response.expect.status(403).json({ error: "site does not exist" });
                response.verify();
            });
            
            it('should respond "400 Bad Request" if token have been revoked', function() {
                findById.callsArgWith(1, null, [siteInfo]);
                
                request.token.iat = 234567;
                
                verifySite(request, response, next);
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
                response.expect.status(400).json({ error: "can not use revoked token" });
                response.verify();
            });
            
            it('should respond "403 Forbidden" if request projectId dont match the site project', function() {
                findById.callsArgWith(1, null, [siteInfo]);
                
                request.upload.projectId = 200;
                
                verifySite(request, response, next);
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
                response.expect.status(403).json({ error: "site does not belong to project"});
                response.verify();
            });
        });
        
        describe('receiveUpload', function() {
            var receiveUpload;
            var findProjectById;
            var getStorageUsage;
            var projectInfo;
            var metadata;
            var formatParse;
            var restoreFormatParse;
            var key2File;
            var file;
            var recExists;
            var getAudioInfo;
            var audioInfo;
            var splitter;
            var enqueue;
            var fileFormatInfo;
            
            before(function() {
                receiveUpload = uploadsRouter.__get__('receiveUpload');
                restoreFormatParse = uploadsRouter.__set__('formatParse', sinon.stub);
            });
            
            beforeEach(function() {
                projectInfo = { 
                    recording_limit: 100 
                };
                
                findProjectById = sinon.stub();
                findProjectById.callsArgWith(1, null, [projectInfo], []);
                
                getStorageUsage = sinon.stub();
                getStorageUsage.callsArgWith(1, null, [{ min_usage: 5 }], []);
                
                mock.model.projects = {
                    findById: findProjectById,
                    getStorageUsage: getStorageUsage
                };
                
                recExists = sinon.stub();
                recExists.callsArgWith(1, null, false);
                mock.model.recordings = {
                    exists: recExists
                };
                
                fileFormatInfo = {
                    filename: 'default-2014-07-14_08-30',
                    datetime: new Date(2014, 6, 14, 8, 30),
                    filetype: '.wav',
                };
                
                formatParse = sinon.stub();
                restoreFormatParse = uploadsRouter.__set__('formatParse', formatParse);
                formatParse.returns(fileFormatInfo);
                
                mock.tmpFileCache.key2File = key2File = sinon.stub();
                key2File.returns('path2file');
                
                mock.fs.createWriteStream = sinon.stub();
                mock.fs.unlink = sinon.stub();
                
                audioInfo = {
                    channels: 1,
                    duration: 60,
                    sample_rate: 44100,
                    precision: 16,
                    samples: 123456,
                    file_size: 100,
                    bit_rate: '200k',
                    sample_encoding: '16-bit something',
                };
                
                mock.audioTools.info = getAudioInfo = sinon.stub();
                getAudioInfo.callsArgWith(1, 0, audioInfo);
                
                mock.audioTools.splitter = splitter = sinon.stub();
                
                mock.uploadQueue.enqueue = enqueue = sinon.stub();
                enqueue.callsArgWith(1, null);
                
                metadata = JSON.stringify({
                    recorder: 'recorder',
                    sver: 'version',
                    mic: 'microphone',
                });
                
                file = {
                    resume: sinon.stub(),
                    pipe: sinon.stub(),
                };
                
                request = {
                    upload: {
                        projectId: 100,
                        nameFormat: 'Arbimon',
                        siteId: 20,
                        userId: 1,
                    },
                    busboy: {
                        on: function(name, method) {
                            request.busboy[name] = method;
                        }
                    },
                    pipe: function(busboy) {
                        busboy.field('info', metadata);
                        busboy.file(
                            'file', 
                            {
                                resume: sinon.stub(),
                                pipe: sinon.stub(),
                            },
                            'default-2014-07-14_08-30.wav',
                            'some encoding',
                            'mimetype');
                        busboy.finish();
                    },
                };
            });
            
            afterEach(function() {
                restoreFormatParse();
            });
            
            it('should respond "401 Unauthorized" if project have reached the storage limit', function() {
                getStorageUsage.callsArgWith(1, null, [{ min_usage: 100 }], []);
                
                receiveUpload(request, response, next);
                
                response.expect.status(401).json({ error: "Project Recording limit reached"});
                response.verify();
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
            });
            
            it('should respond "400 Bad Request" if no files', function() {
                delete request.busboy;
                
                receiveUpload(request, response, next);
                
                response.expect.status(400).json({ error: "no data" });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
            });
            
            it('should respond "400 Bad Request" if no basic metadata', function() {
                metadata = '{}';
                request.pipe = function(busboy) {
                    busboy.field('info', metadata);
                    busboy.finish();
                };
                
                receiveUpload(request, response, next);
                
                response.expect.status(400).json({ error: "missing basic metadata" });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
            });
            
            it('should respond "400 Bad Request" if invalid metadata JSON', function() {
                metadata = 'a'; // invalid JSON
                request.pipe = function(busboy) {
                    busboy.field('info', metadata);
                    busboy.finish();
                };
                
                receiveUpload(request, response, next);
                
                response.expect.status(400).json({ error: "Unexpected token a" });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
            });
            
            it('should respond "400 Bad Request" if bad filename format', function() {
                formatParse.throws(new Error("formatParse error"));
                
                request.pipe = function(busboy) {
                    busboy.file(
                        'file', 
                        file,
                        'default-2014-07-14_08-30.wav',
                        'some encoding',
                        'mimetype'
                    );
                    busboy.finish();
                };
                
                receiveUpload(request, response, next);
                
                response.expect.status(400).json({ error: "formatParse error" });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
                
                expect(file.resume.callCount).to.equal(1);
                expect(file.pipe.callCount).to.equal(0);
            });
            
            it('should respond "400 Bad Request" if incomplete form data', function() {
                request.pipe = function(busboy) {
                    busboy.finish();
                };
                
                receiveUpload(request, response, next);
                
                response.expect.status(400).json({ error: "form data not complete" });
                response.verify();
                
                expect(next.callCount).to.equal(0, 'Unexpected call to next');
            });
            
            it('should respond "403 Forbidden" if file is already on the system', function(done) {
                recExists.callsArgWith(1, null, true);
                
                response = new TestResponse(function respondFinished() {
                    
                    response.expect.status(403).json({ 
                        error: "filename default-2014-07-14_08-30 already exists on site 20" 
                    });
                    response.verify();
                    
                    expect(next.callCount).to.equal(0, 'Unexpected call to next');
                    
                    expect(mock.fs.unlink.callCount).to.equal(1);
                    
                    done();
                });
                
                receiveUpload(request, response, next);
            });
            
            it('should respond "500 Internal Server Error" if audioTools.info fails', function(done) {
                getAudioInfo.callsArgWith(1, 255);
                
                response = new TestResponse(function respondFinished() {
                    
                    response.expect.status(500).json({ 
                        error: "error getting audio file info" 
                    });
                    response.verify();
                    
                    expect(next.callCount).to.equal(0, 'Unexpected call to next');
                    
                    expect(mock.fs.unlink.callCount).to.equal(1);
                    
                    done();
                });
                
                receiveUpload(request, response, next);
            });
            
            it('should respond "403 Forbidden" if file is duration is an hour or longer', function(done) {
                audioInfo.duration = 9001;
                
                response = new TestResponse(function respondFinished() {
                    
                    response.expect.status(403).json({ 
                        error: "Recording is too long, please contact support" 
                    });
                    response.verify();
                    
                    expect(next.callCount).to.equal(0, 'Unexpected call to next');
                    
                    expect(mock.fs.unlink.callCount).to.equal(1);
                    
                    done();
                });
                
                receiveUpload(request, response, next);
            });
            
            it('Should respond "401 Unauthorized" if project will over the storage limit with the file uploaded', function(done) {
                getStorageUsage.callsArgWith(1, null, [{ min_usage: 99.5 }], []);
                
                response = new TestResponse(function respondFinished() {
                    
                    response.expect.status(401).json({ 
                        error: "Recording is too long, there is only 0.5 minutes of space left" 
                    });
                    response.verify();
                    
                    expect(next.callCount).to.equal(0, 'Unexpected call to next');
                    
                    expect(mock.fs.unlink.callCount).to.equal(1);
                    
                    done();
                });
                
                receiveUpload(request, response, next);
            });
            
            it('Should respond "202 Accepted" after enqueuing a single file', function(done) {
                audioInfo.duration = 132;
                splitter.callsArgWith(2, null, [
                    'default-2014-07-14_08-30.p01.wav', 
                    'default-2014-07-14_08-30.p02.wav'
                ]);
                
                
                
                var oriDate = new Date(fileFormatInfo.datetime);
                
                response = new TestResponse(function respondFinished() {
                    
                    response.expect.status(202).json({ 
                        success: "upload done!"
                    });
                    response.verify();
                    
                    expect(next.callCount).to.equal(0, 'Unexpected call to next');
                    
                    expect(enqueue.callCount).to.equal(2);
                    expect(enqueue.firstCall.args[0].FFI.filename)
                        .to.equal('default-2014-07-14_08-30.p1');
                    expect(enqueue.firstCall.args[0].FFI.datetime.getMinutes())
                        .to.equal(oriDate.getMinutes());
                    expect(enqueue.firstCall.args[0].name)
                        .to.equal('default-2014-07-14_08-30.p1.wav');
                    expect(enqueue.firstCall.args[0].path)
                        .to.equal('default-2014-07-14_08-30.p01.wav');
                        
                    
                    expect(enqueue.secondCall.args[0].FFI.filename)
                        .to.equal('default-2014-07-14_08-30.p2');
                    expect(enqueue.secondCall.args[0].FFI.datetime.getMinutes())
                        .to.equal(oriDate.getMinutes()+1);
                    expect(enqueue.secondCall.args[0].name)
                        .to.equal('default-2014-07-14_08-30.p2.wav');
                    expect(enqueue.secondCall.args[0].path)
                        .to.equal('default-2014-07-14_08-30.p02.wav');
                    
                    expect(mock.fs.unlink.callCount).to.equal(1);
                    
                    done();
                });
                
                receiveUpload(request, response, next);
            });
            
            it('Should respond "202 Accepted" after enqueuing the parts of a file longer than 2 minutes', function(done) {
                response = new TestResponse(function respondFinished() {
                    
                    response.expect.status(202).json({ 
                        success: "upload done!"
                    });
                    response.verify();
                    
                    expect(next.callCount).to.equal(0, 'Unexpected call to next');
                    
                    expect(enqueue.callCount).to.equal(1);
                    
                    done();
                });
                
                receiveUpload(request, response, next);
            });
        });
    });
});
