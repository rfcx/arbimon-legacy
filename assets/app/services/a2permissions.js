angular.module('a2.permissions', [
    'a2.services',
    'ng-permissions'
])
.run(function($rootScope, a2UserPermit){
    $rootScope.userPermit = a2UserPermit;
})
.service('a2UserPermit', function($http, Project, $q, permits) {
    var permit = permits;

    return {
        all: permit.permissions,
        isSuper: function(){
            return permit.super;
        },
        isRfcx: function(){
            return permit.rfcxUser;
        },
        isAuthorized: function(){
            return permit.isAuthorized;
        },
        isProjectMember: function() {
            return permit.isAuthorized && ((permit.permissions && permit.permissions.length > 0) || permit.super || permit.rfcxUser) ;
        },
        getUserEmail: function() {
            return permit.userEmail;
        },
        getUserImage: function() {
            return permit.userImage;
        },
        getUserRole: function() {
            return permit.userRole;
        },
        getUserFullName: function() {
            return permit.userFullName;
        },
        getUserId: function() {
            return permit.userId;
        },
        has: function(feature) {
            return permit.features && permit.features[feature];
        },
        can: function(perm) {
            var allowed;

            if(permit.permissions){
                allowed = (Array.isArray(perm) ? perm : [perm]).reduce(function(_, perm) {
                    return _ && permit.permissions.indexOf(perm) !== -1;
                }, true);
            }

            return allowed || permit.super;
        }
    };
})
;
