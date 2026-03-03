angular.module('a2.srv.local-storage', [
])
.service('$localStorage', function($window){
    return {
        getItem: function(item){
            if (!$window.localStorage) return null;
            const raw = $window.localStorage.getItem(item);
            if (raw === null) return null;
            try {
                return JSON.parse(raw);
            } catch(err) {
                return raw;
            }
        },
        setItem: function(item, value){
            if (!$window.localStorage) return;
            var toStore
            if (typeof value === 'object') {
                toStore = JSON.stringify(value)
            }
            else { toStore = String(value) };
            $window.localStorage.setItem(item, toStore);
        },
    };
})
;
