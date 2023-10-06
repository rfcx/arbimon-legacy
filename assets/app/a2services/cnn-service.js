angular.module('a2.srv.cnn', [
    'a2.srv.project',
    'humane'
])
.factory('a2CNN', function($q, $http, Project, notify) {
    var saveData = null;

    return {
        listROIs: function (job_id, limit, offset, species_id, site_id, search, callback) {
            if (!limit){
                var limit = 100;
            }
            if(!offset){
                var offset = 0;
            }
            if (!species_id){
                species_id = 0;
            }
            if (!site_id){
                site_id = 0;
            }
            if (!search){
                search = "all";
            }
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/cnn/rois/'+job_id+"/"+species_id+"/"+site_id+"/"+search+"/"+offset+"_"+limit).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        listROIsBySpecies: function (job_id, species_id, callback) {
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/cnn/roisBySpecies/'+job_id+'/'+species_id).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        listResults: function (job_id, callback) {
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/cnn/results/'+job_id).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        listModels: function(callback) {
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/cnn/models').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        saveState : function(data) {
            saveData = data;
        },
        getState : function() {
            return saveData;
        },
        list: function(callback) {
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/cnn').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getDetailsFor: function(cnnId) {
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/details').then(function(response){
                return response.data;
            });
        },
        getRoisFor: function(cnnId, limit, offset) {
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/rois/' + (offset||0) + '_' + (limit||0)).then(function(response){
                return response.data;
            });
        },
        countROIsBySpecies: function(cnnId) {
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/countROIsBySpecies')
        },
        countROIsBySites: function(cnnId) {
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/countROIsBySites')
        },
        countROIsBySpeciesSites: function(cnnId, options) {
            var search = "all";
            if (options.search){
                search = options.search;
            }
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/countROIsBySpeciesSites/' + search)
        },
        getExportUrl: function(params){
            return '/legacy-api/project/' + Project.getUrl() + '/cnn/' + params.cnnId + '/rois.csv';
        },
        getAudioUrlFor: function(roi){
            return '/legacy-api/project/' + Project.getUrl() + '/cnn/' + roi.job_id + '/audio/' + roi.cnn_result_roi_id;
        },
        validateRois: function(cnnId, rois, validation) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/validate', {
                rois: rois,
                validation: validation,
            }).then(function(response){
                return response.data;
            });
        },
        create: function(data) {
            return $http.post('/legacy-api/project/'+Project.getUrl()+'/cnn/new', data).then(function(response){
                return response.data;
            });
        },
        delete: function(cnnId) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/remove').then(function(response){
                return response.data;
            });
        },
    };
})
;
