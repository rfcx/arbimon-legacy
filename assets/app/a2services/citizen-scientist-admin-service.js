angular.module('a2.srv.citizen-scientist-admin', [
    'a2.srv.api',
])
.factory('a2CitizenScientistAdminService',function(a2APIService, notify){
    return {
        getClassificationStats: function(speciesId){
            return a2APIService.get('/citizen-scientist/stats/classification' + (speciesId ? '/' + speciesId : '')).catch(notify.serverError);
        },
        getUserStats: function(userId){
            return a2APIService.get('/citizen-scientist/stats/user' + (userId ? '/' + userId : '')).catch(notify.serverError);
        },
        getSettings: function(){
            return a2APIService.get('/citizen-scientist/settings').catch(notify.serverError);
        },
    };
})
;
