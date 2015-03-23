angular.module('a2-species-service', [])
.factory('Species',function($http){
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
})
.factory('Songtypes',function($http){
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
})
;
