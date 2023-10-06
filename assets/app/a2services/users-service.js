angular.module('a2.srv.users', [])
.factory('Users',function($http){
    var users;

    return {
        getInfoForId: function(user_id){
            return $http.get('/legacy-api/user/info/'+user_id).then(function(response) {
                return response.data.user;
            });
        }
    };
})
;
