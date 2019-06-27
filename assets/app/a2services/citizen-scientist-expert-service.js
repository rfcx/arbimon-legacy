angular.module('a2.srv.citizen-scientist-expert', [
    'a2.srv.api',
])
.factory('a2CitizenScientistExpertService',function(a2APIService, Project, notify){
    return {
        getPatternMatchingRoisFor: function(patternMatchingId, limit, offset, options){
            var query = Object.keys(options || {}).map(function(option){
                return option + '=' + encodeURIComponent(options[option]);
            }).join('&');
            return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/expert-rois/' + (offset||0) + '_' + (limit||0) + (query ? '?'+query : '')).catch(notify.serverError);
        },
        validatePatternMatchingRois: function(patternMatchingId, rois, validation) {
            return a2APIService.post('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/expert-validate', {
                rois: rois,
                validation: validation,
            }).catch(notify.serverError);
        },
    };
})
;
