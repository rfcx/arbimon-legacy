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
.controller('A2CitizenScientistAdminSettingsCtrl', function($scope, a2CitizenScientistAdminService) {
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistAdminService.getSettings().then((function(data){
            this.loading = false;
            this.patternmatchings = data;
        }).bind(this));
    };

    this.save = function(){
        var settings = this.patternmatchings.filter(function (pm){
            return pm.citizen_scientist;
        }).map(function (pm){
            return {id: pm.id, consensus_number: pm.consensus_number};
        });

        return a2CitizenScientistAdminService.setSettings(settings).then((function(data){
            notify.log("Settings Saved.");
        }).bind(this));
    };

    this.loadPage();
})
;
