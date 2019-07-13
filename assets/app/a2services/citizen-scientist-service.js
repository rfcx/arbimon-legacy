angular.module('a2.srv.citizen-scientist', [
    'a2.srv.api',
])
.factory('a2CitizenScientistService',function(a2APIService, notify){
    return {
        getMyStats: function(userId){
            return a2APIService.get('/citizen-scientist/stats/mine').catch(notify.serverError);
        },
        getPatternMatchings: function(){
            return a2APIService.get('/citizen-scientist/pattern-matchings').catch(notify.serverError);
        },
        getPatternMatchingDetailsFor: function(patternMatchingId){
            return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/details').catch(notify.serverError);
        },
        getPatternMatchingRoisFor: function(patternMatchingId, limit, offset){
            return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/rois/' + (offset||0) + '_' + (limit||0)).catch(notify.serverError);
        },
        validatePatternMatchingRois: function(patternMatchingId, rois, validation) {
            return a2APIService.post('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/validate', {
                rois: rois,
                validation: validation,
            }).catch(notify.serverError);
        },
    };
})
;
