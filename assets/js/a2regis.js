angular.module('a2regis',['templates-arbimon2'])
.directive('passwordInput', [function() {
    return {
        restrict: 'E',
        scope: {
            password: '=ngModel', // password
            validation: '=', // validation object
            userInputs: '=?', // array of strings to test password (username, name, lastname, etc)
        },
        templateUrl: '/partials/directives/password-input.html',
        controller: ['$scope', function($scope) {
            
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
                    var test = zxcvbn($scope.password, $scope.userInputs);
                    
                    $scope.passResult.score = test.score;
                    
                    $scope.passResult.shields = new Array(test.score+1);
                    $scope.passResult.color = colors[test.score];
                    $scope.passResult.msg = mesgs[test.score];
                    
                    $scope.testConfirm();
                }
            };
        }],
    };
}])
;
