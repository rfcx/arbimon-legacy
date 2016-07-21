angular.module("a2.srv.app-listings", [
    'a2.srv.api',
])
.service("AppListingsService", function(a2APIService){
    return {
        getFor: function(app){
            return a2APIService.api.get('/app-listings/' + app);
        }
    };    
})
;