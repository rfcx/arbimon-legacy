angular.module('a2.utils.google-login-button', [
    'a2.utils',
    'a2.injected.data'
])
.factory('globalAnonymousFunction', function($window){
    var ct=0;
    return function(fn, options){
        console.log("return function(fn, options)", fn, options);
        var wrapperFn = function(){
            if(options && options.oneTime){
                wrapperFn.remove();
            }
            fn.apply(this, Array.prototype.slice.call(arguments));
        };
        
        wrapperFn.id = '__g_a_f_'+(ct++);
        $window[wrapperFn.id] = wrapperFn;        
        
        wrapperFn.remove = function(){
            if($window[wrapperFn.id] == wrapperFn){
                delete $window[wrapperFn.id];
            }
        };
        
        return wrapperFn;        
    };
})
.service('a2GoogleAPIClient', function($q, $window, globalAnonymousFunction){
    var APIURL = "https://apis.google.com/js/client.js";
    function loadAPI(){
        if($window.gapi){
            return $q.resolve($window.gapi);
        } else {
            if(!loadAPI.promise){
                loadAPI.promise = $q(function(resolve){
                    angular.element('head')
                        .append('<script src="'+APIURL+'?onload='+globalAnonymousFunction(function(){
                            resolve($window.gapi);
                        }, {oneTime:true}).id+'" async defer></script>');
                });                
            }
            return loadAPI.promise;
        }
    }
    return {
        get: function(module){
            return loadAPI().then(function(gapi){
                if(gapi[module]){
                    return gapi[module];
                } else {
                    return $q(function(resolve){
                        gapi.load(module, function(){
                            resolve(gapi[module]);
                        });
                    });
                }
            });
        }
    };
})
.directive('a2GoogleLoginButton', function($window, $q, $timeout, globalAnonymousFunction, a2InjectedData, a2GoogleAPIClient){
    function initializeAuth2(){
        if(!initializeAuth2.promise){
            var auth2;
            initializeAuth2.promise = a2GoogleAPIClient.get('auth2').then(function(gapiAuth2){
                auth2 = gapiAuth2.init({
                    client_id: a2InjectedData.google_oauth_client,
                    cookiepolicy: 'single_host_origin',
                });
                return auth2.then(function(){
                    // wait for initialization, but beware, this promise is ill-behaved....
                });
            }).then(function(){
                return {'auth2': auth2};
            });
        }
        return initializeAuth2.promise;
    }
    return {
        restrict: 'E',
        templateUrl : '/partials/utils/google-login-button.html',
        scope:{
            onSignedIn:'&?',
            onError:'&?'
        },
        link: function(scope, element, attrs){
            element.children('.btn-google-login').addClass(element[0].className);
            element[0].className = '';
            
            scope.signIn = function(){
                initializeAuth2().then(function(auth2){
                    auth2.auth2.signIn().then(
                        function(user){
                            scope.onSignedIn({user:user});
                        },
                        function (error){
                            scope.onError({error:error});
                        }                        
                    );
                });
            };            
        }
    };
})
.service('OAuthLoginService', function(a2EventEmitter){
    var events = new a2EventEmitter();
    return {
        on : events.on.bind(events),
        off: events.off.bind(events),
        notifyLoggedIn: function(event){
            events.emit('logged-in', event);
        }
    };
})
;