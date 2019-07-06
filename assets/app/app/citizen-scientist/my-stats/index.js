angular.module('a2.citizen-scientist.my-stats', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.srv.citizen-scientist-admin',
    'angularFileUpload',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.my-stats', {
        url: '/my-stats',
        controller: 'A2CitizenScientistMyStatsCtrl as controller',
        templateUrl: '/app/citizen-scientist/my-stats/index.html'
    });
})
.controller('A2CitizenScientistMyStatsCtrl', function($scope, a2CitizenScientistService, $stateParams, $state, Users) {
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistService.getMyStats().then((function(data){
            this.loading = false;
            this.stats = data.stats.map(function(item, index) {
                item.group_validated = data.groupStats[index].validated;
                item.group_consensus = data.groupStats[index].consensus;
                item.group_non_consensus = data.groupStats[index].non_consensus;
                return item;
            })

            this.overall = data.stats.reduce(function(_, item){
                _.validated += item.validated;
                _.consensus += item.consensus;
                _.non_consensus += item.non_consensus;
                _.group_validated += item.group_validated;
                _.group_consensus += item.group_consensus;
                _.group_non_consensus += item.group_non_consensus;
                return _;
            }, {
                validated:0, consensus:0, non_consensus:0,
                group_validated:0, group_consensus:0, group_non_consensus:0
            });

            // compute overalls
        }).bind(this));
    };

    this.loadPage();
})
;
