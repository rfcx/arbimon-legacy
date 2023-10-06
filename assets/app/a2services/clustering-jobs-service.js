angular.module('a2.srv.clustering-jobs', [
    'a2.srv.project',
    'humane'
])
.factory('a2ClusteringJobs', function($http, Project, notify, $httpParamSerializer) {

    return {
        list: function(opts) {
            const config = {
                params: opts
            };
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/clustering-jobs', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getJobDetails: function(clusteringJobId) {
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + clusteringJobId + '/job-details').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getClusteringDetails: function(opts) {
            var config = {
                params: opts
            };
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.job_id + '/clustering-details', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getRoisDetails: function(opts) {
            var params = {};
            if (opts.aed) {
                params.aed = opts.aed;
            }
            if (opts.rec_id) {
                params.rec_id = opts.rec_id;
            }
            if (opts.search && opts.search == 'per_site')  {
                params.perSite = true;
            }
            else if (opts.search && opts.search == 'per_date') {
                params.perDate = true;
            }
            else params.all = true;

            return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.jobId + '/rois-details', params).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        exportClusteringROIs: function(opts) {
            const config = {
                params: opts
            };
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.jobId + '/rois-export', config)
                .then(function(response){
                    return response.data;
                }).catch(notify.serverError);
        },
        getAudioUrlFor: function(recId, aedId) {
            return '/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + recId + '/audio/' + aedId;
        },
        audioEventDetections: function(opts) {
            var config = {
                params: {}
            };
            if (opts.completed) {
                config.params.completed = opts.completed;
            }
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/clustering-jobs/audio-event-detections', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        create: function(data) {
            return $http.post('/legacy-api/project/'+Project.getUrl()+'/clustering-jobs/new', data)
                .then(function(response){
                    return response.data;
                }).catch(notify.serverError);
        },
        delete: function(clusteringJobId) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + clusteringJobId + '/remove').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
    };
})
;
