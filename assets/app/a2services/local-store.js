angular.module('a2.srv.local-storage', [
])
.service('$localStorage', function($window){
    return {
        getItem: function(item){
            if($window.localStorage){
                return $window.localStorage.getItem(item);
            }
        },
        setItem: function(item, value){
            if($window.localStorage){
                $window.localStorage.setItem(item, value);
            }
        },
    };
})
;