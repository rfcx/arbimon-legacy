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
.controller('A2CitizenScientistAdminSettingsCtrl', function($scope, a2CitizenScientistAdminService, notify) {
    this.loadPage = function(){
        this.loading = true;
        a2CitizenScientistAdminService.getSettings().then((function(data){
            this.loading = false;
            this.patternmatchings = data;
        }).bind(this));
    };

    this.save = function(){
        this.saving = true;
        var settings = this.patternmatchings.filter(function (pm){
            return pm.citizen_scientist || pm.cs_expert;
        }).map(function (pm){
            return {
                id: pm.id,
                consensus_number: pm.consensus_number,
                citizen_scientist: pm.citizen_scientist,
                cs_expert: pm.cs_expert,
            };
        });

        return a2CitizenScientistAdminService.setSettings(settings)
            .then((function(data){
                this.saving = false;
                notify.log("Settings Saved.");
            }).bind(this))
            .catch((function () {
                this.saving = false;
                notify.error("An error occured.");
            }).bind(this));
    };

    this.loadPage();
})
;
