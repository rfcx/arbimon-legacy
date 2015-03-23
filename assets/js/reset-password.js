angular.module('reset-password', ['a2forms', 'humane', 'a2directives'])
.controller('ResetPassCtrl', function($scope, $http, $window, notify) {
    
    $scope.changePassword = function() {
        if(!$scope.passResult.valid) {
            notify.error($scope.passResult.msg);
        }
        
        var path = $window.location.pathname;
        
        $http.post(path, { password: $scope.password })
            .success(function(data) {
                $scope.completed = true;
            });
    };
    
})
.controller('ResetRequestCtrl', function($scope, $http, notify) {
        
        $scope.request = function() {
            $scope.loading = true;
            $http.post('/forgot_request', { email:  $scope.email })
                .success(function(data) {
                    $scope.loading = false;
                    
                    if(data.error) {
                        return notify.error(data.error);
                    }
                    
                    $scope.requestComplete = true;
                });
        };
    })
;
