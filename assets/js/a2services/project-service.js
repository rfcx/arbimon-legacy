angular.module('a2-project-service', [])
.factory('Project', [
    '$location', 
    '$http', 
    function($location, $http) {
        
        var nameRe = /\/?project\/([\w\_\-]+)/;
        var nrm = nameRe.exec($location.absUrl());
        var url = nrm ? nrm[1] : ''; 

        return {

            getUrl: function(){
                return url;
            },
            
            getInfo: function(callback) {
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
            
            // TODO should rename getRecs to findRecs
            getRecs: function(query, callback) { 
                if(typeof query === "function") {
                    callback = query;
                    query = {};
                }

                $http.get('/api/project/'+url+'/recordings/search',{
                        params: query
                    })
                    .success(function(data) {
                        callback(data);
                    });
            },

            getRecTotalQty: function(callback) {
                $http.get('/api/project/'+url+'/recordings/count')
                .success(function(data) {
                    callback(data.count);
                });
            },

            getRecordings: function(key, options, callback) {
                if(options instanceof Function){
                    callback = options;
                    options = {};
                }
                $http.get('/api/project/'+url+'/recordings/'+key, {
                        params: options
                    })
                    .success(function(data) {
                        callback(data);
                    });
            },
            
            getRecordingAvailability: function(key, callback) {
                $http.get('/api/project/'+url+'/recordings/available/'+key)
                    .success(function(data) {
                        callback(data);
                    });
            },
            
            getOneRecording: function(rec_id, callback) {
                $http.get('/api/project/'+url+'/recordings/find/'+rec_id)
                    .success(function(data) {
                        callback(data);
                    });
            },
            
            getRecordingInfo: function(rec_id, callback) {
                $http.get('/api/project/'+url+'/recordings/info/'+rec_id)
                    .success(function(data) {
                        callback(data);
                    });
            },
            
            getNextRecording: function(rec_id, callback) {
                $http.get('/api/project/'+url+'/recordings/next/'+rec_id)
                    .success(function(data) {
                        callback(data);
                    });
            },
            
            getPreviousRecording: function(rec_id, callback) {
                $http.get('/api/project/'+url+'/recordings/previous/'+rec_id)
                    .success(function(data) {
                        callback(data);
                    });
            },
            
            validateRecording: function(rec_id, validation, callback){
                $http.post('/api/project/'+url+'/recordings/validate/'+rec_id, validation)
                    .success(function(data) {
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
            
            // TODO should rename delUser to removeUser
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
            },

            getModels: function(callback) {
                $http.get('/api/project/'+url+'/models')
                .success(function(response){
                    callback(null, response);
                })
                .error(function(err){
                    callback(err);
                });
            },
            
            getClassi: function(callback) {
                $http.get('/api/project/'+url+'/classifications')
                .success(function(response){
                    callback(null, response);
                })
                .error(function(err){
                    callback(err);
                });
            },

            validationsCount: function(callback) {
                $http.get('/api/project/'+url+'/validations/count')
                .success(function(response){
                    callback(response.count);
                });
            }
        };
    }
])
;
