angular.module('a2.service.download-resource', [
])
.service('$downloadResource', function($window){
    return function $downloadResource(resource_url){
        var a = angular.element('<a></a>').attr('target', '_blank').attr('href', resource_url).appendTo('body');
        $window.setTimeout(function(){
            a[0].click();
            a.remove();
        }, 0);        
    };
})
;