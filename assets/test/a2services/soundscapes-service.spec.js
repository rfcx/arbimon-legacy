describe('Module: a2-soundscapes-service', function() {
    beforeEach(function() { 
        module('a2-soundscapes-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Soundscapes', function() { 
        var $httpBackend;
        var a2Soundscapes;
        
        beforeEach(inject(function($injector, _a2Soundscapes_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Soundscapes = _a2Soundscapes_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Soundscapes).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2Soundscapes.get', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1')
                    .respond(200, '');
                    
                a2Soundscapes.get(1, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getSCIdx', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/scidx')
                    .respond(200, '');
                    
                a2Soundscapes.getSCIdx(1, function(){});
                
                $httpBackend.flush();
            });
            
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/scidx?param=test')
                    .respond(200, '');
                    
                a2Soundscapes.getSCIdx(1, { param: 'test'}, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getList', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/')
                    .respond(200, '');
                    
                a2Soundscapes.getList(function(){});
                
                $httpBackend.flush();
            });
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/?param=test')
                    .respond(200, '');
                    
                a2Soundscapes.getList({ param: 'test' }, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.setVisualScale', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/soundscapes/1/scale', { param: 'test' })
                    .respond(200, '');
                    
                a2Soundscapes.setVisualScale(1, { param: 'test' }, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.addRegion', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/soundscapes/1/regions/add', { 
                        param: 'test', 
                        bbox: 'bbox'
                    })
                    .respond(200, '');
                    
                a2Soundscapes.addRegion(1, 'bbox', { param: 'test' }, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.sampleRegion', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/soundscapes/1/regions/2/sample', { 
                        param: 'test'
                    })
                    .respond(200, '');
                    
                a2Soundscapes.sampleRegion(1, 2, { param: 'test' }, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRegion', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/regions/2')
                    .respond(200, '');
                    
                a2Soundscapes.getRegion(1, 2, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRecordingTags', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/regions/2/tags/3')
                    .respond(200, '');
                    
                a2Soundscapes.getRecordingTags(1, 2, 3, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.addRecordingTag', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/soundscapes/1/regions/2/tags/3/add', {
                        tag: 'test-tag'
                    })
                    .respond(200, '');
                    
                a2Soundscapes.addRecordingTag(1, 2, 3, 'test-tag', function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.removeRecordingTag', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/soundscapes/1/regions/2/tags/3/remove', {
                        tag: 'test-tag'
                    })
                    .respond(200, '');
                    
                a2Soundscapes.removeRecordingTag(1, 2, 3, 'test-tag', function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRegions', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/regions')
                    .respond(200, '');
                    
                a2Soundscapes.getRegions(1, function(){});
                
                $httpBackend.flush();
            });
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/regions?param=test')
                    .respond(200, '');
                    
                a2Soundscapes.getRegions(1, { param: 'test' }, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.getRecordings', function() {
            it('request to correct route without params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/recordings/foo')
                    .respond(200, '');
                    
                a2Soundscapes.getRecordings(1, 'foo', function(){});
                
                $httpBackend.flush();
            });
            it('request to correct route with params', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/recordings/foo?param=test')
                    .respond(200, '');
                    
                a2Soundscapes.getRecordings(1, 'foo', { param: 'test' }, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Soundscapes.findIndices', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/api/project/test/soundscapes/1/indices')
                    .respond(200, '');
                    
                a2Soundscapes.findIndices({ id: 1 }, function(){});
                
                $httpBackend.flush();
            });
        });
    });
});
