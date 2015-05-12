describe('Module: a2-models-service', function() {
    beforeEach(function() { 
        module('a2-models-service');
        module('a2-project-service');
        module('a2-project-service-mock');
    });
        
    describe('a2Models', function() { 
        var $httpBackend;
        var a2Models;
        var notifyError;
        
        beforeEach(inject(function($injector, notify, _a2Models_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Models = _a2Models_;
            notifyError = sinon.spy(notify, 'serverError');
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
            notifyError.restore();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(a2Models).to.exist;
        });
        /* jshint +W030 */
        
        describe('a2Models.list', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/models');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Models.list(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Models.list(callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Models.getFormInfo', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/models/forminfo');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Models.getFormInfo(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Models.getFormInfo(callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Models.findById', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/models/1');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Models.findById(1)
                    .success(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                errorCallback = sinon.spy();
                
                a2Models.findById(1)
                    .success(callback)
                    .error(errorCallback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(errorCallback.calledOnce);
            });
        });
        
        describe('a2Models.create', function() {
            var request, 
                modelData;
            
            beforeEach(function() {
                modelData = {
                    key1: 'value1',
                    key2: 'value2',
                };
                
                request = $httpBackend
                    .expectPOST('/api/project/test/models/new', modelData);
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                var result = a2Models.create(modelData);
                
                expect(result).to.have.property('success');
                expect(result).to.have.property('error');
                
                $httpBackend.flush();
            });
        });
        
        describe('a2Models.delete', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/models/1/delete');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Models.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Models.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Models.getValidationResults', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectGET('/api/project/test/models/1/validation-list/');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                callback = sinon.spy();
                
                a2Models.getValidationResults(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                callback = sinon.spy();
                
                a2Models.getValidationResults(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Models.setThreshold', function() {
            var request;
            
            beforeEach(function() {
                request = $httpBackend
                    .expectPOST('/api/project/test/models/savethreshold', { m: 1, t: 2 });
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                var result = a2Models.setThreshold(1, 2);
                
                expect(result).to.have.property('success');
                expect(result).to.have.property('error');
                
                $httpBackend.flush();
            });
        });
    });
});
