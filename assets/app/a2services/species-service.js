angular.module('a2.srv.species', [])
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
            $http.get('/api/species/search', {
                params: {
                    q: query
                }
            })
            .success(function(data){
                callback(data);
            });
        },
        findById: function(species_id, callback){
            return $http.get('/api/species/'+species_id).then(function(response) {
                if (callback) {
                    callback(response.data);
                }
                return response.data;
            });
        }
    };
})
.factory('Songtypes', function($http){
    var songs;
    
    var searchId = function(id, callback) {
        var s = songs.filter(function(song) {
            return song.id === id;
        });
        
        if(s !== null)
            callback(s[0]);
    };
    
    return {
        get: function(callback) {
            if(songs)
                return callback(songs);

            $http.get('/api/songtypes/all')
            .success(function(data) {
                songs = data;
                callback(songs);
            });
        },
        findById: function(songtype_id, callback) {
            if(songs) {
                searchId(songtype_id, callback);
                return;
            }
            
            $http.get('/api/songtypes/all')
                .success(function(data) {
                    songs = data;
                    searchId(songtype_id, callback);
                });
            
        }
    };
})
;
