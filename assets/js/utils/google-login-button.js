angular.module('a2.utils.google-login-button', [
    'a2.utils',
    'a2.utils.q-promisify',
    'a2.utils.global-anonymous-function',
    'a2.utils.external-api-loader',
    'a2.injected.data',
])
.config(function(externalApiLoaderProvider){
    externalApiLoaderProvider.addApi('google-api', {
        url: "https://apis.google.com/js/client.js",
        namespace: 'gapi',
        jsonpCallback: 'onload'
    });
    externalApiLoaderProvider.addApi('google-api/auth2', {
        parent: 'google-api',
        loader: ["$qPromisify", function($qPromisify){
            return $qPromisify.invoke(this.parent.module, 'load', 'auth2');
        }],
        onload: ["a2InjectedData", function(a2InjectedData){
            var auth2 = this.module.init({
                client_id: a2InjectedData.google_oauth_client,
                cookiepolicy: 'single_host_origin',
            });
            return auth2.then((function(){
                this.module.auth2 = auth2;
            }).bind(this));
        }],
        getCachedModule: function(){
            return this.parent && this.parent.module && this.parent.module.auth2;
        },
    });
})
.directive('a2GoogleLoginButton', function($window, $q, $timeout, globalAnonymousFunction, a2InjectedData, externalApiLoader){
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
                externalApiLoader.load('google-api/auth2').then(function(auth2){
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
;