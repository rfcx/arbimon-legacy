describe('Module: a2-project-service', function() {
    beforeEach(function() { 
        module('a2-project-service');
    });
        
    describe('Project', function() {
        var $httpBackend;
        var Project;
        
        beforeEach(inject(function($injector, $location) {
            $httpBackend = $injector.get('$httpBackend');
            $location.path('/project/test');
        }));
        
        beforeEach(inject(function(_Project_) {
            Project = _Project_;
        }));
        
        afterEach(function() {
            $httpBackend.verifyNoOutstandingExpectation();
            $httpBackend.verifyNoOutstandingRequest();
        });
        
        /* jshint -W030 */
        it('should exist', function() {
            expect(Project).to.exist;
        });
        /* jshint +W030 */
        
        describe('Project.getUrl', function() {
            it('getUrl should return "test"', function() {
                expect(Project.getUrl()).to.equal('test');
            });
        });
        
        describe('Project.getInfo', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/info')
                    .respond(200, '');
                    
                Project.getInfo(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.updateInfo', function() {
            it('request to correct route', function() {
                $httpBackend
                    .expectPOST('/api/project/test/info/update', {})
                    .respond(200, '');
                
                Project.updateInfo({}, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getSites', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/sites')
                    .respond(200, '');
                    
                Project.getSites(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getClasses', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/classes')
                    .respond(200, '');
                    
                Project.getClasses(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getRecs', function() {
            it('request to correct route with no query', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/search')
                    .respond(200, '');
                    
                Project.getRecs(function(){});
                
                $httpBackend.flush();
            });
            
            it('request to correct route with query', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/search?limit=10&offset=0&output=count&sites=test+site')
                    .respond(200, '');
                    
                Project.getRecs({
                    limit: 10,
                    offset: 0,
                    output: 'count',
                    sites: ['test site']
                },function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getRecTotalQty', function() {
            it('request to correct route and return count', function() {
                $httpBackend
                    .expectGET('/api/project/test/recordings/count')
                    .respond(200, { count: 100 });
                    
                Project.getRecTotalQty(function(count){
                    expect(count).to.equal(100);
                });
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getRecordings', function() {
            it('request to correct route with no query and no options', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/')
                    .respond(200, '');
                
                Project.getRecordings('', function(){});
                
                $httpBackend.flush();
            });
            
            it('request to correct route with query and no options', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/test-2014-4-8')
                    .respond(200, '');
                
                var key = 'test-2014-4-8';
                Project.getRecordings(key, function(){});
                
                $httpBackend.flush();
            });
            
            it('request to correct route with query and options', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/test-2014-4-8?show=thumbnail-path')
                    .respond(200, '');
                
                var key = 'test-2014-4-8';
                var options = {
                    show:'thumbnail-path'
                };
                Project.getRecordings(key, options, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getRecordingAvailability', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/available/test-2014-4-8')
                    .respond(200, '');
                
                var key = 'test-2014-4-8';
                Project.getRecordingAvailability(key, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getOneRecording', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/find/1')
                    .respond(200, '');
                
                Project.getOneRecording(1, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getRecordingInfo', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/info/1')
                    .respond(200, '');
                
                Project.getRecordingInfo(1, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getNextRecording', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/next/1')
                    .respond(200, '');
                
                Project.getNextRecording(1, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getPreviousRecording', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/previous/1')
                    .respond(200, '');
                
                Project.getPreviousRecording(1, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.validateRecording', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectPOST('/api/project/test/recordings/validate/1')
                    .respond(200, '');
                    
                var validation = {
                    class: "1-1",
                    val: 2
                };
                Project.validateRecording(1, validation, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.recExists', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/recordings/exists/site/1/file/recorder-2015-01-01_00-00')
                    .respond(200, '');
                
                Project.recExists(1, 'recorder-2015-01-01_00-00', function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.addClass', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectPOST('/api/project/test/class/add', {})
                    .respond(200, '');
                
                Project.addClass({}, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.removeClasses', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectPOST('/api/project/test/class/del', [{}])
                    .respond(200, '');
                
                Project.removeClasses([{}], function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getUsers', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/users')
                    .respond(200, '');
                
                Project.getUsers(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getRoles', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/roles')
                    .respond(200, '');
                
                Project.getRoles(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.addUser', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectPOST('/api/project/test/user/add', {})
                    .respond(200, '');
                
                var userData = {};
                Project.addUser(userData, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.delUser', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectPOST('/api/project/test/user/del', {})
                    .respond(200, '');
                
                var userData = {};
                Project.delUser(userData, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.changeUserRole', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectPOST('/api/project/test/user/role', {})
                    .respond(200, '');
                
                var userData = {};
                Project.changeUserRole(userData, function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getModels', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/models')
                    .respond(200, '');
                
                Project.getModels(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.getClassi', function() {
            it('request to correct route', function() {
                
                $httpBackend
                    .expectGET('/api/project/test/classifications')
                    .respond(200, '');
                
                Project.getClassi(function(){});
                
                $httpBackend.flush();
            });
        });
        
        describe('Project.validationsCount', function() {
            it('request to correct route and return count', function() {
                $httpBackend
                    .expectGET('/api/project/test/validations/count')
                    .respond(200, { count: 100 });
                    
                Project.validationsCount(function(count){
                    expect(count).to.equal(100);
                });
                
                $httpBackend.flush();
            });
        });
    });
    
});
