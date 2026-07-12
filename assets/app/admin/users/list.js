angular.module('a2.admin.users.list', [
    'ui.router', 
    'ui.bootstrap', 
    'a2.utils',
    'a2.services',
    'templates-arbimon2',
    'humane',
    'ui.select',
])
// .config(function($stateProvider, $urlRouterProvider) {
//     $stateProvider
//         .state('users.list', {
//             url: '',
//             controller:'AdminUsersListCtrl',
//             templateUrl: '/admin/users/list.html'
//         });
// 
// })
// .controller('AdminUsersCtrl', function($scope, $http) {
//     $http.get('/admin/users')
//         .success(function(data) {
//             $scope.users = data;
//         });
// })
.service('AdminUsersListService', function($http){
    return {
        getList : function() {
            // Trailing slash REQUIRED (2026-07-12): exact /admin/users now routes to
            // the modern Vue admin page at the edge; JSON API uses /admin/users/.
            return $http.get('/admin/users/').then(function(response){
                return response.data;
            });
        },
    };
})
;
