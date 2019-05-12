angular.module('a2.citizen-scientist.admin.classification-stats', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.srv.citizen-scientist-admin',
    'angularFileUpload',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.admin.classification-stats', {
        url: '/classification-stats',
        controller: 'A2CitizenScientistAdminClassificationStatsCtrl as controller',
        templateUrl: '/app/citizen-scientist/admin/classification-stats/index.html'
    });
})
.controller('A2CitizenScientistAdminClassificationStatsCtrl', function($scope, a2CitizenScientistAdminService) {
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistAdminService.getClassificationStats().then((function(data){
            this.loading = false;
            this.stats = data.stats;
        }).bind(this));
    };

    this.loadPage();
})
;
