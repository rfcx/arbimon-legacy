describe('Module: a2-classi-service', function() {
    beforeEach(function() { 
        module('a2-classi-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Classi', function() { 
        var $httpBackend;
        var notifyError;
        var a2Classi;
        
        beforeEach(inject(function($injector, notify, _a2Classi_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Classi = _a2Classi_;
            notifyError = sinon.spy(notify, 'error');
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
            notifyError.restore();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Classi).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2Classi.list', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/classifications');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Classi.list(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Classi.list(callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Classi.getDetails', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/classification/1');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Classi.getDetails(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Classi.getDetails(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Classi.getResultDetails', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/classification/1/more/2/3');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Classi.getResultDetails(1, 2, 3, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Classi.getResultDetails(1, 2, 3, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Classi.getRecVector', function() {
            var request;
            var vectorUri;
            
            beforeEach(function() {
                vectorUri = "some-uri";
                
                request = $httpBackend
                    .expectPOST('/api/project/test/classification/vector', { v: vectorUri });
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Classi.getRecVector(vectorUri, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Classi.getRecVector(vectorUri, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Classi.create', function() {
            var request;
            var classiData;
            
            beforeEach(function() {
                classiData = {
                    key1: 'value1',
                    key2: 'value2',
                };
                
                request = $httpBackend
                    .expectPOST('/api/project/test/classification/new', classiData);
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Classi.create(classiData, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Classi.create(classiData, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Classi.delete', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/classification/1/delete');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Classi.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Classi.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
    });
});
