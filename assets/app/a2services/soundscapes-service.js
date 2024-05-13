angular.module('a2.srv.soundscapes', [
    'a2.srv.project',
    'humane'
])
.factory('a2Soundscapes', function(Project, $http, $q, notify) {
    var saveData = null;
    return {
        saveState : function(data)
        {
            saveData = data;
        },
        getState : function()
        {
            return saveData;
        },
        getAmplitudeReferences: function(){
            return $q.resolve([
                {value:'absolute'                , caption:"Absolute", description:"The threshold is taken as an absolute value of the amplitude of each peak."},
                {value:'relative-to-peak-maximum', caption:"Relative to maximum", description:"The threshold is taken as a relative proportion of the maximum amplitude of the peaks in the soundscape."},
            ]);
        },
        get: function(soundscapeId, callback) {
            var projectName = Project.getUrl();
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId)
                .success(function(data) {
                    callback(data);
                });
        },
        getSCIdx: function(soundscapeId, params, callback) {
            if(params instanceof Function){
                callback = params;
                params = undefined;
            }
            if(!params){
                params = {};
            }
            
            var d = $q.defer();
            var projectName = Project.getUrl();
            
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/scidx', {
                    params : params
                })
                .success(function(data) {
                    if(callback) callback(data);
                    
                    d.resolve(data);
                });
            return d.promise;
        },
        getNormVector: function(soundscapeId, callback) {
            var d = $q.defer();
            var projectName = Project.getUrl();
            
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/norm-vector')
                .success(function(data) {
                    if(callback) callback(data);
                    
                    d.resolve(data);
                });
            return d.promise;
        },
        // TODO fusion getList and getList2 routes to return needed data
        getList: function(query, callback) {
            if(query instanceof Function){
                callback = query;
                query = {};
            }
            var projectName = Project.getUrl();
            
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/', {
                    params : query
                })
                .success(function(data) {
                    callback(data);
                });
        },
        getList2: function(callback) {
            $http.get('/legacy-api/project/'+Project.getUrl()+'/soundscapes/details')
                .success(callback)
                .error(notify.serverError);
        },
        setVisualizationOptions: function(soundscapeId, params, callback){
            var projectName = Project.getUrl();
            $http.post('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/scale', params)
                .success(function(data) {
                    callback(data);
                });
        },
        addRegion: function(soundscapeId, bbox, params, callback) {
            var projectName = Project.getUrl();
            params.bbox = bbox;
            $http.post('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions/add', params)
                .success(function(data) {
                    callback(data);
                });
        },
        sampleRegion: function(soundscapeId, region, params, callback) {
            var projectName = Project.getUrl();
            $http.post('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions/'+region+'/sample', params)
                .success(function(data) {
                    callback(data);
                });
        },
        getExportUrl: function(options){
            var soundscapeId = options.soundscape.soundscape_id;
            var d = $q.defer();
            var projectName = Project.getUrl();
            var args = [];
            if(options.raw){
                args.push('raw=1');
            }
            d.resolve(
                '/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/export-list' +
                ( args.length ? '?'+args.join('&')  : '')
            );
            return d.promise;
        },
        getRegion: function(soundscapeId, region, callback) {
            var projectName = Project.getUrl();
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions/' + region)
                .success(function(data) {
                    callback(data);
                });
        },
        getRecordingTags: function(soundscapeId, region, recording, callback){
            var projectName = Project.getUrl();
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions/'+ region + '/tags/' + recording)
                .success(function(data) {
                    callback(data);
                });
        },
        addRecordingTag: function (soundscapeId, region, recording, tag, callback){
            var projectName = Project.getUrl();
            $http.post('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions/'+ region + '/tags/' + recording + '/add', 
                { 
                    tag: tag 
                })
                .success(callback);
        },
        removeRecordingTag: function (soundscapeId, region, recording, tag, callback){
            var projectName = Project.getUrl();
            $http.post('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions/'+ region + '/tags/' + recording + '/remove',
                {
                    tag: tag
                })
                .success(callback);
        },
        getRegions: function(soundscapeId, query, callback) {
            if(query instanceof Function){
                callback = query;
                query = undefined;
            }
            var projectName = Project.getUrl();
            
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/regions', {
                    params : query
                })
                .success(function(data) {
                    callback(data);
                });
        },
        getRecordings: function(soundscapeId, bbox, query, callback) {
            if(query instanceof Function){
                callback = query;
                query = {};
            }
            var projectName = Project.getUrl();
            
            $http.get('/legacy-api/project/'+projectName+'/soundscapes/' + soundscapeId + '/recordings/'+bbox, {
                    params : query
                })
                .success(function(data) {
                    callback(data);
                });
        },
        // TODO change method to receive id
        findIndices: function(soundscapeId, callback) {
            $http.get('/legacy-api/project/'+ Project.getUrl() +'/soundscapes/' + soundscapeId + '/indices')
                .success(callback);
        },
        delete: function(soundscapeId, callback) {
            $http.get('/legacy-api/project/' + Project.getUrl() + '/soundscapes/' + soundscapeId + "/delete")
                .success(callback)
                .error(notify.serverError);
        },
        create: function(soundscapeData) {
            return $http.post('/legacy-api/project/'+ Project.getUrl() +'/soundscape/new', soundscapeData);
        },
        createBatchRun: function(soundscapeData) {
            return $http.post('/legacy-api/project/'+ Project.getUrl() +'/soundscape/batch-run', soundscapeData);
        }
    };
})
;
