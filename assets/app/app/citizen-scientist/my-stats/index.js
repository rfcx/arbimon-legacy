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
            var vars=['validated', 'consensus', 'non_consensus', 'pending', 'reached_th'];

            this.stats = data.stats.map(function(item, index) {
                vars.forEach(function(_var) {
                    item['group_' + _var] = data.groupStats[index][_var];
                });
                return item;
            });


            this.overall = data.stats.reduce(function(_, item){
                vars.forEach(function(_var) {
                    _[_var] += item[_var];
                    _['group_' + _var] += item['group_' + _var];
                });
                return _;
            }, vars.reduce(function(__, _var) {
                __[_var] = 0;
                __['group_' + _var] = 0;
                return __;
            }, {}));

            // compute overalls
        }).bind(this));
    };

    this.loadPage();
})
;
