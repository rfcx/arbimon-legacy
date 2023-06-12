angular.module('a2.srv.sites', [
    'a2.srv.project',
    'humane'
])
.factory('a2Sites',function($http, $q, Project, notify){
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
            .success(callback)
            .error(notify.serverError);
        },

        create: function(site, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/create', {
                site: site,
            })
            .success(callback)
            .error(notify.serverError);
        },

        delete: function(sites, callback) {
            $http.post('/api/project/'+ Project.getUrl() +'/sites/delete', {
                sites: sites
            })
            .success(callback)
            .error(notify.serverError);
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
            var args = 'q='+period+'&from='+from.getTime()+'&to='+to.getTime();
            if(/uploads/.test(series)){
                return $q.resolve('/api/project/'+ Project.getUrl() +'/sites/'+site+'/uploads.txt?'+args);
            } else if(/recordings/.test(series)){
                    return $q.resolve('/api/project/'+ Project.getUrl() +'/sites/'+site+'/data.txt?'+args);
            } else {
                return $q.resolve('/api/project/'+ Project.getUrl() +'/sites/'+site+'/log/data.txt?stat='+series+'&'+args);
            }
        },

        getSiteLogData: function(site, series, from, to, period){
            return this.getSiteLogDataUrl(site, series, from, to, period).then(function(url){
                return $q.when($http.get(url));
            }).then(function(response){
                var data = {};
                if(response.data){
                    data.rows = response.data.trim().split('\n').map(function(line){
                        return line.split(',');
                    });
                }
                return data;
            });
        },

        // Get list of assets to a site
        getListOfAssets: function(site_id) {
            var d = $q.defer();
            $http.get('/api/project/'+ Project.getUrl() + '/streams/'+site_id+'/assets')
                .success(d.resolve.bind(d))
                .error(d.reject.bind(d));
            return d.promise;
        },

        // Uses Promises
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
