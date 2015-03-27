/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var pre_wire= require('../mock_tools/pre_wire');
var router_expect = require('../mock_tools/router_expect');
var mock_aws = require('../mock_tools/mock_aws');
// var dd=console.log;

var mock_pipe = function(){};
mock_pipe.prototype = {
    pipe:function(){}, 
    resume:function(){}
};
var event_sink = function(){
    this.listeners={};
};
event_sink.prototype={
    on: function(event, cb){
        (this.listeners[event] || (this.listeners[event]=[])).push(cb);
    },
    send: function(){
        var args = Array.prototype.slice.call(arguments);
        var event = args[0];
        (this.listeners[event] || []).forEach(function (cb){
            args[0] = cb;
            setImmediate.apply(null, args);
        });
    }
};

var make_result_delegate = function(name, async, err){
    if(!err){
        err = new Error(name + " has no result!");
    }
    var fn = async ? function(){
        var cb=arguments[arguments.length-1];
        if(!fn.result){
            cb(err);
        } else {
            cb.apply(null, fn.result);
        }
    } : function(){
        if(!fn.result){
            throw err;
        } else {
            return fn.result;
        }
    };    
    return fn;
};

var uploads = pre_wire('../../routes/uploads', {
    'aws-sdk' : mock_aws
});
var mock_config = {
    aws: {
        bucketName: 'kfc_bucket'
    }
};
var mock = {
    config: function(k){return mock_config[k];},
    fs: {
        unlink:  make_result_delegate('fs.unlink', true),
        createWriteStream: function(){return {info:'this is a write stream'};},
        createReadStream: function(){return {info:'this is a read stream'};}
    },
    tmpFileCache: {
        key2File:function(key){return '~/file_key/' + key;}
    },
    audioTools: {
        info: make_result_delegate('audioTools.info', true, 1),
        spectrogram: make_result_delegate('audioTools.spectrogram', true, 1),
        sox: make_result_delegate('audioTools.sox', true, 1),
        splitter: make_result_delegate('audioTools.splitter', true),
    },
    formatParse: make_result_delegate('formatParse'),
    model:{
        uploads : {},
        sites : {},
        projects : {},
        recordings : {}
    }
};
uploads.__set__(mock);
var _uploadQueue = uploads.__get__('uploadQueue');

var uploads_router = router_expect(uploads, {
    method: "POST"
});

