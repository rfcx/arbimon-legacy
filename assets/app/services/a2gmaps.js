angular.module('a2.googlemaps',[])
.provider("a2GoogleMapsLoader", function(){
    var defer;
    var apiKey;

    function loadScript($window, $q) {
        if(!defer){
            return;
        }

        var cb_name = 'gmcb';
        while($window[cb_name]){
            cb_name+='_';
        }

        $window[cb_name] = function(){
            defer.resolve($window.google);
        };

        var script = $window.document.createElement('script');
        var params = ['callback='+cb_name];
        if(apiKey){
            params.push('key='+apiKey);
        }
        params.push('libraries=marker');
        script.src = $window.document.location.protocol + '//maps.googleapis.com/maps/api/js?'+params.join('&');
        $window.document.body.appendChild(script);
    }

    return {
        setAPIKey: function(key){
            apiKey = key;
        },
        $get: function($window, $q){
            if(!defer){
                defer = $q.defer();
                loadScript($window, $q);
            }
            return defer.promise;
        }
    };
})
;
