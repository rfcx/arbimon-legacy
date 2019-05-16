angular.module('a2.citizen-scientist.admin.user-stats', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.srv.citizen-scientist-admin',
    'angularFileUpload',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.admin.user-stats', {
        url: '/user-stats/:userId?',
        controller: 'A2CitizenScientistAdminUserStatsCtrl as controller',
        templateUrl: '/app/citizen-scientist/admin/user-stats/index.html'
    });
})
.controller('A2CitizenScientistAdminUserStatsCtrl', function($scope, a2CitizenScientistAdminService, $stateParams, $state, Users) {
    this.setUser = function(userId){
        this.userId = userId;
        $state.transitionTo($state.current.name, {
            userId: userId,
        }, {notify:false});
        if (this.userId){
            this.loadForUser();
        }
    };
    this.userId = $stateParams.userId;
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistAdminService.getUserStats().then((function(data){
            this.loading = false;
            this.stats = data.stats;
        }).bind(this));
    };

    this.loadForUser = function(){
        this.loadingForUser = true;
        User.findById(this.userId).then((function(user){
            this.user = user;
        }).bind(this))
        a2CitizenScientistAdminService.getUserStats(this.userId).then((function(data){
            this.loadingForUser = false;
            this.userStats = data.stats;
        }).bind(this));
    };


    this.loadPage();
    if (this.userId){
        this.loadForUser();
    }
})
;