describe('uploads.js', function(){
    beforeEach(function(){
        delete mock_aws.S3.buckets.kfc_bucket;
        delete mock.fs.unlink.result;
        delete mock.audioTools.info.result;
        delete mock.audioTools.spectrogram.result;
        delete mock.audioTools.sox.result;
        delete mock.audioTools.splitter.result;
        delete mock.formatParse.result;
        mock.model.uploads = {
            insertRecToList : function(obj, cb){setImmediate(cb, null, {insertId:1}, {fields:1});},
            removeFromList : function(id, cb){setImmediate(cb, null, {affectedRows:1}, {fields:1});}
        };
        mock.model.sites = {
            findById : function(id, cb){ setImmediate(cb, null, [
                {}
            ]);}
        };
        mock.model.projects = {
            findById : function(id, cb){ 
                cb(null, [{project_id:1, recording_limit:100}], {});
            },
            totalRecordings : function(id, cb){ setImmediate(cb, null, [{count:0}], {});},
        };
        mock.model.recordings = {
            insert : function(obj, cb){ setImmediate(cb, null, {insertId:1}, {});},
            exists : function(obj, cb){ setImmediate(cb, null, false);}
        };
    });
    afterEach(function(){
        if(_uploadQueue.push.restore){
            _uploadQueue.push.restore();
        }
        if(console.log.restore){
            console.log.restore();
        }
    });
    describe('post /audio', function(){
        it('Should upload a file posted by a logged in user with permissions.', function(done){
            var scope={};
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            sinon.stub(console, 'log', function(msg){
                if(msg == "done processing uploads on queue"){
                    scope.res.status.calledOnce.should.be.true;
                    scope.res.status.args[0].should.deep.equal([202]);
                    scope.res.send.calledOnce.should.be.true;
                    scope.res.send.args[0].should.deep.equal(['upload done!']);
                    done();
                }
            });
            uploads_router.when({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify({}));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:true, send:true
            }, scope);
        });
        it('Should respond 400 if any parameter is missing.', function(done){
            var scope={};
            uploads_router.when({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{site:2, nameformat:20},
            }, {
                status:true, json: function(req, res, obj){
                    res.status.calledOnce.should.be.true;
                    res.status.args[0].should.deep.equal([400]);
                    obj.should.deep.equal({error:"missing parameters"});
                    done();
                }
            }, scope);
        });
        it('Should respond 401 if logged in user has no permission to upload.', function(done){
            var scope={};
            uploads_router.when({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings? you ARE crazy.";},
            }, {
                status:true, json: function(req, res, obj){
                    res.status.calledOnce.should.be.true;
                    res.status.args[0].should.deep.equal([401]);
                    obj.should.deep.equal({error:"you dont have permission to 'manage project recordings'"});
                    done();
                }
            }, scope);
        });        
        it('Should split the recording if its duration is longer than 120 secs.', function(done){
            var scope={};
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:121, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.audioTools.splitter.result = [null, ['f1', 'f2']];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            sinon.spy(_uploadQueue, 'push');
            sinon.stub(console, 'log', function(msg){
                if(msg == "done processing uploads on queue"){
                    scope.res.status.calledOnce.should.be.true;
                    scope.res.status.args[0].should.deep.equal([202]);
                    scope.res.send.calledOnce.should.be.true;
                    scope.res.send.args[0].should.deep.equal(['upload done!']);
                    _uploadQueue.push.callCount.should.deep.equal(2);
                    done();
                }
            });
            uploads_router.when({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify({}));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:true, send:true
            }, scope);
        });
        it('Should convert to flac if file is a wav.', function(done){
            var scope={};
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.wav', filetype:'.wav'};
            sinon.stub(console, 'log', function(msg){
                if(msg == "done processing uploads on queue"){
                    scope.res.status.calledOnce.should.be.true;
                    scope.res.status.args[0].should.deep.equal([202]);
                    scope.res.send.calledOnce.should.be.true;
                    scope.res.send.args[0].should.deep.equal(['upload done!']);
                    done();
                }
            });
            uploads_router.when({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify({}));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.wav', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:true, send:true
            }, scope);
        });
        it('Should convert to mono if file is stereo.', function(done){
            var scope={};
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:2, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            sinon.stub(console, 'log', function(msg){
                if(msg == "done processing uploads on queue"){
                    scope.res.status.calledOnce.should.be.true;
                    scope.res.status.args[0].should.deep.equal([202]);
                    scope.res.send.calledOnce.should.be.true;
                    scope.res.send.args[0].should.deep.equal(['upload done!']);
                    done();
                }
            });
            uploads_router.when({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify({}));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:true, send:true
            }, scope);
        });
        it('Should upload a file posted with a valid jsonwebtoken.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, null, [{token_created_on:iat_time}]);}
            sinon.stub(console, 'log', function(msg){
                if(msg == "done processing uploads on queue"){
                    scope.res.status.calledOnce.should.be.true;
                    scope.res.status.args[0].should.deep.equal([202]);
                    scope.res.send.calledOnce.should.be.true;
                    scope.res.send.args[0].should.deep.equal(['upload done!']);
                    done();
                }
            });
            uploads_router.when({url:'/audio',
                token:{project:1, site:2, iat:iat_time},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify({}));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:true, send:true
            }, scope);
        });
        it('Should respond 401 if jsonwebtoken is expired.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, null, [{token_created_on:iat_time-1}]);}
            uploads_router.when({url:'/audio',
                token:{project:1, site:2, iat:iat_time},
            }, {
                sendStatus:function(req, res, status){
                    status.should.equal(401);
                    done();
                }
            }, scope);
        });
        it('Should respond 401 if site in jsonwebtoken is not found.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, null, []);}
            uploads_router.when({url:'/audio',
                token:{project:1, site:2, iat:iat_time},
            }, {
                sendStatus:function(req, res, status){
                    status.should.equal(401);
                    done();
                }
            }, scope);
        });
        it('Should fail if search of in jsonwebtoken fails.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
            mock_aws.S3.buckets.kfc_bucket = {};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, new Error('I am error'));}
            uploads_router.when({url:'/audio',
                token:{project:1, site:2, iat:iat_time},
            }, {
                next:function(req, res, err){
                    should.exist(err);
                    err.message.should.equal('I am error');
                    done();
                }
            }, scope);
        });
        it('Should respond 401 if post has no valid jsonwebtoken and no valid session.', function(done){
            uploads_router.when('/audio', {
                sendStatus:function(req, res, status){
                    status.should.equal(401);
                    done();
                }
            });
        });
    });
});
