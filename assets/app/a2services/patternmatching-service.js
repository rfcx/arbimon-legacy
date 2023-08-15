angular.module('a2.srv.patternmatching', [
    'a2.srv.project',
    'humane'
])
.factory('a2PatternMatching', function($q, $http, a2APIService, Project, notify) {
    var saveData = null;

    return {
        saveState : function(data) {
            saveData = data;
        },
        getState : function() {
            return saveData;
        },
        list: function(opts, callback) {
            const config = {
                params: opts
            };
            return $http.get('/api/project/'+Project.getUrl()+'/pattern-matchings', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getDetailsFor: function(patternMatchingId) {
            return $http.get('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/details').then(function(response){
                return response.data;
            });
        },
        getPatternMatchingsTotal: function(callback) {
            $http.get('/api/project/' + Project.getUrl() + '/pattern-matchings/count')
            .success(function(data) {
                callback(data);
            });
        },
        getRoisFor: function(patternMatchingId, limit, offset, options) {
            var query = Object.keys(options || {}).map(function(option){
                return option + '=' + encodeURIComponent(options[option]);
            }).join('&');

            return a2APIService.get('/pattern-matchings/' + patternMatchingId + '/rois/' + (offset||0) + '_' + (limit||0) + (query ? '?'+query : '')).catch(notify.serverError);
        },
        getSitesListFor: function(patternMatchingId, options) {
            var query = Object.keys(options || {}).map(function(option){
                return option + '=' + encodeURIComponent(options[option]);
            }).join('&');

            return a2APIService.get('/pattern-matchings/' + patternMatchingId + '/site-index' + (query ? '?'+query : '')).catch(notify.serverError);
        },
        getExportUrl: function(params){
            return '/api/project/' + Project.getUrl() + '/pattern-matchings/' + params.patternMatching + '/' + params.jobName + '.csv';
        },
        getAudioUrlFor: function(roi){
            return '/api/project/' + Project.getUrl() + '/pattern-matchings/' + roi.pattern_matching_id + '/audio/' + roi.id + roi.recExt;
        },
        validateRois: function(patternMatchingId, rois, validation, cls) {
            return $http.post('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/validate', {
                rois: rois,
                validation: validation,
                cls: cls
            }).then(function(response){
                return response.data;
            });
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/pattern-matchings/new', data).then(function(response){
                return response.data;
            });
        },
        update: function(patternMatchingId, data) {
            return $http.post('/api/project/'+Project.getUrl()+'/pattern-matchings/' + patternMatchingId + '/update', data).then(function(response){
                return response.data;
            });
        },
        delete: function(patternMatchingId) {
            return $http.post('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/remove').then(function(response){
                return response.data;
            });
        },
    };
})
;
