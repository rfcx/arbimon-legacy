angular.module('a2.forms',['templates-arbimon2'])
.run(function($window) {
    
    // load zxcvbn 
    var loadZXCVBN = function() {
        var a, b;
        b = $window.document.createElement("script");
        b.src = "/includes/zxcvbn/zxcvbn.js";
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
        templateUrl: '/directives/password-input.html',
        controller: function($scope) {
            
            $scope.requiredScore = 2;
            $scope.minLength = 6;
            $scope.maxLength = 32;
            
            $scope.validation = getValidation();
            
            function getValidation(){
                return $scope.validation || ($scope.validation = {
                    confirm:null,
                    result:{},
                    valid:false,
                    msg: ''
                });
            }
            
            
            if(!$scope.userInputs) {
                $scope.userInputs = [];
            }
            
            $scope.testConfirm = function() {
                var validation = getValidation();
                validation.result.confirm = null;
                
                if(!validation.result.pass || !$scope.password){
                    return;
                }
                
                else if(validation.result.pass.score < $scope.requiredScore) {
                    $scope.validation.msg = 'password need to be stronger';
                    return;
                }
                
                if($scope.password === validation.confirm) {
                    validation.result.confirm = {ok:true};
                    validation.valid = true;
                    validation.msg = '';
                } else {
                    validation.result.confirm = {err:"Passwords do not match"};
                    validation.msg = validation.result.confirm.err;
                }
            };
            
            
            $scope.testPass = function() {
                var validation = getValidation();
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
                
                validation.result.pass = null;
                
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
                } else if($scope.password.length < 6 || $scope.password.length > 32) {
                    var size = ($scope.password.length < 6) ? 'short' : 'long';
                    
                    validation.result.pass = {
                        shields : [],
                        color   : colors[0],
                        msg     : 'Password is too '+size+', 6-32 characters'
                    };
                    
                    $scope.validation.msg = validation.result.pass.msg;                    
                } else {
                    var test = $window.zxcvbn($scope.password, $scope.userInputs);
                    
                    validation.result.pass = {
                        score   : test.score,
                        shields : new Array(test.score+1),
                        color   : colors[test.score],
                        msg     : mesgs[test.score],
                    };
                    
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
        templateUrl: '/directives/project-form.html',
        controllerAs:'controller',
        controller: function($scope) {
            var urlPattern = /^[a-z0-9]+([-_][a-z0-9]+)*$/i;
            
            this.deriveUrlFromName = true;
            this.nameChanged = function(){
                if(this.deriveUrlFromName){
                    $scope.project.url = ($scope.project.name || '').replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').replace(/[A-Z]/g, function(_1){
                        return _1.toLowerCase();
                    });
                }
                $scope.verify();
            };
            this.urlChanged = function(){
                this.deriveUrlFromName = false;
                $scope.verify();
            };
            
            $scope.verify = function () {
                var good = true;
                $scope.errorName = '';
                $scope.errorUrl = '';
                
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
                
                $scope.valid = good;
                return good;
            };
            
            if($scope.project) {
                $scope.verify();
            }
            else {
                $scope.project = { is_private: 1 };
                $scope.valid = false;
            }
            
            $scope.$watch('project', function() {
                $scope.verify();
            });
        }
    };
})
;
