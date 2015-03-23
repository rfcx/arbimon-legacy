describe('Module: a2-sites-service', function() {
    beforeEach(function() { 
        module('a2-sites-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Sites', function() { 
        var $httpBackend;
        var a2Sites;
        
        beforeEach(inject(function($injector, _a2Sites_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Sites = _a2Sites_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Sites).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2Sites.listPublished', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/sites/published')
                    .respond(200, '');
                    
                a2Sites.listPublished(function(){});
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.import', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/sites/import', { site: {} })
                    .respond(200, '');
                    
                a2Sites.import({}, function(){});
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.update', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/sites/update', { site: {} })
                    .respond(200, '');
                    
                a2Sites.update({}, function(){});
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.create', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/sites/create', { site: {} })
                    .respond(200, '');
                    
                a2Sites.create({}, function(){});
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.delete', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/sites/delete', { site: {} })
                    .respond(200, '');
                    
                a2Sites.delete({}, function(){});
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.generateToken', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/sites/generate-token', { site: 1 })
                    .respond(200, '');
                    
                a2Sites.generateToken({ id: 1 });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.revokeToken', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/sites/revoke-token', { site: 1 })
                    .respond(200, '');
                    
                a2Sites.revokeToken({ id: 1 });
                
                $httpBackend.flush();
            });
        });
        
    });
});
