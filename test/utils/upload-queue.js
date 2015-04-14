// /*jshint node:true */
// /*jshint mocha:true */
// /*jshint expr:true */
// "use strict";
// 
// 
// var chai = require('chai'), should = chai.should(), expect = chai.expect;
// var sinon = require('sinon');
// var pre_wire= require('../mock_tools/pre_wire');
// var router_expect = require('../mock_tools/router_expect');
// var mock_aws = require('../mock_tools/mock_aws');
// // var dd=console.log;
// 
// var mock_pipe = function(){};
// mock_pipe.prototype = {
//     pipe:function(){}, 
//     resume:function(){}
// };
// 
// var event_sink = function(){
//     this.listeners={};
// };
// 
// event_sink.prototype={
//     on: function(event, cb){
//         (this.listeners[event] || (this.listeners[event]=[])).push(cb);
//     },
//     send: function(){
//         var args = Array.prototype.slice.call(arguments);
//         var event = args[0];
//         (this.listeners[event] || []).forEach(function (cb){
//             args[0] = cb;
//             setImmediate.apply(null, args);
//         });
//     }
// };
// 
// var make_result_delegate = function(name, async, err){
//     if(!err){
//         err = new Error(name + " has no result!");
//     }
//     var fn = async ? function(){
//         var args = Array.prototype.slice.call(arguments);
//         var cb=args.pop();
//         if(!fn.result){
//             cb(err);
//         } else {
//             cb.apply(null, fn.result);
//         }
//     } : function(){
//         if(!fn.result){
//             throw err;
//         } else {
//             return fn.result;
//         }
//     };    
//     return fn;
// };
// 
// var uploads = pre_wire('../../routes/uploads', {
//     'aws-sdk' : mock_aws
// });
// 
// var mock_config = {
//     aws: {
//         bucketName: 'kfc_bucket'
//     }
// };
// 
// var mock = {
//     config: function(k){return mock_config[k];},
//     fs: {
//         unlink:  make_result_delegate('fs.unlink', true),
//         createWriteStream: function(){return {info:'this is a write stream'};},
//         createReadStream: function(){return {info:'this is a read stream'};}
//     },
//     tmpFileCache: {
//         key2File:function(key){return '~/file_key/' + key;}
//     },
//     audioTools: {
//         info: make_result_delegate('audioTools.info', true, 1),
//         spectrogram: make_result_delegate('audioTools.spectrogram', true, 1),
//         sox: make_result_delegate('audioTools.sox', true, 1),
//         splitter: make_result_delegate('audioTools.splitter', true),
//     },
//     formatParse: make_result_delegate('formatParse'),
//     model:{
//         uploads : {},
//         sites : {},
//         projects : {},
//         recordings : {}
//     }
// };
// 
// uploads.__set__(mock);
// 
// var _uploadQueue = uploads.__get__('uploadQueue');
// var processUpload = uploads.__get__('processUpload');
// 
// var uploads_router = router_expect(uploads, {
//     method: "POST"
// });
// 
// describe("Module: utils/upload-queue", function() {
//     var console_log, console_error;
//     
//     before(function(){
//         console_log = console.log;
//         console_error = console.error;
//     });
//     
//     beforeEach(function(){
//         delete mock_aws.S3.buckets.kfc_bucket;
//         delete mock.fs.unlink.result;
//         delete mock.audioTools.info.result;
//         delete mock.audioTools.spectrogram.result;
//         delete mock.audioTools.sox.result;
//         delete mock.audioTools.splitter.result;
//         delete mock.formatParse.result;
//         console.log = function(){};
//         console.error = function(){};
//         mock.model.uploads = {
//             insertRecToList : function(obj, cb){setImmediate(cb, null, {insertId:1}, {fields:1});},
//             removeFromList : function(id, cb){setImmediate(cb, null, {affectedRows:1}, {fields:1});}
//         };
//         mock.model.sites = {
//             findById : function(id, cb){ setImmediate(cb, null, [
//                 {}
//             ]);}
//         };
//         mock.model.projects = {
//             findById : function(id, cb){ 
//                 cb(null, [{project_id:1, recording_limit:100}], {});
//             },
//             totalRecordings : function(id, cb){ setImmediate(cb, null, [{count:0}], {});},
//         };
//         mock.model.recordings = {
//             insert : function(obj, cb){ setImmediate(cb, null, {insertId:1}, {});},
//             exists : function(obj, cb){ setImmediate(cb, null, false);}
//         };
//     });
//     
//     afterEach(function(){
//         if(_uploadQueue.push.restore){
//             _uploadQueue.push.restore();
//         }
//         // console.log = function(){};
//         if(console.log.restore){
//             console.log.restore();
//         }
//         if(console.error.restore){
//             console.error.restore();
//         }
//     });
//     
//     after(function(){
//         console.log = console_log;
//         console.error = console_error;
//     });
//         
//     describe("(inner) processUpload()", function() {
// 
//         it('Should output to console.error if updating audio info of uploaded file fails.', function(done) {
//             mock_aws.S3.buckets.kfc_bucket = {};
//             mock.fs.unlink.result = [];
//             mock.audioTools.info.result = [1];
//             mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
//             mock.audioTools.spectrogram.result = [0, {
//                 info: "this is a spectrogram"
//             }];
//             mock.formatParse.result = {
//                 datetime: new Date(),
//                 filename: 'recordingfile.wav',
//                 filetype: '.wav'
//             };
//             sinon.stub(console, 'error', function() {
//                 arguments[0].message.should.equal('error getting audio file info');
//                 done();
//             });
//             processUpload({
//                 projectId: 1,
//                 siteId: 2,
//                 userId: 9393,
//                 info: {
//                     duration: 60,
//                     channels: 2,
//                     sample_rate: 44100,
//                     precision: 16,
//                     samples: 2646000,
//                     file_size: 1024,
//                     bit_rate: 1,
//                     sample_encoding: 'PCM'
//                 },
//                 name: 'recordingfile.wav',
//                 FFI: {
//                     datetime: new Date(),
//                     filename: 'recordingfile.wav',
//                     filetype: '.wav'
//                 },
//                 metadata: {},
//                 path: 'recilfepath.wav'
//             }, function() {});
//         });
//         
//         it('Should output to console.error if generating spectrogram fails.', function(done) {
//             mock_aws.S3.buckets.kfc_bucket = {};
//             mock.fs.unlink.result = [];
//             mock.audioTools.info.result = [0, {
//                 duration: 60,
//                 channels: 2,
//                 sample_rate: 44100,
//                 precision: 16,
//                 samples: 2646000,
//                 file_size: 1024,
//                 bit_rate: 1,
//                 sample_encoding: 'PCM'
//             }];
//             mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
//             mock.audioTools.spectrogram.result = [1, {
//                 info: "this is a spectrogram"
//             }];
//             mock.formatParse.result = {
//                 datetime: new Date(),
//                 filename: 'recordingfile.wav',
//                 filetype: '.wav'
//             };
//             sinon.stub(console, 'error', function() {
//                 arguments[0].message.should.equal('error generating spectrogram: \nundefined');
//                 done();
//             });
//             processUpload({
//                 projectId: 1,
//                 siteId: 2,
//                 userId: 9393,
//                 info: {
//                     duration: 60,
//                     channels: 2,
//                     sample_rate: 44100,
//                     precision: 16,
//                     samples: 2646000,
//                     file_size: 1024,
//                     bit_rate: 1,
//                     sample_encoding: 'PCM'
//                 },
//                 name: 'recordingfile.wav',
//                 FFI: {
//                     datetime: new Date(),
//                     filename: 'recordingfile.wav',
//                     filetype: '.wav'
//                 },
//                 metadata: {},
//                 path: 'recilfepath.wav'
//             }, function() {});
//         });
//         
//         it('Should output to console.error if uploading flac to bucket fails.', function(done) {
//             // mock_aws.S3.buckets.kfc_bucket = {};
//             mock.fs.unlink.result = [];
//             mock.audioTools.info.result = [0, {
//                 duration: 60,
//                 channels: 2,
//                 sample_rate: 44100,
//                 precision: 16,
//                 samples: 2646000,
//                 file_size: 1024,
//                 bit_rate: 1,
//                 sample_encoding: 'PCM'
//             }];
//             mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
//             mock.audioTools.spectrogram.result = [0, {
//                 info: "this is a spectrogram"
//             }];
//             mock.formatParse.result = {
//                 datetime: new Date(),
//                 filename: 'recordingfile.wav',
//                 filetype: '.wav'
//             };
//             sinon.stub(console, 'error', function() {
//                 arguments[0].message.should.equal('bucket kfc_bucket not in cache.');
//                 done();
//             });
//             processUpload({
//                 projectId: 1,
//                 siteId: 2,
//                 userId: 9393,
//                 info: {
//                     duration: 60,
//                     channels: 2,
//                     sample_rate: 44100,
//                     precision: 16,
//                     samples: 2646000,
//                     file_size: 1024,
//                     bit_rate: 1,
//                     sample_encoding: 'PCM'
//                 },
//                 name: 'recordingfile.wav',
//                 FFI: {
//                     datetime: new Date(),
//                     filename: 'recordingfile.wav',
//                     filetype: '.wav'
//                 },
//                 metadata: {},
//                 path: 'recilfepath.wav'
//             }, function() {});
//         });
//         
//         it('Should output to console.error if fails while removing from upload list.', function(done) {
//             mock_aws.S3.buckets.kfc_bucket = {};
//             mock.fs.unlink.result = [];
//             mock.audioTools.info.result = [0, {
//                 duration: 60,
//                 channels: 2,
//                 sample_rate: 44100,
//                 precision: 16,
//                 samples: 2646000,
//                 file_size: 1024,
//                 bit_rate: 1,
//                 sample_encoding: 'PCM'
//             }];
//             mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
//             mock.audioTools.spectrogram.result = [0, {
//                 info: "this is a spectrogram"
//             }];
//             mock.formatParse.result = {
//                 datetime: new Date(),
//                 filename: 'recordingfile.wav',
//                 filetype: '.wav'
//             };
//             mock.model.uploads.removeFromList = function(id, cb) {
//                 setImmediate(cb, new Error("I am error"));
//             };
// 
//             sinon.stub(console, 'error', function() {
//                 arguments[0].message.should.equal('I am error');
//                 done();
//             });
//             processUpload({
//                 projectId: 1,
//                 siteId: 2,
//                 userId: 9393,
//                 info: {
//                     duration: 60,
//                     channels: 2,
//                     sample_rate: 44100,
//                     precision: 16,
//                     samples: 2646000,
//                     file_size: 1024,
//                     bit_rate: 1,
//                     sample_encoding: 'PCM'
//                 },
//                 name: 'recordingfile.wav',
//                 FFI: {
//                     datetime: new Date(),
//                     filename: 'recordingfile.wav',
//                     filetype: '.wav'
//                 },
//                 metadata: {},
//                 path: 'recilfepath.wav'
//             }, function() {});
//         });
//         
//         it('Should output to console.error if fails to add recording to upload list.', function(done) {
//             mock_aws.S3.buckets.kfc_bucket = {};
//             mock.fs.unlink.result = [];
//             mock.audioTools.info.result = [0, {
//                 duration: 60,
//                 channels: 2,
//                 sample_rate: 44100,
//                 precision: 16,
//                 samples: 2646000,
//                 file_size: 1024,
//                 bit_rate: 1,
//                 sample_encoding: 'PCM'
//             }];
//             mock.audioTools.sox.result = [0, 'stdout', 'stderr'];
//             mock.audioTools.spectrogram.result = [0, {
//                 info: "this is a spectrogram"
//             }];
//             mock.formatParse.result = {
//                 datetime: new Date(),
//                 filename: 'recordingfile.wav',
//                 filetype: '.wav'
//             };
//             mock.model.uploads.insertRecToList = function(obj, cb) {
//                 setImmediate(cb, new Error("I am error"));
//             };
// 
//             sinon.stub(console, 'error', function() {
//                 arguments[0].message.should.equal('I am error');
//                 done();
//             });
//             processUpload({
//                 projectId: 1,
//                 siteId: 2,
//                 userId: 9393,
//                 info: {
//                     duration: 60,
//                     channels: 2,
//                     sample_rate: 44100,
//                     precision: 16,
//                     samples: 2646000,
//                     file_size: 1024,
//                     bit_rate: 1,
//                     sample_encoding: 'PCM'
//                 },
//                 name: 'recordingfile.wav',
//                 FFI: {
//                     datetime: new Date(),
//                     filename: 'recordingfile.wav',
//                     filetype: '.wav'
//                 },
//                 metadata: {},
//                 path: 'recilfepath.wav'
//             }, function() {});
//         });
//     });
// });
