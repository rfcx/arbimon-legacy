
angular.module('a2.citizen-scientist.admin.user-stats', [
    'a2.services',
    'a2.srv.citizen-scientist-admin',
    'a2.directives',
    'ui.bootstrap',
    'angularFileUpload',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.admin.user-stats', {
        url: '/user-stats',
        controller: 'A2CitizenScientistAdminUserStatsCtrl as controller',
        templateUrl: '/app/citizen-scientist/admin/user-stats/index.html'
    });
})
.controller('A2CitizenScientistAdminUserStatsCtrl', function($scope, a2CitizenScientistAdminService) {
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistAdminService.getUserStats().then((function(data){
            this.loading = false;
            this.list = data.list;
            this.count = data.count;
        }).bind(this));
    };

    this.loadPage();
})
;
