angular.module('a2.srv.clustering-model', [
    'a2.srv.project',
    'humane'
])
.factory('a2ClusteringModel', function($http, Project) {

    return {
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/clustering-model/new', data).then(function(response){
                return response.data;
            });
        },
    };
})
;
