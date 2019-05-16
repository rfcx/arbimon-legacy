angular.module('a2.citizen-scientist.admin.settings', [
    'a2.services',
    'a2.srv.citizen-scientist-admin',
    'a2.directives',
    'ui.bootstrap',
    'angularFileUpload',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.admin.settings', {
        url: '/settings',
        controller: 'A2CitizenScientistAdminSettingsCtrl as controller',
        templateUrl: '/app/citizen-scientist/admin/settings/index.html'
    });
})
.controller('A2CitizenScientistAdminSettingsCtrl', function($scope, a2CitizenScientistAdminService, a2PatternMatching) {
    this.loadPage = function(){
        this.loading = true;
        a2PatternMatching.list().then((function(data) {
            this.patternmatchings = data;
        }).bind(this));

        a2CitizenScientistAdminService.getSettings().then((function(data){
            this.loading = false;
            this.settings = data;
        }).bind(this));
    };

    this.save = function(){
        this.settings.pattern_matchings = this.patternmatchings.filter(function (pm){
            return pm.citizen_scientist;
        }).map(function (pm){
            return pm.id;
        });

        return a2CitizenScientistAdminService.setSettings(this.settings).then((function(data){
            notify.log("Settings Saved.");
        }).bind(this));

    };

    this.loadPage();
})
;
