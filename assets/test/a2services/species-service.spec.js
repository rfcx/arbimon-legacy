describe('Module: a2-species-service', function() {
    beforeEach(function() { 
        module('a2-species-service');
    });
        
    describe('Species', function() { 
        var $httpBackend;
        var a2Soundscapes;
        
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
                    .expectGET('/api/species/list/100')
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
                    .expectGET('/api/species/search?q=coqui')
                    .respond(200, '');
                    
                Species.search('coqui', function(){});
                
                $httpBackend.flush();
            });
        });
    });
    
    describe('Songtypes', function() { 
        var $httpBackend;
        var a2Soundscapes;
        
        beforeEach(inject(function($injector, _Songtypes_) {
            $httpBackend = $injector.get('$httpBackend');
            Songtypes = _Songtypes_;
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
                
                var songList = [
                    'songtype1',
                    'songtype2',
                    'songtype3',
                ];
                
                $httpBackend
                    .expectGET('/api/songtypes/all')
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
    });
});
