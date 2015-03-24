describe('Module: a2-soundscapes-service', function() {
    beforeEach(function() { 
        module('a2-soundscapes-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Soundscapes', function() { 
        var $httpBackend;
        var a2Sites;
        
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
            
        });
        
        describe('a2Soundscapes.getSCIdx', function() {
            
        });
        
        describe('a2Soundscapes.getList', function() {
            
        });
        
        describe('a2Soundscapes.setVisualScale', function() {
            
        });
        
        describe('a2Soundscapes.addRegion', function() {
            
        });
        
        describe('a2Soundscapes.sampleRegion', function() {
            
        });
        
        describe('a2Soundscapes.getRegion', function() {
            
        });
        
        describe('a2Soundscapes.getRecordingTags', function() {
            
        });
        
        describe('a2Soundscapes.addRecordingTag', function() {
            
        });
        
        describe('a2Soundscapes.removeRecordingTag', function() {
            
        });
        
        describe('a2Soundscapes.getRegions', function() {
            
        });
        
        describe('a2Soundscapes.getRecordings', function() {
            
        });
        
        describe('a2Soundscapes.findIndices', function() {
            
        });
    });
});
