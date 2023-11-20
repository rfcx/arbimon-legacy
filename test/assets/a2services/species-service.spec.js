/* jshint mocha:true */
/* global module:true */
/* global inject:true */
/* global sinon:true */

describe('Module: a2.srv.species', function() {
    "use strict";
    
    beforeEach(function() { 
        module('a2.srv.species');
    });
        
    describe('Species', function() { 
        var $httpBackend;
        var Species;
        
        beforeEach(inject(function($injector, _Species_) {
            $httpBackend = $injector.get('$httpBackend');
            Species = _Species_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(Species).to.exist;
        });
        /* jshint +W030 */
        
        describe('Species.get', function() {
            it('request to correct route and cache list after first request', function() {
                
                var speciesList = [
                    'species1',
                    'species2',
                    'species3',
                ];
                
                $httpBackend
                    .expectGET('/legacy-api/species/list/100')
                    .respond(200, speciesList);
                    
                Species.get(function(species){
                    expect(species).to.deep.equal(speciesList);
                });
                
                $httpBackend.flush();
                
                //test cache
                Species.get(function(species){
                    expect(species).to.deep.equal(speciesList);
                });
            });
        });
        
        describe('Species.search', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/legacy-api/species/search?q=coqui')
                    .respond(200, 'data');
                    
                Species.search('coqui', function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('Species.findById', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectGET('/legacy-api/species/1')
                    .respond(200, 'data');
                    
                Species.findById(1, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
    });
    
    describe('Songtypes', function() { 
        var $httpBackend;
        var Songtypes;
        var songList;
        
        beforeEach(inject(function($injector, _Songtypes_) {
            $httpBackend = $injector.get('$httpBackend');
            Songtypes = _Songtypes_;
            
            songList = [
                {
                    id: 1,
                    name: "Song 1",
                    description: "Description 1"
                },
                {
                    id: 2,
                    name: "Song 2",
                    description: "Description 2"
                },
                {
                    id: 3,
                    name: "Song 3",
                    description: "Description 3"
                },
            ];
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(Songtypes).to.exist;
        });
        /* jshint +W030 */
        
        describe('Songtypes.get', function() {
            it('request to correct route and cache list after first request', function() {
                
                $httpBackend
                    .expectGET('/legacy-api/songtypes/all')
                    .respond(200, songList);
                    
                Songtypes.get(function(songs){
                    expect(songs).to.deep.equal(songList);
                });
                
                $httpBackend.flush();
                
                //test cache
                Songtypes.get(function(songs){
                    expect(songs).to.deep.equal(songList);
                });
            });
        });
        
        describe('Songtypes.findById', function() {
            it('request to correct route without cache and after return proper data from cache', function() {
                $httpBackend
                    .expectGET('/legacy-api/songtypes/all')
                    .respond(200, songList);
                    
                Songtypes.findById(1, function(songs){
                    expect(songs).to.deep.equal(songList[0]);
                });
                
                $httpBackend.flush();
                
                Songtypes.findById(2, function(songs){
                    expect(songs).to.deep.equal(songList[1]);
                });
            });
        });
    });
});
