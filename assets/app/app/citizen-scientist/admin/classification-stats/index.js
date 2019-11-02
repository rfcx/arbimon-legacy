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
        url: '/classification-stats/:speciesId?',
        controller: 'A2CitizenScientistAdminClassificationStatsCtrl as controller',
        templateUrl: '/app/citizen-scientist/admin/classification-stats/index.html'
    });
})
.controller('A2CitizenScientistAdminClassificationStatsCtrl', function($scope, a2CitizenScientistAdminService, $stateParams, $state, Species) {
    this.setSpecies = function(speciesId){
        this.speciesId = speciesId;
        $state.transitionTo($state.current.name, {
            speciesId: speciesId,
        }, {notify:false});
        if (this.speciesId){
            this.loadForSpecies();
        }
    };
    this.speciesId = $stateParams.speciesId;
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistAdminService.getClassificationStats().then((function(data){
            this.loading = false;
            this.stats = data.stats;
        }).bind(this));
    };

    this.loadForSpecies = function(){
        this.loadingForSpecies = true;
        Species.findById(this.speciesId).then((function(species){
            this.species = species;
        }).bind(this))
        a2CitizenScientistAdminService.getClassificationStats(this.speciesId).then((function(data){
            this.loadingForSpecies = false;
            this.speciesStats = data.stats;
        }).bind(this));
    };

    this.patternMatchingExportUrl = function(row, per_user){
        return a2CitizenScientistAdminService.getCSExportUrl(row.pattern_matching_id, per_user);
    }


    this.loadPage();
    if (this.speciesId){
        this.loadForSpecies();
    }
})
;
