angular.module('a2.srv.training-sets', ['a2.srv.project'])
.factory('a2TrainingSets', function(Project, $http) {
    return {
        getList: function(callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets')
                .success(function(data) {
                    callback(data);
                });
        },

        add: function(tset_data, callback) {
            var projectName = Project.getUrl();
            $http.post('/api/project/'+projectName+'/training-sets/add', tset_data)
                .success(function(data) {
                    callback(data);
                });
        },

        edit: function(trainingSetId, tset_data) {
            var projectName = Project.getUrl();
            return $http.post('/api/project/'+projectName+'/training-sets/edit/'+trainingSetId, tset_data);
        },
        
        delete: function(trainingSetId) {
            var projectName = Project.getUrl();
            return $http.post('/api/project/'+projectName+'/training-sets/remove/'+trainingSetId);
        },
        
        addData: function(trainingSetId, tset_data, callback) {
            var projectName = Project.getUrl();
            $http.post('/api/project/'+projectName+'/training-sets/add-data/'+trainingSetId, tset_data)
                .success(function(data) {
                    callback(data);
                });
        },

        getData: function(trainingSetId, recording_uri, callback) {
            if( recording_uri instanceof Function ) {
                callback = recording_uri;
                recording_uri = "";
            }

            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/list/'+trainingSetId+'/'+recording_uri)
                .success(function(data) {
                    callback(data);
                });
        },

        getDataImage: function(trainingSetId, dataId, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/data/'+trainingSetId+'/get-image/'+dataId)
                .success(function(data) {
                    callback(data);
                });
        },

        getTypes: function(callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/types')
                .success(function(data) {
                    callback(data);
                });
        },
        
        getRois: function(trainingSetId, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/rois/'+trainingSetId)
                .success(function(data) {
                    callback(data);
                });
        },
        
        getExportUrl: function(trainingSetId){
            var projectName = Project.getUrl();
            return '/api/project/'+projectName+'/training-sets/rois/'+trainingSetId+'?export=1';
        },        
        
        getSpecies: function(trainingSetId, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/species/'+trainingSetId)
                .success(function(data) {
                    callback(data);
                });
        },
        removeRoi: function(trainingSetId, roiId, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/'+trainingSetId+'/remove-roi/'+roiId)
                .success(function(data) {
                    callback(data);
                });
        }
    };
})
;
