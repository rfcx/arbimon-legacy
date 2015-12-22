angular.module('a2.login', [
    'humane', 
    'templates-arbimon2',
    'g-recaptcha',
    'a2.utils.google-login-button'
])
.controller('LoginCtrl', function($scope, $http, $window, notify) {
    
    // $scope.mode have the String value of the next mode and 
    // is used as text for the mode button
    
    if(/login/i.exec($window.location.pathname) !== null){
        $scope.mode = "Sign up";
    }
    else {
        $scope.mode = "Login";
    }
    
    
    $scope.switchMode = function() {
        if($scope.mode === "Sign up") {
            $scope.mode = "Login";
        }
        else {
            $scope.mode = "Sign up";
        }
    };
    
    $scope.login = function() {
        
        var path = '/login' + $window.location.search;
        
        $http.post(path, { 
            username: $scope.username,
            password: $scope.password,
            captcha: $scope.captchaResp,
        })
        .success(function(data) {
            if(data.error) {
                notify.error(data.error);
                
                if(data.captchaNeeded) {
                    $scope.showCaptcha = true;
                }
                
                $scope.resetCaptcha();
                $scope.captchaResp = '';
                return;
            }
            
            if(data.success) {
                $window.location.assign(data.redirect);
            }
        })
        .error(function() {
            notify.error('Something went wrong, try again later');
        });
    };
    

    this.oAuthLogin = function(type, user){
        var oauthData;
        if(type == 'google'){
            oauthData = {
                type:'google',
                token:user.getAuthResponse().id_token
            };
        } else {
            return;
        }
        
        $http.post('/oauth-login' + $window.location.search, oauthData).success(function(data) {
            if(data.error) {
                notify.error(data.error);
                
                if(data.captchaNeeded) {
                    $scope.showCaptcha = true;
                }
                
                $scope.resetCaptcha();
                $scope.captchaResp = '';
            } else if(data.success) {
                $window.location.assign(data.redirect);
            }
        })
        .error(function() {
            notify.error('Something went wrong, try again later');
        });
    };
    
})
.controller('RedirectToLoginCtrl', function($scope, $window) {
    var redirect = $window.location.pathname + $window.location.search + $window.location.hash;
    
    $scope.loginUrl = "/login?redirect=" + encodeURIComponent(redirect);
})
;
