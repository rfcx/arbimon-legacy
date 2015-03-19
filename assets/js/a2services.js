angular.module('a2services', [])
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
        removeRoi: function(roi_id,training_set, callback) {
            var projectName = Project.getUrl();
            $http.get('/api/project/'+projectName+'/training-sets/'+training_set.name+'/remove-roi/'+roi_id)
                .success(function(data) {
                    callback(data);
                });
        }
    };
})
.factory('a2Playlists', function(Project, $http) {
    var projectName = Project.getUrl();
    
    return {
        getList: function(callback) {
            $http.get('/api/project/'+projectName+'/playlists/')
            .success(function(data) {
                callback(data);
            });
        },

        create: function(playlistParams, callback) {
            $http.post('/api/project/'+projectName+'/playlists/create', playlistParams)
            .success(function(data) {
                callback(data);
            });
        },
        
        getRecordingPosition: function(playlist, recording, callback){
            var r = $http.get('/api/project/'+projectName+'/playlists/'+playlist+'/'+recording+'/position');
            if(callback){
                r.success(callback);
            }
            return r;
        },
        // addData: function(playlist, tset_data, callback) {
        //     var projectName = Project.getUrl();
        //     $http.post('/api/project/'+projectName+'/playlists/add-data/'+playlist, tset_data).success(function(data) {
        //         callback(data);
        //     });
        // },
        getPreviousRecording : function(playlist, recording, callback){
            return $http.get('/api/project/'+projectName+'/playlists/'+playlist+'/'+recording+'/previous').success(function(data) {
                callback(data);
            });
        },
        
        getNextRecording : function(playlist, recording, callback){
            return $http.get('/api/project/'+projectName+'/playlists/'+playlist+'/'+recording+'/next').success(function(data) {
                callback(data);
            });
        },
        
        rename: function(playlist, callback) {
            $http.post('/api/project/'+projectName+'/playlists/rename', playlist)
            .success(function(data) {
                callback(data);
            });
        },
        
        remove: function(playlistIds, callback) {
            $http.post('/api/project/'+projectName+'/playlists/delete', 
            {
                playlists: playlistIds
            })
            .success(function(data) {
                callback(data);
            });
        },
        
        getInfo: function(playlist, callback) {
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/playlists/info/'+playlist,
            }).success(function(data) {
                callback(data);
            });
        },
        
        getData: function(playlist, query, callback) {
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/playlists/'+playlist,
                params : query
            }).success(function(data) {
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
.factory('a2Soundscapes', function(Project, $http, $q) {
    return {
        get: function(soundscape, callback) {
            var projectName = Project.getUrl();
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/' + (soundscape|0)
            }).success(function(data) {
                callback(data);
            });
        },
        getSCIdx: function(soundscape, params, callback) {
            if(params instanceof Function){
                callback = params;
                params = undefined;
            }
            if(!params){
                params = {};
            }
            
            var d = $q.defer();
            var projectName = Project.getUrl();
            
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/' + (soundscape|0) + '/scidx',
                params : params
            }).success(function(data) {
                if(callback){callback(data);}
                d.resolve(data);
            });
            return d.promise;
        },
        getList: function(query, callback) {
            if(query instanceof Function){
                callback = query;
                query = {};
            }
            var projectName = Project.getUrl();
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/',
                params : query
            }).success(function(data) {
                callback(data);
            });
        },
        setVisualScale: function(soundscape, params, callback){
            var projectName = Project.getUrl();
            return $http({
                method : 'POST',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/scale',
                data   : params
            }).success(function(data) {
                callback(data);
            });
        },
        addRegion: function(soundscape, bbox, params, callback) {
            var projectName = Project.getUrl();
            params.bbox = bbox;
            $http({
                method : 'POST',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions/add',
                data   : params
            }).success(function(data) {
                callback(data);
            });
        },
        sampleRegion: function(soundscape, region, params, callback) {
            var projectName = Project.getUrl();
            $http({
                method : 'POST',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions/'+region+'/sample',
                data   : params
            }).success(function(data) {
                callback(data);
            });
        },
        getRegion: function(soundscape, region, callback) {
            var projectName = Project.getUrl();
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions/' + region
            }).success(function(data) {
                callback(data);
            });
        },
        getRecordingTags: function(soundscape, region, recording, callback){
            var projectName = Project.getUrl();
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions/'+ region + '/tags/' + recording
            }).success(function(data) {
                callback(data);
            });
        },
        addRecordingTag: function (soundscape, region, recording, tag, callback){
            var projectName = Project.getUrl();
            var data = {tag:tag};
            return $http({
                method : 'POST',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions/'+ region + '/tags/' + recording + '/add',
                data   : data
            }).success(callback);
        },
        removeRecordingTag: function (soundscape, region, recording, tag, callback){
            var projectName = Project.getUrl();
            var data = {tag:tag};
            return $http({
                method : 'POST',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions/'+ region + '/tags/' + recording + '/remove',
                data   : data
            }).success(callback);
        },
        getRegions: function(soundscape, query, callback) {
            if(query instanceof Function){
                callback = query;
                query = undefined;
            }
            var projectName = Project.getUrl();
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/regions',
                params : query
            }).success(function(data) {
                callback(data);
            });
        },
        getRecordings: function(soundscape, bbox, query, callback) {
            if(query instanceof Function){
                callback = query;
                query = {};
            }
            var projectName = Project.getUrl();
            $http({
                method : 'GET',
                url    : '/api/project/'+projectName+'/soundscapes/' + soundscape + '/recordings/'+bbox,
                params : query
            }).success(function(data) {
                callback(data);
            });
        },
        findIndices: function(soundscape, callback) {
            $http.get('/api/project/'+ Project.getUrl() +'/soundscapes/' + soundscape.id + '/indices')
                .success(callback);
        }
    };
})
.factory('a2Models', ['Project', '$http', function(Project, $http) {
    var project_url = Project.getUrl();
    
    return {
        getList: function(callback) {
            $http.get('/api/project/' + project_url + '/models')
            .success(function(data) {
                return callback(data);
            });
        },
    };
}])
.factory('a2Sites',['$http', 'Project', function($http, Project){
    return {
        listPublished: function(callback) {
            $http.get('/api/sites/published')
            .success(function(data) {
                callback(data);
            });
        },
        
        import: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/import', 
            {
                site: site,
            })
            .success(callback);
        },
        
        update: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/update', 
            {
                site: site,
            })
            .success(callback);
        },
        
        create: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/create', 
            {
                site: site,
            })
            .success(callback);
        },
        
        delete: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/delete', {
                site: site
            })
            .success(callback);
        },
        
        // Uses Promises :-)
        generateToken : function(site){
            return $http.post('/api/project/'+ Project.getUrl() +'/sites/generate-token', {
                site: site.id
            });
        },
        revokeToken : function(site){
            return $http.post('/api/project/'+ Project.getUrl() +'/sites/revoke-token', {
                site: site.id
            });
        }
    };
}])
;
