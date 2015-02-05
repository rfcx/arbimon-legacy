angular.module('register' , ['ui.bootstrap','angularytics', 'g-recaptcha', 'humane'])
.config(function(AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
})
.run(function(Angularytics) {
    Angularytics.init();
})
.controller('UserRegisterCtrl', function($scope, $modal, $http, $timeout, $interval, notify){
    
    var captchaResp = '';
    
    $scope.requiredScore = 2;
    
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
            $http.get('/api/login_available', {
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
            $http.get('/api/email_available', {
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
    
    
    $scope.testConfirm = function() {
        $scope.confirmOk = '';
        $scope.confirmErr = '';
        
        if(!$scope.passResult || $scope.passResult.score < $scope.requiredScore) return;
        
        if($scope.user.password === $scope.user.confirm) {
            $scope.confirmOk = true;
        }
        else {
            $scope.confirmErr = "Passwords do not match";
        }
    };
    
    
    $scope.testPass = function() {
        
        // wait for zxcvbn library to be available
        
        if(typeof zxcvbn === 'undefined') {
            if($scope.waitForZxcvbn) return;
            
            $scope.waitForZxcvbn = $interval(function() {
                if(typeof zxcvbn !== 'undefined') {
                    $interval.cancel($scope.waitForZxcvbn);
                    $scope.testPass();
                }
            }, 500);
            
            return;
        }
        
        if($scope.waitForZxcvbn) {
            $interval.cancel($scope.waitForZxcvbn);
        }
        
        
        $scope.passResult = {};
        var colors = [
            '#da3939',
            '#da3939',
            '#84b522',
            '#62b522',
            '#31b523',
        ];
        
        var mesgs = [
            'Very Weak',
            'Weak',
            'Average',
            'Strong',
            'Very strong',
        ];
        
        if(!$scope.user.password) {
            return;
        }
        else if($scope.user.password.length < 6) {
            
            $scope.passResult.shields = new Array(1);
            $scope.passResult.color = colors[0];
            $scope.passResult.msg = 'Too short, 6 characters or more';
            return;
        }
        
        var test = zxcvbn($scope.user.password, [
            $scope.user.firstName || '',
            $scope.user.lastName || '',
            $scope.user.username || '',
        ]);
        
        $scope.passResult.score = test.score;
        
        
        $scope.passResult.shields = new Array(test.score+1);
        $scope.passResult.color = colors[test.score];
        $scope.passResult.msg = mesgs[test.score];
    
        $scope.testConfirm();
    };
    
    
    $scope.register =  function($event) {
        if($scope.user.password !== $scope.user.confirm) {
            notify.log('Passwords dont match');
        }
        else if($scope.passResult.score < $scope.requiredScore) {
            notify.log('Password is too weak');
        }
        else if($scope.user.password.length > 32) {
            notify.log('Password is too long, max size 32 characters');
        }
        else if($scope.usernameErr) {
            notify.log($scope.usernameErr);
        }
        else if($scope.emailErr) {
            notify.log($scope.emailErr);
        }
        else if(!$scope.terms_accepted) {
            notify.log('To register you must agree with our terms of service');
        }
        else if(!captchaResp) {
            notify.log('Please complete the captcha');
        }
        else {
            $http.post('/register', {
                user: $scope.user,
                captcha: captchaResp,
                newsletter: $scope.newsletter
            })
            .success(function(data) {
                if(data.success) {
                    $scope.completed = true;
                }
            })
            .error(function(data) {
                if(data.error) {
                    return notify.error(data.error);
                }
                notify.error("something went wrong, please try again later");
            });
        }
    };
    
    $scope.captchaResponse = function(response) {
        captchaResp = response;
    };
})
;
