/* jshint mocha:true */
/* global module:true */
/* global inject:true */
/* global sinon:true */

describe('Module: a2.srv.playlists', function() {
    "use strict";
    
    beforeEach(function() { 
        module('a2.srv.playlists');
        module('a2.srv.project');
        module('a2-project-service-mock');
    });
        
    describe('a2Playlists', function() { 
        var $httpBackend;
        var a2Playlists;
        
        beforeEach(inject(function($injector, _a2Playlists_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Playlists = _a2Playlists_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Playlists).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2Playlists.getList', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/playlists/')
                    .respond(200, 'data');
                    
                a2Playlists.getList(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.create', function() {
            it('requests to the correct route', function() {
                
                var params = {
                    key1: 'value1',
                    key2: 'value2',
                };
                
                $httpBackend
                    .expectPOST('/legacy-api/project/test/playlists/create', params)
                    .respond(200, 'data');
                    
                a2Playlists.create(params, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.getRecordingPosition', function() {
            
            beforeEach(function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/playlists/1/2/position')
                    .respond(200, 'data');
            });
            
            afterEach(function() {
                $httpBackend.flush();
            });
            
            it('requests to the correct route and call callback', function() {
                // callback
                a2Playlists.getRecordingPosition(1, 2, function(data){
                    expect(data).to.equal('data');
                });
            });
            
            it('requests to the correct route and return promise', function() {
                // httpPromise
                a2Playlists.getRecordingPosition(1, 2).success(function(data){
                    expect(data).to.equal('data');
                });
            });
        });
        
        describe('a2Playlists.getPreviousRecording', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/playlists/1/2/previous')
                    .respond(200, 'data');
                    
                a2Playlists.getPreviousRecording(1, 2, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.getNextRecording', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/playlists/1/2/next')
                    .respond(200, 'data');
                    
                a2Playlists.getNextRecording(1, 2, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.rename', function() {
            it('requests to the correct route', function() {
                
                var params = {
                    key1: 'value1',
                    key2: 'value2',
                };
                
                $httpBackend
                    .expectPOST('/legacy-api/project/test/playlists/rename', params)
                    .respond(200, 'data');
                    
                a2Playlists.rename(params, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.remove', function() {
            it('requests to the correct route', function() {
                
                var params = [
                    'value1',
                    'value2',
                ];
                
                $httpBackend
                    .expectPOST('/legacy-api/project/test/playlists/delete', { playlists: params })
                    .respond(200, 'data');
                    
                a2Playlists.remove(params, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.getInfo', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/playlists/info/1')
                    .respond(200, 'data');
                    
                a2Playlists.getInfo(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.getData', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/playlists/1?param=test')
                    .respond(200, 'data');
                    
                a2Playlists.getData(1, { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
    });
});
