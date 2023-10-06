/* jshint mocha:true */
/* global module:true */
/* global inject:true */
/* global sinon:true */

describe('Module: a2.srv.training-sets', function() {
    "use strict";
    
    beforeEach(function() { 
        module('a2.srv.training-sets');
        module('a2.srv.project');
        module('a2-project-service-mock');
    });
        
    describe('a2TrainingSets', function() { 
        var $httpBackend;
        var a2TrainingSets;
        
        beforeEach(inject(function($injector, _a2TrainingSets_) {
            $httpBackend = $injector.get('$httpBackend');
            a2TrainingSets = _a2TrainingSets_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2TrainingSets).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2TrainingSets.getList', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets')
                    .respond(200, 'data');
                    
                a2TrainingSets.getList(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.add', function() {
            it('requests to the correct route', function() {
                
                var formData = {
                    key1: 'value1',
                };
                
                $httpBackend
                    .expectPOST('/legacy-api/project/test/training-sets/add', formData)
                    .respond(200, 'data');
                    
                a2TrainingSets.add(formData, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.addData', function() {
            it('requests to the correct route', function() {
                
                var formData = {
                    key1: 'value1',
                };
                
                $httpBackend
                    .expectPOST('/legacy-api/project/test/training-sets/add-data/1', formData)
                    .respond(200, 'data');
                    
                a2TrainingSets.addData(1, formData, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.getData', function() {
            it('requests to the correct route without recording_uri', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/list/1/')
                    .respond(200, 'data');
                    
                a2TrainingSets.getData(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
            
            it('requests to the correct route with recording_uri', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/list/1/some-uri')
                    .respond(200, 'data');
                    
                a2TrainingSets.getData(1, 'some-uri', function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.getDataImage', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/data/1/get-image/2')
                    .respond(200, 'data');
                    
                a2TrainingSets.getDataImage(1, 2, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.getTypes', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/types')
                    .respond(200, 'data');
                    
                a2TrainingSets.getTypes(function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.getRois', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/rois/1')
                    .respond(200, 'data');
                    
                a2TrainingSets.getRois(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.getSpecies', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/species/1')
                    .respond(200, 'data');
                    
                a2TrainingSets.getSpecies(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2TrainingSets.removeRoi', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/project/test/training-sets/1/remove-roi/2')
                    .respond(200, 'data');
                    
                a2TrainingSets.removeRoi(1, 2, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        
    });
});
