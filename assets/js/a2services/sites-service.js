angular.module('a2.srv.sites', [
    'a2.srv.project',
])
.factory('a2Sites',function($http, $q, Project){
    return {
        listPublished: function(callback) {
            $http.get('/api/sites/published')
            .success(function(data) {
                callback(data);
            });
        },
        
        import: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/import', {
                site: site,
            })
            .success(callback);
        },
        
        update: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/update', {
                site: site,
            })
            .success(callback);
        },
        
        create: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/create', {
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
        getLogFiles: function(site, callback) {
            return $http.get('/api/project/'+ Project.getUrl() +'/sites/'+site+'/logs');
        },

        getSiteLogDataDates: function(site, series){
            var d=$q.defer();
            $http.get('/api/project/'+ Project.getUrl() +'/sites/'+site+'/log/data.txt?get=dates')
                .success(d.resolve.bind(d))
                .error(d.reject.bind(d));
            return d.promise;
        },
        
        getSiteLogDataUrl: function(site, series, from, to, period){
            var d=$q.defer();
            d.resolve('/api/project/'+ Project.getUrl() +'/sites/'+site+'/log/data.txt?stat='+series+'&q='+period+'&from='+from.getTime()+'&to='+to.getTime());
            return d.promise;
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
})
;
