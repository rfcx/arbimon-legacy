angular.module('a2.home', [
    'templates-arbimon2', 
    'ui.bootstrap', 
    'a2.utils', 
    'a2.forms',
    'a2.orders',
    'a2.login',
    'humane',
    'angularytics', 
])
.config(function(AngularyticsProvider) {
        AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
})
.run(function(Angularytics) {
    Angularytics.init();
})
.controller('HomeCtrl', function($scope, $http, $modal, notify, a2order) {
    
    $scope.loadProjectList = function() {
        $http.get('/api/user/projectlist')
        .success(function(data) {
            $scope.projects = data;
        });
    };
    $scope.loadNewsPage = function() {
        $http.get('/api/user/feed/'+ nextNewsPage)
            .success(function(data) {
                $scope.newsFeed = $scope.newsFeed.concat(data);
                nextNewsPage++;
            });
    };
    $scope.displayTime = function(d) {
        return moment(d).fromNow();
    };
        
    $scope.createProject = function() {
        var modalInstance = a2order.createProject({});
        
        modalInstance.result.then(function(message) {
            notify.log(message);
            $scope.loadProjectList();
        });
    };
    
    
    $scope.currentPage = 1;
    $scope.isAnonymousGuest = true;
    var nextNewsPage = 0;
    $scope.newsFeed = [];
    $scope.loadProjectList();
    $scope.loadNewsPage();
    
    $http.get('/api/user/info')
        .success(function(data) {
            $scope.isAnonymousGuest = data.isAnonymousGuest;
        });
})

;
