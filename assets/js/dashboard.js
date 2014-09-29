angular.module('dashboard',['a2services'])
.controller('TestCtrl', function($scope, ProjectInfo) {
    ProjectInfo.get(function(info){
         $scope.data = info
    });
});
