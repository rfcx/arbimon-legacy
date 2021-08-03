angular.module('a2.admin', [
    'a2.directives',
    'a2.admin.dashboard',
    'a2.admin.projects',
    'a2.admin.jobs',
    'a2.directive.search-bar'
])
.controller('AdminCtrl', function($scope, $state){
    $scope.$state = $state;

});
