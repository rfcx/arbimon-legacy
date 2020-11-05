angular.module('a2.srv.clustering-jobs', [
    'a2.srv.project',
    'humane'
])
.factory('a2ClusteringJobs', function($http, Project, notify) {

    return {
        list: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/clustering-jobs').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
    };
})
;
