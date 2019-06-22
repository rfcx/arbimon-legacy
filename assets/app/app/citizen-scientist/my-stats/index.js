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
                item.group_validated = data.groupStats[index].validated
                item.group_correct = data.groupStats[index].correct
                item.group_incorrect = data.groupStats[index].incorrect
                return item;
            })

            this.overall = data.stats.reduce(function(_, item){
                _.validated += item.validated;
                _.correct += item.correct;
                _.incorrect += item.incorrect;
                _.group_validated += item.group_validated;
                _.group_correct += item.group_correct;
                _.group_incorrect += item.group_incorrect;
                return _;
            }, {
                validated:0, correct:0, incorrect:0,
                group_validated:0, group_correct:0, group_incorrect:0
            });

            // compute overalls
        }).bind(this));
    };

    this.loadPage();
})
;
