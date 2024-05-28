angular.module('a2.srv.sites', [
    'a2.srv.project',
    'humane'
])
.factory('a2Sites',function($http, $q, Project, notify){
    return {
        listPublished: function(callback) {
            $http.get('/legacy-api/sites/published')
            .success(function(data) {
                callback(data);
            });
        },

        import: function(site, callback) {
            $http.post('/legacy-api/project/'+ Project.getUrl() +'/sites/import', {
                site: site,
            })
            .success(callback);
        },

        update: function(site, callback) {
            $http.post('/legacy-api/project/'+ Project.getUrl() +'/sites/update', {
                site: site,
            })
            .success(callback)
            .error(notify.serverError);
        },

        create: function(site, callback) {
            $http.post('/legacy-api/project/'+ Project.getUrl() +'/sites/create', {
                site: site,
            })
            .success(callback)
            .error(notify.serverError);
        },

        delete: function(sites, callback) {
            $http.post('/legacy-api/project/'+ Project.getUrl() +'/sites/delete', {
                sites: sites
            })
            .success(callback)
            .error(notify.serverError);
        },

        // Get list of assets to a site
        getListOfAssets: function(site_id) {
            var d = $q.defer();
            $http.get('/legacy-api/project/'+ Project.getUrl() + '/streams/'+site_id+'/assets')
                .success(d.resolve.bind(d))
                .error(d.reject.bind(d));
            return d.promise;
        }
    };
})
;
