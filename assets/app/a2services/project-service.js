angular.module('a2.srv.project', [
    'a2.srv.api'
])
.factory('Project', function(
    $location, $http, $q, $httpParamSerializer,
    a2APIService, notify
) {

        var nameRe = /\/?(project|citizen-scientist|visualizer)\/([\w\_\-]+)/;
        var nrm = nameRe.exec($location.absUrl());
        var url = nrm ? nrm[2] : '';

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
            getProjectById: function(projectId, callback) {
                var config = {
                    params: {}
                };
                if (projectId) {
                    config.params.project_id = projectId;
                }
                $http.get('/api/project/'+url+'/info/source-project', config)
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
            getUsage: function() {
                return $http.get('/api/project/'+url+'/usage');
            },
            getSites: function(options, callback) {
                if(typeof options == 'function') {
                    callback = options;
                    options = {};
                }
                return $q.when($http.get('/api/project/'+url+'/sites', {
                    params: options
                })).then(function(response){
                    if(callback){
                        callback(response.data);
                    }
                    return response.data;
                });
            },
            getClasses: function(options, callback) {
                if(typeof options == 'function') {
                    callback = options;
                    options = {};
                }

                return $q.when($http.get('/api/project/'+url+'/classes', {
                        params: options
                    })).then(function(response){
                        if(callback){
                            callback(response.data);
                        }
                        return response.data;
                    });
            },
            // TODO should rename getRecs to findRecs
            getRecs: function(query, callback) {
                if(typeof query === "function") {
                    callback = query;
                    query = {};
                }
                if (query && query.tags) {
                    query['tags[]'] = query.tags.flat()
                    delete query.tags
                }
                $http.get('/api/project/'+url+'/recordings/search',{
                        params: query
                    })
                    .success(function(data) {
                        callback(data);
                    });
            },
            getRecCounts: function(query) {
                if (query && query.project_url) {
                    delete query.project_url;
                }
                return a2APIService.get('/recordings/search-count', {params:query || {}});
            },
            getRecordingData: function(filters, projection, ){
                if (filters.tags) {
                    filters.tags = filters.tags.flat();
                }
                var params={filters:filters, show:projection};

                Object.keys(params).forEach(function(param){
                    if(!Object.keys(params[param] || {}).length){
                        delete params[param];
                    }
                });

                var serializedParams = $httpParamSerializer(params);
                const getUrl = '/api/project/'+url+'/recordings/'+ (
                    projection && projection.species ? 'occupancy-models-export/'+projection.species_name :
                    (projection && projection.grouped ? 'grouped-detections-export' : 'recordings-export'))
                    + (serializedParams.length ? '?'+serializedParams : '');
                return $http.get(getUrl).then(function(response) {
                    return response.data;
                }).catch(notify.serverError);;
            },
            getSitesExportUrl: function() {
                return '/api/project/' + url + '/sites-export.csv';
            },
            getRecTotalQty: function(callback) {
                return a2APIService.get('/recordings/count').then(function(data) {
                    if(callback){
                        callback(data);
                    }
                    return data;
                });
            },
            getProjectTotalSpecies: function(projectId, callback) {
                $http.get('/api/project/' + url + '/recordings/species-count', {project_id: projectId})
                    .success(function(count) {
                        callback(count);
                    });
            },
            getProjectTimeBounds: function(callback) {
                return a2APIService.get('/recordings/time-bounds').then(function(data) {
                    if(callback){
                        callback(data);
                    }
                    return data;
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
                return a2APIService.get('/recordings/available/'+key).then(function(data) {
                    if(callback){
                        callback(data);
                    }
                    return data;
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
            downloadRecording: function(rec_id, callback) {
                $http.get('/api/project/'+url+'/recordings/download/'+ rec_id)
                    .success(function(data) {
                        callback(data);
                    });
            },
            addClass: function(projectClass, callback) {
                return $http.post('/api/project/'+url+'/class/add', projectClass);
            },
            removeClasses: function(projectClasses, callback) {
                return $http.post('/api/project/'+url+'/class/del', projectClasses);
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
            removeUser: function(data, callback){
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
            },
            validationBySpeciesSong: function(speciesId, songtypeId, callback) {
                $http.get( '/api/project/' + url + '/validations', {
                        params: {
                            species_id: speciesId,
                            sound_id: songtypeId
                        }
                    })
                    .success(callback);
            },
            getProjectsList: function(ownershipType, callback) {
                var config = {
                    params: {}
                };
                if (ownershipType) {
                    config.params.type = ownershipType;
                }
                $http.get('/api/user/projectlist', config)
                    .success(function(response) {
                        callback(response);
                    });
            },
            removeProject: function(data) {
                return $http.post('/api/project/'+url+'/remove', data);
            }
        };
    })
;
