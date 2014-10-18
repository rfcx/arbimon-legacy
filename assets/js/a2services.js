angular.module('a2services',[])
.factory('Project', ['$location', '$http', function($location, $http) {
    var urlparse = document.createElement('a');
    urlparse.href = $location.absUrl();
    var nameRe = /\/project\/([\w\_\-]+)/;

    var url = nameRe.exec(urlparse.pathname)[1];
    
    var project;

    return {
        getInfo: function(callback) {
            if(project)
                return callback(project);
            
            $http.get('/api/project/'+url+'/info')
            .success(function(data) {
                callback(data);
            });
        },
        
        updateInfo: function(info, callback) {
            $http.post('/api/project/'+url+'/info/update', info)
            .success(function(data){
                callback(null, data);
            })
            .error(function(err){
                callback(err);
            });
        },

        getSites: function(callback) {
            $http.get('/api/project/'+url+'/sites')
            .success(function(data) {
                callback(data);
            });
        },

        getClasses: function(callback) {
            $http.get('/api/project/'+url+'/classes')
            .success(function(data) {
                callback(data);
            });
        },

        getRecs: function(query, callback) {
            if(typeof query === "function") {
                callback = query;
                query = "";
            }

            $http.get('/api/project/'+url+'/recordings/'+query)
            .success(function(data) {
                callback(data);
            });
        },

        getRecTotalQty: function(callback) {
            $http.get('/api/project/'+url+'/recordings/count/')
            .success(function(data) {
                callback(data[0].count);
            });
        },

        getName: function(){
            return url;
        },
        
        getRecordings: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/'+key).success(function(data) {
                callback(data);
            });
        },
        getOneRecording: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/find/'+key).success(function(data) {
                callback(data);
            });
        },
        getRecordingAvailability: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/available/'+key).success(function(data) {
                callback(data);
            });
        },
        getRecordingInfo: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/info/'+key).success(function(data) {
                callback(data);
            });
        },
        getNextRecording: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/next/'+key).success(function(data) {
                callback(data);
            });
        },
        getPreviousRecording: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/previous/'+key).success(function(data) {
                callback(data);
            });
        },
        validateRecording: function(recording_uri, validation, callback){
            var projectName = this.getName();
            $http.post('/api/project/'+projectName+'/recordings/validate/'+recording_uri, validation).success(function(data) {
                callback(data);
            });
        },
        recExists: function(site_id, filename, callback) {
            $http.get('/api/project/'+url+'/recordings/exists/site/'+ site_id +'/file/' + filename)
            .success(function(data) {
                callback(data.exists);
            });
        },
        addClass: function(projectClass, callback) {
            $http.post('/api/project/'+url+'/class/add', projectClass)
            .success(function(data){
                callback(null, data);
            })
            .error(function(err){
                callback(err);
            });
        },
        removeClasses: function(projectClasses, callback) {
            $http.post('/api/project/'+url+'/class/del', projectClasses)
            .success(function(data){
                callback(null, data);
            })
            .error(function(err){
                callback(err);
            });
        },
        getUsers: function(callback) {
            $http.get('/api/project/'+url+'/users')
            .success(function(data){
                callback(null, data);
            })
            .error(function(err){
                callback(err);
            });
        },
        getRoles: function(callback) {
            $http.get('/api/project/'+url+'/roles')
            .success(function(data){
                callback(null, data);
            })
            .error(function(err){
                callback(err);
            });
        },
        addUser: function(data, callback){
            $http.post('/api/project/'+url+'/user/add', data)
            .success(function(response){
                callback(null, response);
            })
            .error(function(err){
                callback(err);
            });
        },
        delUser: function(data, callback){
            $http.post('/api/project/'+url+'/user/del', data)
            .success(function(response){
                callback(null, response);
            })
            .error(function(err){
                callback(err);
            });
        },
        changeUserRole: function(data, callback){
            $http.post('/api/project/'+url+'/user/role', data)
            .success(function(response){
                callback(null, response);
            })
            .error(function(err){
                callback(err);
            });
        }
    }; 
}])

.factory('a2TrainingSets', function(Project, $http) {
    return {
        getList: function(callback) {
            var projectName = Project.getName();
            $http.get('/api/project/'+projectName+'/training-sets/').success(function(data) {
                callback(data);
            });
        },

        add: function(tset_data, callback) {
            var projectName = Project.getName();
            $http.post('/api/project/'+projectName+'/training-sets/add', tset_data).success(function(data) {
                callback(data);
            });
        },
        getData: function(training_set, recording_uri, callback) {
            var projectName = Project.getName();
            $http.get('/api/project/'+projectName+'/training-sets/list/'+training_set+'/'+recording_uri).success(function(data) {
                callback(data);
            });
        },

        getTypes: function(callback) {
            var projectName = Project.getName();
            $http.get('/api/project/'+projectName+'/training-sets/types').success(function(data) {
                callback(data);
            });
        },
    };
})

.factory('Species',['$http', function($http){
    var species;

    return {
        get: function(callback) {
            if(species)
                return callback(species);

            $http.get('/api/species/list/100')
            .success(function(data) {
                species = data;
                callback(species);
            });
        },
        search: function(query, callback) {
            $http.get('/api/species/search/'+query)
            .success(function(data){
                callback(data);
            });
        }
    };
}])

.factory('Songtypes',['$http', function($http){
    var songs;

    return {
        get: function(callback) {
            if(songs)
                return callback(songs);

            $http.get('/api/songtypes/all')
            .success(function(data) {
                songs = data;
                callback(songs);
            });
        }
    };
}])
;
