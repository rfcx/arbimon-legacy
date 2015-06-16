angular.module('a2.permissions', [
    'a2.services'
])
.service('a2UserPermit', function($http, Project) {
    var permit = {};
    
    $http.get('/api/project/'+Project.getUrl()+'/user-permissions')
        .success(function(data) {
            permit = data;
            
            console.log(permit);
        });
    
    return {
        can: function(perm) {
            return permit.permissions.indexOf(perm) !== -1 || permit.super;
        }
    };
});
