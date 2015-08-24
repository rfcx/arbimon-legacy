angular.module('a2.login', ['humane', 'g-recaptcha'])
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
    
});
