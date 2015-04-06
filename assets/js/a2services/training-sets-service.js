angular.module('a2-training-sets-service', ['a2-project-service'])
.factory('a2TrainingSets', function(Project, $http) {
    return {
        getList: function(callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/')
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

        addData: function(training_set, tset_data, callback) {
            var projectName = Project.getUrl();
            $http.post('/api/project/'+projectName+'/training-sets/add-data/'+training_set, tset_data)
                .success(function(data) {
                    callback(data);
                });
        },

        getData: function(training_set, recording_uri, callback) {
            if( recording_uri instanceof Function ) {
                callback = recording_uri;
                recording_uri = "";
            }

            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/list/'+training_set+'/'+recording_uri)
                .success(function(data) {
                    callback(data);
                });
        },

        getDataImage: function(training_set, data_id, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/data/'+training_set+'/get-image/'+data_id)
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

        getRois: function(training_set, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/rois/'+training_set)
                .success(function(data) {
                    callback(data);
                });
        },
        getSpecies: function(training_set, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/species/'+training_set)
                .success(function(data) {
                    callback(data);
                });
        },
        // TODO chance use of training_set.name to training_set_id, traing sets name are not url safe
        removeRoi: function(roi_id, training_set, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/'+training_set.name+'/remove-roi/'+roi_id)
                .success(function(data) {
                    callback(data);
                });
        }
    };
})
;
