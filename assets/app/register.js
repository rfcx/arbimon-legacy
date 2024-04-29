angular.module('a2.register' , [
    'a2.forms', 
    'a2.directives',
    'ui.bootstrap',
    'g-recaptcha', 
    'humane', 
])
.controller('UserRegisterCtrl', function($scope, $modal, $http, $timeout, $interval, notify){
    
    var captchaResp = '';
    
    $scope.testUsername = function() {
        
        $scope.usernameOk = '';
        $scope.usernameErr = '';
        
        if($scope.testUserTimeout) {
            $timeout.cancel($scope.testUserTimeout);
        }
        
        if($scope.regis.username.$error.required) {
            return;
        }
        else if($scope.regis.username.$error.pattern) {
            $scope.usernameErr = "Username must be at least 4 characters long "+
                                 "and can only contain alphanumeric characters,"+
                                 " dash(-), underscore(_) and dot(.).";
            return;
        }
        
        $scope.testUserTimeout = $timeout(function(){
            $http.get('/legacy-api/login_available', {
                params: {
                    username: $scope.user.username
                }
            })
            .success(function(data) {
                if(data.available) {
                    $scope.usernameOk = $scope.user.username + " is available";
                }
                else {
                    $scope.usernameErr = $scope.user.username + " is not available";
                }
            });
        }, 1000);
    };
    
    $scope.testEmail = function() {
        $scope.emailOk = '';
        $scope.emailErr = '';
        
        if($scope.testEmailTimeout) {
            $timeout.cancel($scope.testEmailTimeout);
        }
        
        if($scope.regis.email.$error.required) {
            return;
        }
        else if($scope.regis.email.$error.email) {
            $scope.emailErr = "Invalid email";
            return;
        }
        
        
        $scope.testEmailTimeout = $timeout(function(){
            $http.get('/legacy-api/email_available', {
                params: {
                    email: $scope.user.email
                }
            })
            .success(function(data) {
                if(data.available) {
                    $scope.emailOk = $scope.user.email + " is available";
                }
                else {
                    if(data.invalid) {
                        $scope.emailErr = $scope.user.email + " is not a valid address";
                    }
                    else {
                        $scope.emailErr = $scope.user.email + " is not available";
                    }
                }
            });
        }, 1000);
    };
    
    
    $scope.register =  function($event) {
        if(!$scope.passResult.valid) {
            notify.error($scope.passResult.msg);
        }
        else if($scope.usernameErr) {
            notify.error($scope.usernameErr);
        }
        else if($scope.emailErr) {
            notify.error($scope.emailErr);
        }
        else if(!$scope.terms_accepted) {
            notify.log('To register you must agree with our terms of service');
        }
        else if(!$scope.captchaResp && !$scope.captchaNotNeeded) {
            notify.log('Please complete the captcha');
        } else {
            $scope.loading = true;
            $http.post('/register', {
                user: $scope.user,
                captcha: $scope.captchaResp,
                newsletter: $scope.newsletter
            }).success(function(data) {
                $scope.loading = false;
                if(data.success) {
                    $scope.completed = true;
                }

            }).error(function(data) {
                $scope.loading = false;
                if(data.error) {
                    $scope.resetCaptcha();
                    $scope.captchaResp = '';
                    return notify.error(data.error);
                }
                notify.error("something went wrong, please try again later");
            });
        }
    };
})
;
