angular.module('a2.heremaps',[])
.constant('a2HereMarkerTextIconTemplate', 
    '<div class="map-marker">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="28px" height="36px">' +
        '<path d="M 19 31 C 19 32.7 16.3 34 13 34 C 9.7 34 7 32.7 7 31 C 7 29.3 9.7 28 13 28 C 16.3 28 19 29.3 19 31 Z" fill="#000" fill-opacity=".2"/>' +
        '<path d="M 13 0 C 9.5 0 6.3 1.3 3.8 3.8 C 1.4 7.8 0 9.4 0 12.8 C 0 16.3 1.4 19.5 3.8 21.9 L 13 31 L 22.2 21.9 C 24.6 19.5 25.9 16.3 25.9 12.8 C 25.9 9.4 24.6 6.1 22.1 3.8 C 19.7 1.3 16.5 0 13 0 Z" fill="#fff"/>' +
        '<path d="M 13 2.2 C 6 2.2 2.3 7.2 2.1 12.8 C 2.1 16.1 3.1 18.4 5.2 20.5 L 13 28.2 L 20.8 20.5 C 22.9 18.4 23.8 16.2 23.8 12.8 C 23.6 7.07 20 2.2 13 2.2 Z" fill="#18d"/>' +
        '</svg>' +
        '<span>${text}</span>' +
    '</div>'
)
.provider("a2HereMapsLoader", function(){
    var defer;
    var appId;
    var appCode;
    
    function loadScript($window, $q, a2HereMarkerTextIconTemplate) {
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
            var api = $window.H;
            return {
                api: api,
                makeTextIcon: function(text){
                    return new H.map.DomIcon(a2HereMarkerTextIconTemplate.replace('${text}', text));
                },
                platform: api.service.Platform({
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