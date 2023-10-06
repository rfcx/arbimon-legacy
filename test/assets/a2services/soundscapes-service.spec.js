/* jshint mocha:true */
/* global module:true */
/* global inject:true */
/* global sinon:true */

describe('Module: a2.srv.soundscapes', function() {
    "use strict";
    
    beforeEach(function() { 
        module('a2.srv.soundscapes');
        module('a2.srv.project');
        module('a2-project-service-mock');
    });
        
    describe('a2Soundscapes', function() { 
        var $httpBackend;
        var a2Soundscapes;
        var notifyError;
        var callback;
        
        beforeEach(inject(function($injector, notify, _a2Soundscapes_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Soundscapes = _a2Soundscapes_;
            notifyError = sinon.spy(notify, 'serverError');
            callback = sinon.spy();
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
            notifyError.restore();
        });
        
        it('should exist', function() {
            /* jshint -W030 */
            expect(a2Soundscapes).to.exist;
            /* jshint +W030 */
        });
        
        describe('a2Soundscapes.get', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1')
                    .respond(200, 'data');
                    
                a2Soundscapes.get(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getSCIdx', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/scidx')
                    .respond(200, 'data');
                    
                a2Soundscapes.getSCIdx(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
            
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/scidx?param=test')
                    .respond(200, 'data');
                    
                a2Soundscapes.getSCIdx(1, { param: 'test'}, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });

            it('request to correct route, using returned promise', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/scidx')
                    .respond(200, 'data');
                    
                a2Soundscapes.getSCIdx(1).then(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });

        });
        
        describe('a2Soundscapes.getNormVector', function() {
            it('request to correct route with a given callback', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/norm-vector')
                    .respond(200, 'data');
                    
                a2Soundscapes.getNormVector(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
            
            it('request to correct route using returned promise', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/norm-vector')
                    .respond(200, 'data');
                    
                a2Soundscapes.getNormVector(1).then(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getList', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/')
                    .respond(200, 'data');
                    
                a2Soundscapes.getList(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/?param=test')
                    .respond(200, 'data');
                    
                a2Soundscapes.getList({ param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getList2', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/details');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Soundscapes.getList2(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                a2Soundscapes.getList2(callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Soundscapes.setVisualizationOptions', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/soundscapes/1/scale', { param: 'test' })
                    .respond(200, 'data');
                    
                a2Soundscapes.setVisualizationOptions(1, { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.addRegion', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/soundscapes/1/regions/add', { 
                        param: 'test', 
                        bbox: 'bbox'
                    })
                    .respond(200, 'data');
                    
                a2Soundscapes.addRegion(1, 'bbox', { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.sampleRegion', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/soundscapes/1/regions/2/sample', { 
                        param: 'test'
                    })
                    .respond(200, 'data');
                    
                a2Soundscapes.sampleRegion(1, 2, { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRegion', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/regions/2')
                    .respond(200, 'data');
                    
                a2Soundscapes.getRegion(1, 2, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRecordingTags', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/regions/2/tags/3')
                    .respond(200, 'data');
                    
                a2Soundscapes.getRecordingTags(1, 2, 3, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.addRecordingTag', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/soundscapes/1/regions/2/tags/3/add', {
                        tag: 'test-tag'
                    })
                    .respond(200, 'data');
                    
                a2Soundscapes.addRecordingTag(1, 2, 3, 'test-tag', function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.removeRecordingTag', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/soundscapes/1/regions/2/tags/3/remove', {
                        tag: 'test-tag'
                    })
                    .respond(200, 'data');
                    
                a2Soundscapes.removeRecordingTag(1, 2, 3, 'test-tag', function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRegions', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/regions')
                    .respond(200, 'data');
                    
                a2Soundscapes.getRegions(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/regions?param=test')
                    .respond(200, 'data');
                    
                a2Soundscapes.getRegions(1, { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRecordings', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/recordings/foo')
                    .respond(200, 'data');
                    
                a2Soundscapes.getRecordings(1, 'foo', function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/recordings/foo?param=test')
                    .respond(200, 'data');
                    
                a2Soundscapes.getRecordings(1, 'foo', { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.findIndices', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/indices')
                    .respond(200, 'data');
                    
                a2Soundscapes.findIndices(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.delete', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/legacy-api/project/test/soundscapes/1/delete');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Soundscapes.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                a2Soundscapes.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Soundscapes.create', function() {
            var request,
                data;
            
            beforeEach(function() {
                data = {
                    key1: 'value1',
                    key2: 'value2',
                };
                
                request = $httpBackend
                    .expectPOST('/legacy-api/project/test/soundscape/new', data);
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                var result = a2Soundscapes.create(data);
                
                expect(result).to.have.property('success');
                expect(result).to.have.property('error');
                
                $httpBackend.flush();
            });
        });
    });
});
