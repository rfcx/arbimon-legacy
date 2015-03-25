describe('Module: a2-playlists-service', function() {
    beforeEach(function() { 
        module('a2-playlists-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Playlists', function() { 
        var $httpBackend;
        var a2Sites;
        
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
                    .expectGET('/api/project/test/playlists/')
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
                    .expectPOST('/api/project/test/playlists/create', params)
                    .respond(200, 'data');
                    
                a2Playlists.create(params, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Playlists.getPreviousRecording', function() {
            it('requests to the correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/playlists/1/2/previous')
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
                    .expectGET('/api/project/test/playlists/1/2/next')
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
                    .expectPOST('/api/project/test/playlists/rename', params)
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
                    .expectPOST('/api/project/test/playlists/delete', { playlists: params })
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
                    .expectGET('/api/project/test/playlists/info/1')
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
                    .expectGET('/api/project/test/playlists/1?param=test')
                    .respond(200, 'data');
                    
                a2Playlists.getData(1, { param: 'test' }, function(data){
                    expect(data).to.equal('data');
                });
                
                $httpBackend.flush();
            });
        });
    });
});
