/* jshint mocha:true */
/* global module:true */
/* global inject:true */
/* global sinon:true */

describe('Module: a2.srv.sites', function() {
    "use strict";
    
    beforeEach(function() { 
        module('a2.srv.sites');
        module('a2.srv.project');
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
                    .expectGET('/legacy-api/sites/published')
                    .respond(200, 'data');
                    
                a2Sites.listPublished(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.import', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/sites/import', { site: {} })
                    .respond(200, 'data');
                    
                a2Sites.import({}, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.update', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/sites/update', { site: {} })
                    .respond(200, 'data');
                    
                a2Sites.update({}, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.create', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/sites/create', { site: {} })
                    .respond(200, 'data');
                    
                a2Sites.create({}, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.delete', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/sites/delete', { site: {} })
                    .respond(200, 'data');
                    
                a2Sites.delete({}, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.generateToken', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/sites/generate-token', { site: 1 })
                    .respond(200, 'data');
                    
                a2Sites.generateToken({ id: 1 })
                    .success(function(data){
                        expect(data).to.equal('data');
                    });
                
                $httpBackend.flush();
            });
        });
        describe('a2Sites.revokeToken', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/legacy-api/project/test/sites/revoke-token', { site: 1 })
                    .respond(200, 'data');
                    
                a2Sites.revokeToken({ id: 1 })
                    .success(function(data){
                        expect(data).to.equal('data');
                    });
                
                $httpBackend.flush();
            });
        });
        
    });
});
