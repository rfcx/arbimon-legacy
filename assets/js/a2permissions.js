angular.module('a2.permissions', [
    'a2.services'
])
.service('a2UserPermit', function($http, Project, $q) {
    var permit = {};
    
    $http.get('/api/project/'+Project.getUrl()+'/user-permissions')
        .success(function(data) {
            angular.extend(permit, data);
        });
    
    return {
        can: function(perm) {
            var allowed;
            
            if(permit.permissions)
                allowed = permit.permissions.indexOf(perm) !== -1;
            
            return allowed || permit.super;
        }
    };
});
