/* jshint mocha:true */
/* global module:true */
/* global inject:true */
/* global sinon:true */

describe('Module: a2.srv.classi', function() {
    "use strict";
    
    beforeEach(function() { 
        module('a2.srv.classi');
        module('a2.srv.project');
        module('a2-project-service-mock');
    });
        
    describe('a2Classi', function() { 
        var $httpBackend;
        var notifyError;
        var a2Classi;
        var callback;
        
        beforeEach(inject(function($injector, notify, _a2Classi_) {
            $httpBackend = $injector.get('$httpBackend');
            a2Classi = _a2Classi_;
            notifyError = sinon.spy(notify, 'serverError');
            callback = sinon.spy();
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
                    .expectGET('/legacy-api/project/test/classifications');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                
                
                a2Classi.list(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
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
                    .expectGET('/legacy-api/project/test/classifications/1');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Classi.getDetails(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
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
                    .expectGET('/legacy-api/project/test/classifications/1/more/2/3');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Classi.getResultDetails(1, 2, 3, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                a2Classi.getResultDetails(1, 2, 3, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce);
            });
        });
        
        describe('a2Classi.getRecVector', function() {
            var request;
            var classificationId;
            var recId;
                
            beforeEach(function() {
                classificationId = 1;
                recId = 2;
                
                request = $httpBackend
                    .expectGET('/legacy-api/project/test/classifications/'+classificationId+'/vector/'+recId);
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Classi.getRecVector(classificationId, recId)
                    .success(callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                var errorCallback = sinon.spy();
                
                a2Classi.getRecVector(classificationId, recId)
                    .success(callback)
                    .error(errorCallback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(errorCallback.calledOnce);
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
                    .expectPOST('/legacy-api/project/test/classifications/new', classiData);
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Classi.create(classiData, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
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
                    .expectGET('/legacy-api/project/test/classifications/1/delete');
            });
            
            it('requests to the correct route and call success', function() {
                request.respond(200, 'data');
                
                a2Classi.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.calledWith('data')).to.equal(true);
            });
            
            it('requests to the correct route and call error', function() {
                request.respond(500, 'data');
                
                a2Classi.delete(1, callback);
                
                $httpBackend.flush();
                
                expect(callback.called).to.equal(false);
                expect(notifyError.calledOnce).to.equal(true);
            });
        });
    });
});
