angular.module('test-utils', [])
.factory('$pumpRootScope', function($rootScope, $browser){
    return function(ms){
        if($browser.deferredFns && $browser.deferredFns.length){
            $browser.defer.flush(ms);
        }
        $rootScope.$digest();
    };
})
;