angular.module('a2.utils.facebook-login-button', [
    'a2.utils',
    'a2.utils.global-anonymous-function',
    'a2.utils.external-api-loader',
    'a2.injected.data',
])
.config(function(externalApiLoaderProvider){
    externalApiLoaderProvider.addApi('facebook', {
        url: "//connect.facebook.net/en_US/sdk.js",
        namespace: 'FB',
        onload: ["a2InjectedData", function(a2InjectedData){
            this.module.init(a2InjectedData.facebook_api);
        }]
    });
})
.directive('a2FacebookLoginButton', function($window, $q, $timeout, a2InjectedData, externalApiLoader){
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
                externalApiLoader.load('facebook').then(function(FB){
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