angular.module('a2.utils.facebook-login-button', [
    'a2.utils',
    'a2.utils.global-anonymous-function',
    'a2.injected.data',
])
.service('a2FacebookAPIClient', function($q, $window, $timeout, a2InjectedData){
    var APIURL = "//connect.facebook.net/en_US/sdk.js";
    // var APIURL = "https://www.facebook.com/dialog/oauth?";
    function loadAPI(){
        if($window.gapi){
            return $q.resolve($window.FB);
        } else {
            if(!loadAPI.promise){
                loadAPI.promise = $q(function(resolve, reject){
                    var script = $window.document.createElement('script');
                    angular.element($window.document.head).append(script);
                    script.onload = function(){
                        $window.FB.init(a2InjectedData.facebook_api);
                        resolve($window.FB);
                    };
                    script.onerror = function(){
                        reject();
                    };
                    script.src=APIURL;
                });
            }
            return loadAPI.promise;
        }
    }
    return {
        get: function(){
            return loadAPI();
        }
    };
})
.directive('a2FacebookLoginButton', function($window, $q, $timeout, a2InjectedData, a2FacebookAPIClient){
    return {
        restrict: 'E',
        templateUrl : '/partials/utils/facebook-login-button.html',
        scope:{
            onSignedIn:'&?',
            onError:'&?'
        },
        link: function(scope, element, attrs){
            element.children('.btn-facebook-login').addClass(element[0].className);
            element[0].className = '';
            
            scope.signIn = function(){
                a2FacebookAPIClient.get().then(function(FB){
                    FB.login(function(response){
                        if(response.status === 'connected') {
                            console.log(response);
                            scope.onSignedIn({user:response});
                        } else if (response.status === 'not_authorized') {
                        } else {
                        }
                    }, {scope: 'public_profile,email'});
                });
            };
        }
    };
})
;