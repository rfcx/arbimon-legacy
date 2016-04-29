angular.module('a2.srv.news', [
    'a2.srv.api'
])
.service('a2NewsService', function($q, a2APIService) {
    return {
        loadPage : function(index){
            return a2APIService.api.get('/user/feed/'+ (index | 0));
        },
        loadFormats : function(){
            return a2APIService.api.get('/user/feed/formats');
        }
    };
})
;