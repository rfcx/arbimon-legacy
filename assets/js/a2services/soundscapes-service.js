angular.module('a2-soundscapes-service', [
    'a2-project-service'
])
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
;
