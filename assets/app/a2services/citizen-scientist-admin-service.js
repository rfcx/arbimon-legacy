angular.module('a2.srv.citizen-scientist-admin', [
    'a2.srv.api',
])
.factory('a2CitizenScientistAdminService',function(a2APIService){
    return {
        getClassificationStats: function(){
            return Promise.resolve({
                stats: ['E. Coqui', 'E. Brittoni', 'E. Juanariveroi', 'E. Cochranae', 'E. Llanero'].map(function(spp){
                    var p = (Math.random() * 500) | 0, np = (Math.random() * 500) | 0, nv = (Math.random() * 500) | 0;
                    return {species: spp, songtype: 'Common', present: p, notPresent: np, notValidated: nv, count: p + np + nv};
                })
            });
            // return a2APIService.get('/uploads/processing');
        },
        getUserStats: function(){
            return a2APIService.get('/uploads/processing');
        },
        getSettings: function(){
            return a2APIService.get('/uploads/processing');
        },
    };
})
;
