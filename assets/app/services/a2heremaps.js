angular.module('a2.heremaps',[])
.provider("a2HereMapsLoader", function(){
    var defer;
    var appId;
    var appCode;
    
    function loadScript($window, $q) {
        if(!defer){ 
            return;
        }
        
        $q.all([
            "//js.api.here.com/v3/3.0/mapsjs-core.js",
            "//js.api.here.com/v3/3.0/mapsjs-service.js"
        ].map(function(src){
            return $q(function(resolve, reject){
                var script = $window.document.createElement('script');
                script.src = $window.document.location.protocol + src;
                script.addEventListener('load', resolve);
                script.addEventListener('error', reject);                
                $window.document.body.appendChild(script);
            });
        })).then(function (){
            return {
                api: $window.H,
                platform: $window.H.service.Platform({
                    app_id: appId,
                    app_code: appCode
                })
            };
        });
    }
    
    return {
        setAPIIdAndCode: function(id, code){
            appId = id;
            appCode = code;
        },        
        $get: function($window, $q){
            console.log("$get: function($window, $q){");
            if(!defer){
                defer = $q.defer();
                loadScript($window, $q);
            }
            return defer.promise;
        }
    };
})
;