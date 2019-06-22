angular.module('a2.srv.citizen-scientist-admin', [
    'a2.srv.api',
])
.factory('a2CitizenScientistAdminService',function(a2APIService, Project, notify){
    return {
        getClassificationStats: function(speciesId){
            return a2APIService.get('/citizen-scientist/stats/classification' + (speciesId ? '/' + speciesId : '')).catch(notify.serverError);
        },
        getUserStats: function(userId){
            return a2APIService.get('/citizen-scientist/stats/user' + (userId ? '/' + userId : '')).catch(notify.serverError);
        },
        getCSExportUrl: function(pattern_matching_id){
            return '/api/project/' + Project.getUrl() + '/citizen-scientist/pattern-matchings/' + (pattern_matching_id) + '/export.csv';
        },
        getSettings: function(){
            return a2APIService.get('/citizen-scientist/settings').catch(notify.serverError);
        },
        setSettings: function(settings){
            return a2APIService.post('/citizen-scientist/settings', settings).catch(notify.serverError);
        },
    };
})
;
