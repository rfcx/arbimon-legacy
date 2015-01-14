
(function(angular)
{ 
    
    var register = angular.module('register' , ['ui.bootstrap','angularytics']);
    var template_root = '/partials/register/';
    
    var terms = "\
Welcome to ARBIMON2!\
<br><br>\
Thanks for using our products and services (\"Services\"). The Services are provided by Sieve-Analytics Inc. (\"SIEVE\").\
<br><br>\
By accessing the ARBIMON2 website (\"Site\") or by using our Services, you agree and acknowledge to be bounded by the terms included in this Statement. Please read them carefully. Additionally the terms included in this Statement may change at any time. We recommend that you periodically check this Site for changes. \
<br><br>\
Our Services are provided \"as is\". We don’t make any warranties about specific functions of the Services, their reliability, availability, or ability to meet your needs.\
    ";
    
    register.config(function(AngularyticsProvider) {
       AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
    });
    register.run(function(Angularytics) {
        Angularytics.init();
    });  
    register.controller('UserRegisterCtrl', function($scope, $modal, $http){
        
        $scope.terms_accepted = false;
        $scope.subscribe = true;
        $scope.data = {
            first_name : '',
            last_name : '',
            username : '',
            useremail : '',
            password : '' ,
            confirm : ''
        };   
        
        $scope.message = '';
        
        $scope.creating = function()
        {
            $scope.message = 'Creating account...';
        }
        
        $scope.terms = function()
        {
            var modalInstance = $modal.open({
                template:'<div class="modal-header"> '+
                            '<h3 class="modal-title">Sieve-Analytics Terms of Service</h3>'  +
                        '</div> ' +
                        '<div class="modal-body"> '+
                        terms+
                        '</div>' + 
                        '<div class="modal-footer">'  +
                            '<button class="btn btn-primary" ng-click="$close()"  >Ok</button>' + 
                        '</div>  '
            });  
        };
        
        $scope.buttonEnable = function () 
        {
            var emailFlag = false;
            var passwordDoNotMatch = false;
            var  passwordLength = false;

            if ( !$scope.data.useremail)
            {
                emailFlag = true;
            }
            else
            {
                emailFlag = $scope.data.useremail.length == '';
                $("#data-message").html("");
            }
            
            if ($scope.data.password != '' && $scope.data.confirm != '')
            {
                if ($scope.data.password.length < 8 )
                {
                    passwordLength = true;
                    $scope.message = 'Password must have 8 or more characters.';
                }else
                {
                    if ($scope.data.password != $scope.data.confirm )
                    {
                        $scope.message = 'Passwords do not match';
                        passwordDoNotMatch= true;
                    }
                    else
                    {
                        $scope.message = '';
                        passwordDoNotMatch = false;
                    }
                }
            }
            
            var userspaces = false;
            if ($scope.data.username != '' && $scope.data.username.split(' ').length > 1)
            {
                userspaces  = true;
                $scope.message = 'Username cannot have spaces.';
            }
            
            return  (
                     passwordLength
                     || !$scope.terms_accepted 
                     || userspaces 
                     || passwordDoNotMatch 
                     || emailFlag
                     || $scope.data.first_name == ''
                     || $scope.data.last_name == ''
                     || $scope.data.username == ''
                     || $scope.data.password == ''
                     || $scope.data.confirm == ''
                     );
        };
    })
    ;

}
)(angular);

