angular.module('home', ['templates-arbimon2', 'ui.bootstrap', 'a2utils', 'humane','angularytics']).
config(function(AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
}).
run(function(Angularytics) {
    Angularytics.init();
})
.controller('HomeCtrl', function($scope, $http, $modal, notify) {
    
    $scope.currentPage = 1;
    
    $scope.loadProjectList = function() {
        $http.get('api/user/projectlist')
        .success(function(data) {
            $scope.projects = data;
        });
    };
    
    $scope.loadProjectList();
    
    var nextNewsPage = 0;
    $scope.newsFeed = [];
    
    $scope.loadNewsPage = function() {
        $http.get('api/user/feed/'+ nextNewsPage)
        .success(function(data) {
            $scope.newsFeed = $scope.newsFeed.concat(data);
            nextNewsPage++;
        });
    };
    
    $scope.loadNewsPage();
    
    $scope.displayTime = function(d) {
        return moment(d).fromNow();
    };
        
    $scope.createProject = function() {
        var modalInstance = $modal.open({
            templateUrl: '/partials/home/create-project.html',
            controller: 'CreateProjectCtrl'
        });
        
        modalInstance.result.then(function(message) {
            notify.log(message);
            $scope.loadProjectList();
        });
    };
})
.controller('CreateProjectCtrl', function($scope, $http, $modalInstance, notify) {
    
    $scope.errors = [];
    
    $scope.project = {
        is_private: 0
    };
    
    $scope.testName = function() {
        if(!$scope.project.name) return;
        
        var nameRe = /[\w\d]+(\s?[\w\d]+)*/;
        
        if(
            nameRe.exec($scope.project.name) === null || 
            nameRe.exec($scope.project.name)[0] !== $scope.project.name
        )
            $scope.error_name = true;
        else
            $scope.error_name = false;
            
    };
    
    $scope.testUrl = function() {
        if(!$scope.project.url) return;
        
        var urlRe = /[a-z0-9]+((-{1}|_{1})?[a-z0-9]+)+/;
        
        if(
            urlRe.exec($scope.project.url) === null
            || (urlRe.exec($scope.project.url)[0] !== $scope.project.url)
        )
            $scope.error_url = true;
        else
            $scope.error_url = false;
    };
    
    
    $scope.verify = function () {
        var good = true;
        
        
        if($scope.error_name) {
            $scope.errors.push({ 
                type: 'danger', 
                msg: 'Invalid project name only space, _, - and alphanumeric characters' 
            });
            good = false;
        }
        if($scope.error_url) {
            $scope.errors.push({ 
                type: 'danger', 
                msg: 'Invalid project URL alphanumeric characters separated by - or _' 
            });
            good = false;
        }
                
        if(!$scope.project.name) {
            $scope.error_name = true;
            good = false;          
        }
        
        if(!$scope.project.url) {
            $scope.error_url = true;
            good = false;
        }
               
        
        if(!$scope.project.description) {
            $scope.error_description = true;
            good = false;
        }
        
        
        if($scope.project.description && $scope.project.description.length < 80) {
            $scope.error_description = true;
            $scope.errors.push({ 
                type: 'danger', 
                msg: 'Description needs to be at least 80 characters long, you got ' + $scope.project.description.length
            });
            good = false;
        }
        
        if(good) {
            $http.post('/api/project/create', { project: $scope.project })
            .success(function(data) {
                if(!data.error)
                    $modalInstance.close(data.message);
                    
                if(data.projectLimit) {
                    $modalInstance.dismiss();
                    notify.error('You have reached project limit, can not create new project');
                }
                
                if(data.nameExists) {
                    $scope.errors.push({ 
                        type: 'danger', 
                        msg: 'Name taken choose another one'
                    });
                    $scope.error_name = true;
                }
                if(data.urlExists) {
                    $scope.errors.push({ 
                        type: 'danger', 
                        msg: 'URL taken choose another one'
                    });
                    $scope.error_url = true;
                }
                
            })
            .error(function(err) {
                notify.error('Error Communicating with Server');           
            });
        }
    };
    
    $scope.closeAlert = function(index) {
        $scope.errors.splice(index, 1);
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
})
;
