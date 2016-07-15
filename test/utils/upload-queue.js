/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), 
    should = chai.should(), 
    expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');

var robTheBuilder = require('../mock_tools/rob-the-builder');
var uploadQueue = rewire('../../utils/upload-queue');
var Uploader = require('../../utils/uploader');

var mock = {
    model:{
        uploads : {},
    }
};

uploadQueue.__set__(mock);

describe("Module: utils/upload-queue", function() {
    var fileUpload;
    
    beforeEach(function() {
        fileUpload = {
            metadata: {
                recorder: 'recorder',
                mic: 'mic',
                sver: 'v1.0.0',
            },
            info: {
                channels: 1,
                duration: 60
            },
            FFI: {
                filename: 'default-2014-07-14_08-30',
                datetime: new Date(),
                filetype: '.wav',
            },
            name: 'default-2014-07-14_08-30.wav',
            path: 'some/path/file.wav',
            projectId: 100,
            siteId: 20,
            userId: 101
        };
    });
    
    describe('uploadQueue.enqueue', function() {
        var restore;
        var restoreUploader;
        var _uploadQueue;
        var enqueue;
        
        
        before(function() {
            enqueue = uploadQueue.enqueue;
        });
        
        beforeEach(function() {
            _uploadQueue = {
                run: sinon.stub(),
            };
            restore=[];
            restore.push(uploadQueue.__set__("scheduler", _uploadQueue));
            sinon.stub(Uploader, 'moveToTempArea');
            mock.model.uploads.updateState = sinon.stub().yieldsAsync();
            mock.model.uploads.insertRecToList = sinon.stub();
        });
        
        afterEach(function() {
            restore.forEach(function(fn){ fn(); });
            Uploader.moveToTempArea.restore();
            delete mock.model.uploads.insertRecToList;
        });
        
        it('should add upload to uploads_processing and push in _uploadQueue', function(done) {
            mock.model.uploads.insertRecToList.onFirstCall()
                .callsArgWith(1, null, { insertId: 1 }, {});
            Uploader.moveToTempArea.onFirstCall().callsArg(1);
            
            enqueue(fileUpload, function(err) {
                expect(err).to.not.exist;
                
                expect(mock.model.uploads.insertRecToList.calledOnce).to.equal(true);
                mock.model.uploads.insertRecToList.firstCall.args[0]
                    .should.deep.equal({
                        channels:1,
                        datetime : mock.model.uploads.insertRecToList.firstCall.args[0].datetime,
                        metadata : {
                            mic: "mic",
                            recorder: "recorder",
                            sver: "v1.0.0"
                        },
                        filename: fileUpload.name, 
                        project_id: fileUpload.projectId,
                        site_id: fileUpload.siteId,
                        user_id: fileUpload.userId,
                        state: 'initializing',
                        duration: fileUpload.info.duration
                    });
                expect(Uploader.moveToTempArea.calledOnce).to.equal(true);
                Uploader.moveToTempArea.firstCall.args[0].should.equal(fileUpload);
                
                _uploadQueue.run.callCount.should.equal(1);
                
                done();
            });
        });
        
        it('should throw err if insertRecToList fails', function(done) {
            mock.model.uploads.insertRecToList.onFirstCall()
                .callsArgWith(1, new Error('err'));
            
            enqueue(fileUpload, function(err) {
                expect(err).to.exist;
                expect(err.message).to.have.string('err');
                
                expect(mock.model.uploads.insertRecToList.calledOnce).to.equal(true);
                expect(Uploader.moveToTempArea.calledOnce).to.equal(false);
                
                // _uploadQueue.run.callCount.should.equal(1);
                // expect(_uploadQueue).to.deep.equal([]);
                
                done();
            });
        });

        it('should throw err if Uploader.moveToTempArea fails', function(done) {
            mock.model.uploads.insertRecToList.onFirstCall()
                .callsArgWith(1, null, { insertId: 1 }, {});
            Uploader.moveToTempArea.onFirstCall()
                .callsArgWith(1, new Error('err'));
            
            enqueue(fileUpload, function(err) {
                expect(err).to.exist;
                expect(err.message).to.have.string('err');
                
                expect(mock.model.uploads.insertRecToList.calledOnce).to.equal(true);
                expect(Uploader.moveToTempArea.calledOnce).to.equal(true);
                
                // _uploadQueue.run.callCount.should.equal(1);
                // expect(_uploadQueue).to.deep.equal([]);
                
                done();
            });
        });

    });

    describe.skip('worker', function() {
        var worker;
        var UploaderMock;
        var restoreUploader;
        
        before(function() {
            worker = uploadQueue.__get__('worker');
            
            UploaderMock = robTheBuilder({
                process: sinon.stub()
            });
            
            restoreUploader = uploadQueue.__set__('Uploader', UploaderMock);
        });
        
        after(function() {
            restoreUploader();
        });
        
        it('should create an instance of Uploader and run uploader.process()', function(done) {
            
            worker(fileUpload, function() {});
            
            expect(UploaderMock.instances.length).to.equal(1);
            
            var instance = UploaderMock.instances[0].obj;
            
            expect(instance.process.callCount).to.equal(1);
            expect(instance.process.firstCall.args[0]).to.deep.equal(fileUpload);
            
            done();
        });
    });
    
});
