/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var pre_wire= require('../mock_tools/pre_wire');
var router_expect = require('../mock_tools/router_expect');
var router_expect2 = require('../mock_tools/router_expect2');

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
        var args = Array.prototype.slice.call(arguments);
        var cb=args.pop();
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

var uploads = pre_wire('../../routes/uploads');


var mock = {
    fs: {
        unlink: make_result_delegate('fs.unlink', true),
        createWriteStream: function(){ return {info:'this is a write stream'};},
        createReadStream: function(){ return {info:'this is a read stream'};}
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


var uploads_router = router_expect(uploads, {
    method: "POST"
});

var uploads_router2 = router_expect2(uploads, {
    method: "POST"
});

describe('routes/uploads.js', function(){
    var uploadQueue;
    var restoreUploadQueue;
    var console_log, console_error;
    var metadata;
    
    before(function(){
        // console_log = console.log;
        // console_error = console.error;
    });
    
    beforeEach(function(){
        delete mock.fs.unlink.result;
        delete mock.audioTools.info.result;
        delete mock.audioTools.spectrogram.result;
        delete mock.audioTools.sox.result;
        delete mock.audioTools.splitter.result;
        delete mock.formatParse.result;
        // console.log = function(){};
        // console.error = function(){};
        mock.model.uploads = {
            insertRecToList : function(obj, cb){ process.nextTick(cb, null, {insertId:1}, {fields:1});},
            removeFromList : function(id, cb){ process.nextTick(cb, null, {affectedRows:1}, {fields:1});}
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
        
        uploadQueue = [];
        restoreUploadQueue = uploads.__set__('uploadQueue', uploadQueue);
        metadata = { sver: 1.0, recorder: "recorder", mic: "mic" };
    });
    
    afterEach(function(){
        restoreUploadQueue();
        
        // console.log = function(){};
        // if(console.log.restore){
        //     console.log.restore();
        // }
        // if(console.error.restore){
        //     console.error.restore();
        // }
    });
    
    after(function(){
        // console.log = console_log;
        // console.error = console_error;
    });
    
    describe('POST /audio', function(){

        it('Should accept a file submited by a logged in user with permissions.', function(done){
            var scope={};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {
                duration: 60,
                channels: 1,
                sample_rate: 44100,
                precision: 16,
                samples: 2646000,
                file_size: 1024,
                bit_rate: 1,
                sample_encoding: 'PCM'
            }];
            
            mock.formatParse.result = {
                datetime: new Date(),
                filename: 'recordingfile.flac',
                filetype: '.flac'
            };
            mock.audioTools.spectrogram.result = [0, {
                info: "this is a spectrogram"
            }];
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{
                    loggedIn:true, 
                    user: { id:1 }
                },
                query:{ 
                    project:1, 
                    site:2, 
                    nameformat:20
                },
                haveAccess: function(proj, perm) {
                    return perm == "manage project recordings";
                },
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status: [202], 
                send: ['upload done!']
            }, function() {
                done();
            });
        });
        
        it('Should ignore fields other than \'info\' or file-type fields.', function(done){
            var scope={};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            
            uploads_router2.whenExpect({
                url:'/audio',
                session: { loggedIn: true, user: {id:1}},
                query: {project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm) { 
                    return perm == "manage project recordings";
                },
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('field', 'other', JSON.stringify({ other: "value"} ));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status: [202], 
                send: ['upload done!']
            }, done);
        });
        
        it('Should respond 401 if number of recording in project reaches the limit.', function(done){
            var scope={};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.projects.totalRecordings = function(id, cb){ setImmediate(cb, null, [{count:100}], {});};
            
            uploads_router2.whenExpect({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', "{q}+2");
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:[401], 
                json: [{ error: "Project Recording limit reached"}]
            }, done);
        });
    
        it('Should fail if fetching project info or fetching total recordings fail.', function(done){
            var scope={};
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            mock.model.projects.totalRecordings = function(id, cb){ setImmediate(cb, new Error("I am error"));};
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', "{q}+2");
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                next: [new Error("I am error")]
            }, done);
        });
    
        it('Should respond 400 if processing of info field fails.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            

            uploads_router2.whenExpect({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', "{q}+2");
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:[400], 
                json: [{ error: "Unexpected token q"}]
            }, done);
        });
    
        it('Should respond 400 if formatParse fails.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:[400], 
                json: [{ error: "formatParse has no result!"}]
            }, done);
        });
    
        it('Should respond 400 if POST is not multipart  (busboy doesnt exist in the request).', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            // mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            
            uploads_router2.whenExpect({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
            }, {
                sendStatus: [400]
            }, done);
        });
    
        it('Should respond 400 if either the metadata or the uploaded file is missing.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('finish');
                }
            }, {
                status: [400], 
                json: [{ error: "form data not complete"}]
            }, done);
        });
    
        it('Should respond 403 if a recording with the same filename is already in the site.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.model.recordings.exists = function(obj, cb){ setImmediate(cb, null, true);};
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status: [403], 
                json: [{ error: "filename recordingfile.flac already exists on site 2"}]
            }, done);
        });
    
        it('Should delegate to router if check to see if a recording with the same filename is already in the site fails.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.model.recordings.exists = function(obj, cb){ setImmediate(cb, new Error("I am error"));};
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            
            uploads_router2.whenExpect({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                next: [ new Error("I am error")]
            }, done);
        });
                
        it('Should respond 500 if obtaining audio info fails.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [1];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};            
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status: [500], 
                json: [{ error: "error getting audio file info" }]
            }, done);
        });
    
        it('Should respond 400 if any parameter is missing.', function(done){
            var scope={};
            
            uploads_router2.whenExpect({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{site:2, nameformat:20},
            }, {
                status: [400], 
                json: [{error:"missing parameters"}]
            }, done);
        });
        
        it('Should respond 401 if logged in user has no permission to upload.', function(done){
            var scope={};
            
            uploads_router2.whenExpect({url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){ return false; },
            }, {
                status: [401], 
                json: [{error:"you dont have permission to 'manage project recordings'"}]
            }, done);
        });
        
        it('Should split the recording if its duration is longer than 120 secs.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:121, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, { info: "this is a spectrogram"}];
            mock.audioTools.splitter.result = [null, ['f1', 'f2']];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status: [202], 
                send: ['upload done!']
            }, function(err) {
                expect(uploadQueue.length).to.equal(2);
                done();
            });
        });
    
        it('Should respond 403 if the recording duration is longer than 3600 secs.', function(done){
            var scope={};
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:3601, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            
            uploads_router2.whenExpect({
                url:'/audio',
                session:{loggedIn:true, user:{id:1}},
                query:{project:1, site:2, nameformat:20},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status:[403], 
                json: [{ error: "recording is too long, please contact support" }]
            }, done);
        });
        
        it('Should upload a file posted with a valid jsonwebtoken.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, null, [{token_created_on:iat_time}]);};

            uploads_router2.whenExpect({
                url:'/audio',
                token:{project:1, site:2, iat:iat_time},
                haveAccess: function(proj, perm){return perm == "manage project recordings";},
                busboy : new event_sink(),
                pipe: function(busboy){
                    busboy.send('field', 'info', JSON.stringify(metadata));
                    busboy.send('file', 'file', new mock_pipe(), 'recordingfile.flac', 'plain file encoding', 'audio/flac');
                    busboy.send('finish');
                }
            }, {
                status: [202], 
                send: ['upload done!']
            }, done);
        });
    
        it('Should respond 401 if jsonwebtoken is expired.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, null, [{token_created_on:iat_time-1}]);};
            
            uploads_router2.whenExpect({
                url:'/audio',
                token: { project:1, site:2, iat:iat_time },
            }, {
                sendStatus: [401]
            }, done);
        });
    
        it('Should respond 401 if site in jsonwebtoken is not found.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, null, []);};
            
            uploads_router2.whenExpect({
                url:'/audio',
                token: { project:1, site:2, iat:iat_time },
            }, {
                sendStatus: [401]
            }, done);
        });
    
        it('Should fail if search of in jsonwebtoken fails.', function(done){
            var scope={};
            var iat_time = new Date().getTime();
             
            mock.fs.unlink.result = [];
            mock.audioTools.info.result = [0, {duration:60, channels:1, sample_rate:44100, precision:16, samples:2646000, file_size: 1024, bit_rate:1, sample_encoding:'PCM'}];
            mock.audioTools.spectrogram.result = [0, {info:"this is a spectrogram"}];
            mock.formatParse.result = {datetime:new Date(), filename:'recordingfile.flac', filetype:'.flac'};
            mock.model.sites.findById = function(id, cb){ setImmediate(cb, new Error('I am error'));};
            
            uploads_router2.whenExpect({
                url:'/audio',
                token: { project:1, site:2, iat: iat_time},
            }, {
                next: [new Error('I am error')]
            }, done);
        });
    
        it('Should respond 401 if post has no valid jsonwebtoken and no valid session.', function(done){
            uploads_router2.whenExpect('/audio', { sendStatus: [401] }, done);
        });
    });
});
