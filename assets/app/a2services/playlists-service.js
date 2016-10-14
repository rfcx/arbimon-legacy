angular.module('a2.srv.playlists', [
    'a2.srv.project'
])
.factory('a2Playlists', function(Project, $http) {
    var projectName = Project.getUrl();
    
    return {
        getList: function(options) {
            if(options){
                options={params:options};
            }
            console.log("options", options);
            return $http.get('/api/project/'+projectName+'/playlists/', options).then(function(response) {
                return response.data;
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
            return $http.get('/api/project/'+projectName+'/playlists/'+playlist+'/'+recording+'/previous')
                .success(function(data) {
                    callback(data);
                });
        },
        
        getNextRecording : function(playlist, recording, callback){
            return $http.get('/api/project/'+projectName+'/playlists/'+playlist+'/'+recording+'/next')
                .success(function(data) {
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
;
