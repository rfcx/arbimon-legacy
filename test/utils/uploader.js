/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), 
    should = chai.should(), 
    expect = chai.expect;
chai.use(require('chai-subset'));

var sinon = require('sinon');
var rewire= require('rewire');

var Uploader = rewire('../../utils/uploader');

describe('Module: utils/uploader, Uploader', function() {
    var fileUpload;
    var data;
    var dummyCallback;
    var mock;
    
    before(function() {
        mock = {
            audioTools: {},
            fs: {},
            model:{},
            s3:{},
            tmpFileCache: {},
        };
        
        Uploader.__set__(mock);
    });
    
    beforeEach(function() {
        fileUpload = {
            metadata: {
                recorder: 'recorder',
                mic: 'mic',
                sver: 'v1.0.0',
            },
            info: {
                channels: 1,
                duration: 60,
                sample_rate: 44100,
                precision: 16,
                samples: 123456,
                file_size: 100,
                bit_rate: '200k',
                sample_encoding: '16-bit something',
            },
            FFI: {
                filename: 'default-2014-07-14_08-30',
                datetime: new Date(2014, 6, 14, 8, 30),
                filetype: '.wav',
            },
            name: 'default-2014-07-14_08-30.wav',
            path: 'some/path/file.wav',
            projectId: 100,
            siteId: 20,
            userId: 101,
            tempFileUri: 'uploading/project_100/site_20/2014/07/default-2014-07-14_08-30.wav'
        };
        
        dummyCallback = sinon.stub();
    });
    
    describe('prototype.insertUploadRecs', function() {
        var insertUploadRecs;
        var updateState;
        var insertRecToList;
        
        
        before(function() {
            insertUploadRecs = Uploader.prototype.insertUploadRecs;
        });
        
        beforeEach(function() {
            updateState = sinon.stub();
            insertRecToList = sinon.stub();
            
            mock.model.uploads = {
                updateState: updateState,
                insertRecToList: insertRecToList
            };
            
            data = {
                upload: fileUpload,
            };
        });
        
        after(function() {
            delete mock.model.uploads;
        });
        
        it('Should update state of upload if upload.id exists', function() {
            
            updateState.onFirstCall().callsArg(2);
            
            fileUpload.id = 1;
            
            insertUploadRecs.call(data, dummyCallback);
            
            expect(updateState.callCount).to.equal(1);
            expect(updateState.firstCall.args)
                .to.deep.equal([fileUpload.id, 'processing', dummyCallback]);
            expect(insertRecToList.callCount).to.equal(0);
            expect(dummyCallback.callCount).to.equal(1);
        });
        
        it('Should insert the upload to list if upload.id not exist', function() {
            
            var result = { insertId: 1 };
            insertRecToList.onFirstCall().callsArgWith(1, null, result);
            dummyCallback = sinon.stub();
            
            insertUploadRecs.call(data, dummyCallback);
            
            expect(insertRecToList.callCount).to.equal(1);
            expect(insertRecToList.firstCall.args[0])
                .to.deep.equal({
                    filename: fileUpload.name,
                    project_id: fileUpload.projectId,
                    site_id: fileUpload.siteId,
                    user_id: fileUpload.userId,
                    state: 'processing',
                });
                
            expect(fileUpload.id).to.equal(1);
            
            expect(updateState.callCount).to.equal(0);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([null, result]);
        });
        
        it('Should call callback with error if insertRecToList fails', function() {
            
            var err = new Error('err');
            insertRecToList.onFirstCall().callsArgWith(1, err);
            dummyCallback = sinon.stub();
            
            insertUploadRecs.call(data, dummyCallback);
            
            expect(insertRecToList.callCount).to.equal(1);
            expect(insertRecToList.firstCall.args[0])
                .to.deep.equal({
                    filename: fileUpload.name,
                    project_id: fileUpload.projectId,
                    site_id: fileUpload.siteId,
                    user_id: fileUpload.userId,
                    state: 'processing',
                });
                
            expect(fileUpload.id).to.not.exist;
            expect(updateState.callCount).to.equal(0);
            
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([err]);
        });
    });
    
    describe('prototype.convertMonoFlac', function() {
        var convertMonoFlac;
        var sox;
        
        before(function() {
            convertMonoFlac = Uploader.prototype.convertMonoFlac;
        });
        
        beforeEach(function() {
            mock.audioTools.sox = sox = sinon.stub();
            
            data = {
                upload: fileUpload,
                inFile: 'inFile',
                outFile: 'outFile'
            };
        });
        
        after(function() {
            delete mock.audioTools.sox;
        });
        
        it('Should skip processing if the file is flac and mono', function() {
            sox.onFirstCall().callsArgWith(1, 0, 'stdout', 'stderr');
            
            fileUpload.info.channels = 1;
            fileUpload.FFI.filetype = ".flac";
            
            convertMonoFlac.call(data, dummyCallback);
            
            expect(data.outFile === data.inFile).to.be.true;
            
            expect(sox.callCount).to.equal(0);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([null, 'did not process']);
            
        });
        
        it('Should transcode to flac if file type is another type', function() {
            sox.onFirstCall().callsArgWith(1, 0, 'stdout', 'stderr');
            
            fileUpload.info.channels = 1;
            fileUpload.FFI.filetype = ".mp3";
            
            convertMonoFlac.call(data, dummyCallback);
            
            expect(data.outFile !== data.inFile).to.be.true;
            
            expect(sox.callCount).to.equal(1);
            expect(sox.firstCall.args[0])
                .to.deep.equal([data.inFile, '-t','flac', data.outFile]);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([null, 0]);
        });
        
        it('Should mix down to mono if file have more than one channel', function() {
            sox.onFirstCall().callsArgWith(1, 0, 'stdout', 'stderr');
            
            fileUpload.info.channels = 3;
            fileUpload.FFI.filetype = ".flac";
            
            convertMonoFlac.call(data, dummyCallback);
            
            expect(data.outFile !== data.inFile).to.be.true;
            
            expect(sox.callCount).to.equal(1);
            expect(sox.firstCall.args[0])
                .to.deep.equal([data.inFile, '-c', 1, data.outFile]);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([null, 0]);
        });
        
        it('Should transcode and mix down if file is not flac and have more than 1 channel', function() {
            sox.onFirstCall().callsArgWith(1, 0, 'stdout', 'stderr');
            
            fileUpload.info.channels = 3;
            fileUpload.FFI.filetype = ".mp3";
            
            convertMonoFlac.call(data, dummyCallback);
            
            expect(data.outFile !== data.inFile).to.be.true;
            
            expect(sox.callCount).to.equal(1);
            expect(sox.firstCall.args[0])
                .to.deep.equal([data.inFile, '-c', 1, '-t','flac', data.outFile]);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([null, 0]);
        });
        
        it('Should call callback with error if sox fails', function() {
            sox.onFirstCall().callsArgWith(1, 1, 'stdout', 'stderr');
            
            fileUpload.info.channels = 3;
            fileUpload.FFI.filetype = ".mp3";
            
            convertMonoFlac.call(data, dummyCallback);
            
            expect(data.outFile !== data.inFile).to.be.true;
            
            expect(sox.callCount).to.equal(1);
            expect(sox.firstCall.args[0])
                .to.deep.equal([data.inFile, '-c', 1, '-t','flac', data.outFile]);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args[0])
                .to.be.an.instanceof(Error);
        });
    });
    
    describe('prototype.updateAudioInfo', function() {
        var updateAudioInfo;
        var info;
        
        before(function() {
            updateAudioInfo = Uploader.prototype.updateAudioInfo;
        });
        
        beforeEach(function() {
            mock.audioTools.info = info = sinon.stub();
            
            data = {
                upload: fileUpload,
                outFile: 'outFile'
            };
        });
        
        afterEach(function() {
            expect(info.callCount).to.equal(1);
            expect(info.firstCall.args[0]).to.equal(data.outFile);
        });
        
        after(function() {
            delete mock.audioTools.info;
        });
        
        it('Should update upload.info', function() {
            var audioInfo = { key: 'value'};
            info.onFirstCall().callsArgWith(1, 0, audioInfo);
            
            updateAudioInfo.call(data, dummyCallback);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(data.upload.info).to.deep.equal(audioInfo);
        });
        
        it('Should call callback with error if audioTools.info fails', function() {
            info.onFirstCall().callsArgWith(1, 1, null);
            
            updateAudioInfo.call(data, dummyCallback);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args[0])
                .to.be.an.instanceof(Error);
        });
    });
    
    describe('prototype.updateFileSize', function() {
        var updateFileSize;
        var stat;
        
        before(function() {
            updateFileSize = Uploader.prototype.updateFileSize;
        });
        
        beforeEach(function() {
            mock.fs.stat = stat = sinon.stub();
            
            data = {
                upload: fileUpload,
                outFile: 'outFile'
            };
        });
        
        afterEach(function() {
            expect(stat.callCount).to.equal(1);
            expect(stat.firstCall.args[0]).to.equal(data.outFile);
        });
        
        after(function() {
            delete mock.fs.stat;
        });
        
        it('Should update upload.info.file_size', function() {
            var fileInfo = { size: 100 };
            stat.onFirstCall().callsArgWith(1, 0, fileInfo);
            
            updateFileSize.call(data, dummyCallback);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(data.upload.info.file_size).to.deep.equal(100);
        });
        
        it('Should call callback with error if fs.stat fails', function() {
            stat.onFirstCall().callsArgWith(1, new Error('some err'));
            
            updateFileSize.call(data, dummyCallback);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args[0])
                .to.be.an.instanceof(Error);
        });
    });
    
    describe('prototype.genThumbnail', function() {
        var genThumbnail;
        var spectrogram;
        
        before(function() {
            genThumbnail = Uploader.prototype.genThumbnail;
        });
        
        beforeEach(function() {
            mock.audioTools.spectrogram = spectrogram = sinon.stub();
            
            data = {
                upload: fileUpload,
                outFile: 'outFile',
                thumbnail: 'thumbnail'
            };
        });
        
        afterEach(function() {
            expect(spectrogram.callCount).to.equal(1);
            expect(spectrogram.firstCall.args[0]).to.equal(data.outFile);
            expect(spectrogram.firstCall.args[1]).to.equal(data.thumbnail);
            expect(spectrogram.firstCall.args[2]).to.deep.equal({ 
                maxfreq : 15000,
                pixPerSec : (7),
                height : (153)
            });
        });
        
        after(function() {
            delete mock.audioTools.spectrogram;
        });
        
        it('Should call callback with code 0 if not error ocurred', function() {
            spectrogram.onFirstCall().callsArgWith(3, 0, 'stdout', 'stderr');
            
            genThumbnail.call(data, dummyCallback);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args)
                .to.deep.equal([null, 0]);
        });
        
        it('Should call callback with error if spectrogram fails', function() {
            spectrogram.onFirstCall().callsArgWith(3, 1, 'stdout', 'stderr');
            
            genThumbnail.call(data, dummyCallback);
            
            expect(dummyCallback.callCount).to.equal(1);
            expect(dummyCallback.firstCall.args[0])
                .to.be.an.instanceof(Error);
        });
    });
    
    describe('upload methods', function(){
        var config;
        var restoreConfig;
        var putObject;
        var createReadStream;
        
        before(function() {
            config = sinon.stub();
            config.withArgs('aws').returns({ bucketName: 'bucket' });
            restoreConfig = Uploader.__set__('config', config);
        });
        
        beforeEach(function() {
            mock.fs.createReadStream = createReadStream = sinon.stub();
            mock.fs.createReadStream.onFirstCall().returns('ReadStream');
            
            mock.s3.putObject = putObject = sinon.stub();
        });
        
        
        after(function() {
            delete mock.fs.createReadStream;
            delete mock.s3.putObject;
            restoreConfig();
        });
        
        describe('prototype.uploadFlac', function() {
            var uploadFlac;
            
            before(function() {
                uploadFlac = Uploader.prototype.uploadFlac;
            });
            
            beforeEach(function() {
                data = {
                    upload: fileUpload,
                    fileUri: 'fileUri',
                    outFile: 'outFile'
                };
            });
            
            afterEach(function() {
                expect(putObject.callCount).to.equal(1);
                expect(putObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(putObject.firstCall.args[0]).to.have.property('Key', data.fileUri);
                expect(putObject.firstCall.args[0]).to.have.property('ACL', 'public-read');
                
                expect(createReadStream.callCount).to.equal(1);
                expect(createReadStream.firstCall.args[0]).to.equal(data.outFile);
            });
            
            it('Should call callback with response', function() {
                var response = { key: 'value' };
                putObject.onFirstCall().callsArgWith(1, null, response);
                
                uploadFlac.call(data, dummyCallback);
                
                expect(dummyCallback.callCount).to.equal(1);
                expect(dummyCallback.firstCall.args)
                    .to.deep.equal([null, response]);
            });
            
            it('Should call callback with error if spectrogram fails', function() {
                putObject.onFirstCall().callsArgWith(1, new Error('fail'));
                
                uploadFlac.call(data, dummyCallback);
                
                expect(dummyCallback.callCount).to.equal(1);
                expect(dummyCallback.firstCall.args[0])
                    .to.be.an.instanceof(Error);
            });
        });
        
        describe('prototype.uploadThumbnail', function() {
            var uploadThumbnail;
            
            before(function() {
                uploadThumbnail = Uploader.prototype.uploadThumbnail;
            });
            
            beforeEach(function() {
                data = {
                    upload: fileUpload,
                    thumbnailUri: 'thumbnailUri',
                    thumbnail: 'thumbnail'
                };
            });
            
            afterEach(function() {
                expect(putObject.callCount).to.equal(1);
                expect(putObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(putObject.firstCall.args[0]).to.have.property('Key', data.thumbnailUri);
                expect(putObject.firstCall.args[0]).to.have.property('ACL', 'public-read');
                
                expect(createReadStream.callCount).to.equal(1);
                expect(createReadStream.firstCall.args[0]).to.equal(data.thumbnail);
            });
            
            it('Should call callback with response', function() {
                var response = { key: 'value' };
                putObject.onFirstCall().callsArgWith(1, null, response);
                
                uploadThumbnail.call(data, dummyCallback);
                
                expect(dummyCallback.callCount).to.equal(1);
                expect(dummyCallback.firstCall.args)
                    .to.deep.equal([null, response]);
            });
            
            it('Should call callback with error if spectrogram fails', function() {
                putObject.onFirstCall().callsArgWith(1, new Error('fail'));
                
                uploadThumbnail.call(data, dummyCallback);
                
                expect(dummyCallback.callCount).to.equal(1);
                expect(dummyCallback.firstCall.args[0])
                    .to.be.an.instanceof(Error);
            });
        });
    });
    
    describe('prototype.insertOnDB', function() {
        var insertOnDB;
        var recInsert;
        
        before(function() {
            insertOnDB = Uploader.prototype.insertOnDB;
        });
        
        beforeEach(function() {
            recInsert = sinon.stub();
            mock.model.recordings = {
                insert: recInsert,
            };
            
            data = {
                upload: fileUpload,
                fileUri: 'fileUri'
            };
        });
        
        after(function() {
            delete mock.model.recordings;
        });
        
        it('Should pass correct object to insert()', function() {
            var recObject = {
                site_id: fileUpload.siteId,
                uri: data.fileUri,
                datetime: fileUpload.FFI.datetime,
                mic: fileUpload.metadata.mic,
                recorder: fileUpload.metadata.recorder,
                version: fileUpload.metadata.sver,
                sample_rate: fileUpload.info.sample_rate,
                precision: fileUpload.info.precision,
                duration: fileUpload.info.duration,
                samples: fileUpload.info.samples,
                file_size: fileUpload.info.file_size,
                bit_rate: fileUpload.info.bit_rate,
                sample_encoding: fileUpload.info.sample_encoding,
            };
            
            insertOnDB.call(data, dummyCallback);
            
            
            expect(recInsert.callCount).to.equal(1);
            expect(recInsert.firstCall.args[0])
                .to.have.all.keys(Object.keys(recObject).concat(['upload_time']));
            expect(recInsert.firstCall.args[0]).to.containSubset(recObject);
            expect(recInsert.firstCall.args[0].upload_time)
                .to.be.an.instanceof(Date);
        });
    });
    
    describe('prototype.cleanUpAfter', function() {
        var cleanUpAfter;
        var unlink;
        var removeFromList;
        
        before(function() {
            cleanUpAfter = Uploader.prototype.cleanUpAfter;
        });
        
        beforeEach(function() {
            mock.fs.unlink = unlink = sinon.stub();
            removeFromList = sinon.stub();
            mock.model.uploads = {
                removeFromList: removeFromList,
            };
            
            data = {
                upload: fileUpload,
                thumbnail: 'thumbnail',
                inFile: 'inFile',
                outFile: 'outFile'
            };
            
            fileUpload.id = 1;
        });
        
        after(function() {
            delete mock.model.uploads;
        });
        
        it('Should delete temp file and remove upload from uploads_processing', function() {
            cleanUpAfter.call(data);
            
            expect(unlink.callCount).to.equal(3);
            expect(unlink.firstCall.args[0]).to.equal(data.thumbnail);
            expect(unlink.secondCall.args[0]).to.equal(data.inFile);
            expect(unlink.thirdCall.args[0]).to.equal(data.outFile);
            
            expect(removeFromList.callCount).to.equal(1);
            expect(removeFromList.firstCall.args[0]).to.equal(fileUpload.id);
        });
    });
    
    describe('prototype.dataPrep', function() {
        var dataPrep;
        var key2File;
        
        before(function() {
            dataPrep = Uploader.prototype.dataPrep;
        });
        
        beforeEach(function() {
            mock.tmpFileCache.key2File = key2File = sinon.stub();
            
            data = {
                upload: fileUpload
            };
        });
        
        after(function() {
            delete mock.tmpFileCache.key2File;
        });
        
        it('Should create paths for temp file and s3 URI keys', function() {
            key2File.returnsArg(0);
            
            dataPrep.call(data, dummyCallback);
            
            expect(data.inFile).to.equal(fileUpload.path);
            expect(data.outFile).to.equal('default-2014-07-14_08-30.out.flac');
            expect(data.thumbnail)
                .to.equal('default-2014-07-14_08-30.thumbnail.png');
            expect(data.fileUri)
                .to.equal('project_100/site_20/2014/7/default-2014-07-14_08-30.flac');
            expect(data.thumbnailUri)
                .to.equal('project_100/site_20/2014/7/default-2014-07-14_08-30.thumbnail.png');
                
            expect(dummyCallback.callCount).to.equal(1);
        });
    });
    
    describe('prototype.process', function() {
        var process;
        var dataPrep;
        var ensureFileIsLocallyAvailable;
        var insertUploadRecs;
        var convertMonoFlac;
        var updateAudioInfo;
        var updateFileSize;
        var genThumbnail;
        var uploadFlac;
        var uploadThumbnail;
        var insertOnDB;
        var cleanUpAfter;
        
        beforeEach(function() {
            dataPrep = sinon.stub(Uploader.prototype, 'dataPrep');
            dataPrep.callsArgAsync(0);
            
            ensureFileIsLocallyAvailable = sinon.stub(Uploader.prototype, 'ensureFileIsLocallyAvailable');
            ensureFileIsLocallyAvailable.callsArgAsync(0);
            
            insertUploadRecs = sinon.stub(Uploader.prototype, 'insertUploadRecs');
            insertUploadRecs.callsArgAsync(0);
            
            convertMonoFlac = sinon.stub(Uploader.prototype, 'convertMonoFlac');
            convertMonoFlac.callsArgAsync(0);
            
            updateAudioInfo = sinon.stub(Uploader.prototype, 'updateAudioInfo');
            updateAudioInfo.callsArgAsync(0);
            
            updateFileSize = sinon.stub(Uploader.prototype, 'updateFileSize');
            updateFileSize.callsArgAsync(0);
            
            genThumbnail = sinon.stub(Uploader.prototype, 'genThumbnail');
            genThumbnail.callsArgAsync(0);
            
            uploadFlac = sinon.stub(Uploader.prototype, 'uploadFlac');
            uploadFlac.callsArgAsync(0);
            
            uploadThumbnail = sinon.stub(Uploader.prototype, 'uploadThumbnail');
            uploadThumbnail.callsArgAsync(0);
            
            insertOnDB = sinon.stub(Uploader.prototype, 'insertOnDB');
            insertOnDB.callsArgAsync(0);
            
            cleanUpAfter = sinon.stub(Uploader.prototype, 'cleanUpAfter');
        });
        
        afterEach(function() {
            dataPrep.restore();
            ensureFileIsLocallyAvailable.restore();
            insertUploadRecs.restore();
            convertMonoFlac.restore();
            updateAudioInfo.restore();
            updateFileSize.restore();
            genThumbnail.restore();
            uploadFlac.restore();
            uploadThumbnail.restore();
            insertOnDB.restore();
            cleanUpAfter.restore();
        });
        
        it('Should process upload and call callback with results', function(done) {
            
            var uploader = new Uploader();
            uploader.process(fileUpload, function(err, results) {
                
                expect(err).to.equal(null);
                expect(results).to.have.all.keys([
                    'prepInfo',
                    'ensureFileIsLocallyAvailable',
                    'insertUploadRecs',
                    'convertMonoFlac',
                    'updateAudioInfo',
                    'updateFileSize',
                    'genThumbnail',
                    'uploadFlac',
                    'uploadThumbnail',
                    'insertOnDB',
                ]);
                
                // verify callOrder
                expect(ensureFileIsLocallyAvailable.calledAfter(dataPrep))
                    .to.equal(true, 'Expected ensureFileIsLocallyAvailable to be called after dataPrep');
                
                expect(insertUploadRecs.calledAfter(ensureFileIsLocallyAvailable))
                    .to.equal(true, 'Expected insertUploadRecs to be called after ensureFileIsLocallyAvailable');
                
                expect(convertMonoFlac.calledAfter(insertUploadRecs))
                    .to.equal(true, 'Expected convertMonoFlac to be called after insertUploadRecs');
                
                expect(updateAudioInfo.calledAfter(convertMonoFlac))
                    .to.equal(true, 'Expected updateAudioInfo to be called after convertMonoFlac');
                
                expect(updateFileSize.calledAfter(updateAudioInfo))
                    .to.equal(true, 'Expected updateFileSize to be called after updateAudioInfo');
                
                expect(genThumbnail.calledAfter(updateFileSize))
                    .to.equal(true, 'Expected genThumbnail to be called after updateFileSize');
                
                expect(uploadFlac.calledAfter(genThumbnail))
                    .to.equal(true, 'Expected uploadFlac to be called after genThumbnail');
                
                expect(uploadThumbnail.calledAfter(genThumbnail))
                    .to.equal(true, 'Expected uploadThumbnail to be called after genThumbnail');
                
                expect(insertOnDB.calledAfter(uploadFlac))
                    .to.equal(true, 'Expected insertOnDB to be called after uploadFlac');
                expect(insertOnDB.calledAfter(uploadThumbnail))
                    .to.equal(true, 'Expected insertOnDB to be called after uploadThumbnail');
                
                expect(cleanUpAfter.callCount).to.equal(1);
                
                done();
            });
        });
        
        it('Should call callback with error is any method on async fails', function(done) {
            sinon.stub(console, 'error');
            
            // This test is only to ensure async.auto behavior that why only testing
            // with one method
            convertMonoFlac.callsArgWithAsync(0, new Error('convertMonoFlac')); 
            
            var uploader = new Uploader();
            uploader.process(fileUpload, function(err, results) {
                expect(err).to.be.an.instanceof(Error);
                
                expect(cleanUpAfter.callCount).to.equal(1);
                
                console.error.restore();
                done();
            });
        });
    });
    
    describe('prototype.ensureFileIsLocallyAvailable', function() {
        var config;
        var restoreConfig;
        var tempFileUri;
        
        before(function() {
            config = sinon.stub();
            config.withArgs('aws').returns({ bucketName: 'bucket' });
            restoreConfig = Uploader.__set__('config', config);
            tempFileUri = fileUpload.tempFileUri;
        });
        
        beforeEach(function() {
            sinon.stub(mock.fs, 'writeFile');
            sinon.stub(mock.s3, 'getObject');
            data = {
                upload: fileUpload,
                thumbnail: 'thumbnail',
                inFile: 'inFile',
                outFile: 'outFile'
            };
        });
        
        afterEach(function() {
            mock.fs.writeFile.restore();
            mock.s3.getObject.restore();
            fileUpload.tempFileUri = tempFileUri;
        });
        
        after(function() {
            restoreConfig();
        });

        
        it('Should getObject from bucket if upload.tempFileUri is defined', function() {
            mock.fs.writeFile.onFirstCall().callsArg(1);
            mock.s3.getObject.onFirstCall().callsArgWith(2, null, {Body:'body data'});
            
            Uploader.prototype.ensureFileIsLocallyAvailable.call(data, function(err){
                expect(mock.s3.getObject.callCount).to.equal(1);
                expect(mock.s3.getObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(mock.s3.getObject.firstCall.args[0]).to.have.property('Key', data.upload.tempFileUri);

                expect(mock.fs.writeFile.callCount).to.equal(1);
                expect(mock.fs.writeFile.firstCall.args[0]).to.equal(data.upload.path);
                expect(mock.fs.writeFile.firstCall.args[1]).to.equal('body data');

                expect(err).to.be.empty();
            });
        });

        it('Should call callback immediately if upload.tempFileUri is not defined', function() {
            // mock.fs.writefile.onFirstCall().callsArg(1);
            // mock.s3.getObject.onFirstCall().callsArg(1);
            delete data.upload.tempFileUri;
            
            Uploader.prototype.ensureFileIsLocallyAvailable.call(data, function(err){
                expect(mock.s3.getObject.callCount).to.equal(0);
                expect(mock.fs.writeFile.callCount).to.equal(0);
                expect(err).to.be.empty();
                expect(fileUpload.tempFileUri).to.equal(tempFileUri);
            });
        });
        
        it('Should callback with error if getObject fails', function() {
            mock.fs.writeFile.onFirstCall().callsArg(1);
            mock.s3.getObject.onFirstCall().callsArgWith(2, new Error('err'));
            
            Uploader.prototype.ensureFileIsLocallyAvailable.call(data, function(err){
                expect(mock.s3.getObject.callCount).to.equal(1);
                expect(mock.s3.getObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(mock.s3.getObject.firstCall.args[0]).to.have.property('Key', data.upload.tempFileUri);

                expect(mock.fs.writeFile.callCount).to.equal(0);

                expect(err).to.not.be.empty();
                expect(err.message).to.equal('err');
            });
        });

        it('Should callback with error if fs.writeFile fails', function() {
            mock.fs.writeFile.onFirstCall().callsArgWith(1, new Error('err'));
            mock.s3.getObject.onFirstCall().callsArgWith(2, null, {Body:'body data'});
            
            Uploader.prototype.ensureFileIsLocallyAvailable.call(data, function(err){
                expect(mock.s3.getObject.callCount).to.equal(1);
                expect(mock.s3.getObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(mock.s3.getObject.firstCall.args[0]).to.have.property('Key', data.upload.tempFileUri);

                expect(mock.fs.writeFile.callCount).to.equal(1);
                expect(mock.fs.writeFile.firstCall.args[0]).to.equal(data.upload.path);
                expect(mock.fs.writeFile.firstCall.args[1]).to.equal('body data');

                expect(err).to.not.be.empty();
                expect(err.message).to.equal('err');
            });
        });

    });        
    
    describe('moveToTempArea', function() {
        var config;
        var restoreConfig;
        var tempFileUri;
        
        before(function() {
            config = sinon.stub();
            config.withArgs('aws').returns({ bucketName: 'bucket' });
            restoreConfig = Uploader.__set__('config', config);
            tempFileUri = fileUpload.tempFileUri;
        });
        
        beforeEach(function() {
            delete fileUpload.tempFileUri;
            sinon.stub(mock.fs, 'createReadStream');
            mock.fs.createReadStream.onFirstCall().returns('ReadStream');
            sinon.stub(mock.fs, 'unlink');
            sinon.stub(mock.s3, 'putObject');
        });
        
        afterEach(function() {
            mock.fs.createReadStream.restore();
            mock.fs.unlink.restore();
            mock.s3.putObject.restore();
            fileUpload.tempFileUri = tempFileUri;
        });
        
        after(function() {
            restoreConfig();
        });

        
        it('Should put file in bucket, remove file, set upload.tempFileUri and call callback', function(done) {
            mock.fs.unlink.onFirstCall().callsArg(1);
            mock.s3.putObject.onFirstCall().callsArg(1);
            
            Uploader.moveToTempArea(fileUpload, function(err){
                expect(mock.fs.createReadStream.callCount).to.equal(1);
                expect(mock.fs.createReadStream.firstCall.args[0]).to.equal(fileUpload.path);

                expect(mock.s3.putObject.callCount).to.equal(1);
                expect(mock.s3.putObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(mock.s3.putObject.firstCall.args[0]).to.have.property('Key', tempFileUri);
                expect(mock.s3.putObject.callCount).to.equal(1);
                
                expect(mock.fs.unlink.callCount).to.equal(1);
                expect(mock.fs.unlink.firstCall.args[0]).to.equal(fileUpload.path);

                expect(err).to.be.empty();
                expect(fileUpload.tempFileUri).to.equal(tempFileUri);
                
                done();
            });
        });
        
        it('Should call callback with error if putObject to bucket fails', function(done) {
            mock.s3.putObject.onFirstCall().callsArgWith(1, new Error('err'));
            mock.fs.unlink.onFirstCall().callsArg(1);
            
            Uploader.moveToTempArea(fileUpload, function(err){
                expect(mock.fs.createReadStream.callCount).to.equal(1);
                expect(mock.fs.createReadStream.firstCall.args[0]).to.equal(fileUpload.path);

                expect(mock.s3.putObject.callCount).to.equal(1);
                expect(mock.s3.putObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(mock.s3.putObject.firstCall.args[0]).to.have.property('Key', tempFileUri);
                expect(mock.s3.putObject.callCount).to.equal(1);
                
                expect(mock.fs.unlink.callCount).to.equal(0);

                expect(err).to.not.be.empty();
                expect(err.message).to.equal('err');
                expect(fileUpload.tempFileUri).to.be.empty();
                
                done();
            });
        });

        it('Should call callback with error if file unlink fails', function(done) {
            mock.fs.unlink.onFirstCall().callsArgWith(1, new Error('err'));
            mock.s3.putObject.onFirstCall().callsArg(1);
            
            Uploader.moveToTempArea(fileUpload, function(err){
                expect(mock.fs.createReadStream.callCount).to.equal(1);
                expect(mock.fs.createReadStream.firstCall.args[0]).to.equal(fileUpload.path);

                expect(mock.s3.putObject.callCount).to.equal(1);
                expect(mock.s3.putObject.firstCall.args[0]).to.have.property('Bucket', 'bucket');
                expect(mock.s3.putObject.firstCall.args[0]).to.have.property('Key', tempFileUri);
                expect(mock.s3.putObject.callCount).to.equal(1);
                
                expect(mock.fs.unlink.callCount).to.equal(1);
                expect(mock.fs.unlink.firstCall.args[0]).to.equal(fileUpload.path);

                expect(err).to.not.be.empty();
                expect(err.message).to.equal('err');
                expect(fileUpload.tempFileUri).to.be.empty();
                
                done();
            });
        });
    });    
    
    
    
    
    
    
    
    
    
    
    
    
});
