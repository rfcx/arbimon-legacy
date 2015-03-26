describe('Module: a2-classi-service', function() {
    beforeEach(function() { 
        module('a2-classi-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Classi', function() { 
        var $httpBackend;
        var a2Classi;
        
        beforeEach(inject(function($injector, _a2Classi_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Classi = _a2Classi_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Classi).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2Classi.list', function() {
            
        });
    });
});
