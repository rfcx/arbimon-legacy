angular.module('login', ['humane', 'g-recaptcha'])
.controller('LoginCtrl', ['$scope', '$http', '$window', 'notify', function($scope, $http, $window, notify) {
    
    $scope.mode = "Login";
    
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
    
}]);
