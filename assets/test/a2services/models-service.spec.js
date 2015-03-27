describe('Module: a2-models-service', function() {
    beforeEach(function() { 
        module('a2-models-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Models', function() { 
        var $httpBackend;
        var a2Models;
        
        beforeEach(inject(function($injector, notify, _a2Models_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Models = _a2Models_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Models).to.exist;
        });
        /* jshint +W030 */
    });
});
