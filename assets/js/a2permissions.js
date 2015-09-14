angular.module('a2.permissions', [
    'a2.services',
    'ng-permissions'
])
.service('a2UserPermit', function($http, Project, $q, permits) {
    var permit = permits;
    
    return {
        can: function(perm) {
            var allowed;
            
            if(permit.permissions)
                allowed = permit.permissions.indexOf(perm) !== -1;
            
            return allowed || permit.super;
        }
    };
});
