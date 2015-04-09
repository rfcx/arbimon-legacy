angular.module('home', ['templates-arbimon2', 'ui.bootstrap', 'a2utils', 'humane','angularytics', 'a2forms'])
.config(function(AngularyticsProvider) {
        AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
})
.run(function(Angularytics) {
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
        $scope.create = function() {
            if(!$scope.isValid) return;
            
            console.log('create');
            
            $http.post('/api/project/create', { project: $scope.project })
            .success(function(data) {
                if(!data.error)
                    $modalInstance.close(data.message);
                    
                if(data.projectLimit) {
                    $modalInstance.dismiss();
                    notify.error('You have reached project limit, '+
                                'could not create new project. '+
                                'Contact us if you want to change the project limit');
                }
                
                if(data.nameExists) {
                    notify.error('Name <b>'+$scope.project.name+'</b> not available');
                }
                if(data.urlExists) {
                    notify.error('URL <b>'+$scope.project.url+'</b> taken choose another one');
                }
                
            })
            .error(function(err) {
                notify.serverError();
            });
        };
    })
;
