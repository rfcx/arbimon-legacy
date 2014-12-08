
(function(angular)
{ 
    
    var register = angular.module('register' , ['ui.bootstrap','angularytics']);
    
    register.config(function(AngularyticsProvider) {
       AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
    });
    register.run(function(Angularytics) {
        Angularytics.init();
    });  
    register.controller('UserRegisterCtrl', function($scope, $modal, $http){
        
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

