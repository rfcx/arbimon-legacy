angular.module('countries-list', [])
    .service('countries', function($http) {
        var countries;
        
        return {
            get: function(callback) {
                if(countries)
                    return callback(countries);
                
                $http.get('/legacy-api/orders/countries')
                    .success(function(data) {
                        countries = data;
                        callback(countries);
                    });
            }
        };
    });
