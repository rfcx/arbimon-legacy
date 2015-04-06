angular.module('a2forms',['templates-arbimon2'])
.run(function($window) {
    
    // load zxcvbn 
    var loadZXCVBN = function() {
        var a, b;
        b = $window.document.createElement("script");
        b.src = "/assets/zxcvbn/zxcvbn.js";
        b.type = "text/javascript";
        b.async = !0;
        a = $window.document.getElementsByTagName("script")[0];
        return a.parentNode.insertBefore(b, a);
    };
    if($window.attachEvent)
        $window.attachEvent("onload", loadZXCVBN);
    else
        $window.addEventListener("load", loadZXCVBN, !1);
})
.directive('passwordInput', function($window) {
    return {
        restrict: 'E',
        scope: {
            password: '=ngModel', // password
            validation: '=', // validation object
            userInputs: '=?', // array of strings to test password (username, name, lastname, etc)
        },
        templateUrl: '/partials/directives/password-input.html',
        controller: function($scope) {
            
            $scope.requiredScore = 2;
            $scope.minLength = 6;
            $scope.maxLength = 32;
            
            var initValidation = function() {
                $scope.validation = {
                    valid: false,
                    msg: ''
                };
            };
            initValidation();
            
            
            if(!$scope.userInputs) {
                $scope.userInputs = [];
            }
            
            $scope.testConfirm = function() {
                $scope.confirmOk = '';
                $scope.confirmErr = '';
                initValidation();
                
                if(!$scope.passResult || !$scope.password){
                    return;
                }
                
                else if($scope.passResult.score < $scope.requiredScore) {
                    $scope.validation.msg = 'password need to be stronger';
                    return;
                }
                
                if($scope.password === $scope.confirm) {
                    $scope.confirmOk = true;
                    $scope.validation = {
                        valid: true,
                        msg:''
                    };
                }
                else {
                    $scope.validation.msg = $scope.confirmErr = "Passwords do not match";
                }
            };
            
            
            $scope.testPass = function() {
                // wait for zxcvbn library to be available
                if(typeof $window.zxcvbn === 'undefined') {
                    if($scope.waitForZxcvbn) return;
                    
                    $scope.waitForZxcvbn = $interval(function() {
                        if(typeof $window.zxcvbn !== 'undefined') {
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
                initValidation();
                
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
                
                if(!$scope.password) {
                    return;
                }
                else if($scope.password.length < 6 || $scope.password.length > 32) {
                    var size = ($scope.password.length < 6) ? 'short' : 'long';
                    
                    $scope.passResult.shields = [];
                    $scope.passResult.color = colors[0];
                    $scope.validation.msg = $scope.passResult.msg = 'Password is too '+size+', 6-32 characters';
                    
                }
                else {
                    var test = $window.zxcvbn($scope.password, $scope.userInputs);
                    
                    $scope.passResult.score = test.score;
                    
                    $scope.passResult.shields = new Array(test.score+1);
                    $scope.passResult.color = colors[test.score];
                    $scope.passResult.msg = mesgs[test.score];
                    
                    $scope.testConfirm();
                }
            };
        },
    };
})
.directive('projectForm', function() {
    return {
        restrict: 'E',
        scope: {
            project: '=ngModel', // password
            valid: '=', // validation object
        },
        templateUrl: '/partials/directives/project-form.html',
        controller: function($scope) {
            console.log('project-form');
            $scope.project = {
                is_private: 0,
            };
            $scope.valid = false;
            
            var urlPattern = /^[a-z0-9]+([-_][a-z0-9]+)*$/;
            
            $scope.verify = function () {
                var good = true;
                $scope.errorName = '';
                $scope.errorUrl = '';
                $scope.errorDesc = '';
                
                // check name
                if(!$scope.project.name) {
                    good = false;
                }
                else if($scope.project.name.length < 6 && $scope.project.name.length > 0) {
                    $scope.errorName = 'Name too short, 6 or more characters required';
                    good = false;
                }
                else if($scope.project.name.length > 50) {
                    $scope.errorName = 'Name too long, 50 characters max';
                    good = false;
                }
                
                //check URL
                if(!$scope.project.url) {
                    good = false;
                }
                else if(!urlPattern.test($scope.project.url)) {
                    $scope.errorUrl = 'Invalid project URL alphanumeric characters '+
                               'separated by dash(-) or underscore(_)';
                    good = false;
                }
                else if($scope.project.url.length < 6) {
                    $scope.errorUrl = 'URL too short, 6 or more alphanumeric characters '+
                               'separated by dash(-) or underscore(_)';
                    good = false;
                }
                else if($scope.project.url.length > 50) {
                    $scope.errorUrl = 'URL too long, 50 characters max';
                    good = false;
                }
                
                // check description
                if(!$scope.project.description) {
                    good = false;
                }
                else if($scope.project.description.length < 50 && $scope.project.description.length > 0) {
                    $scope.errorDesc = 'Description needs to be at least 50 characters '+
                                       'long, you have ' + $scope.project.description.length;
                    
                    good = false;
                }
                
                $scope.valid = good;
            };
        }
    };
})
;
