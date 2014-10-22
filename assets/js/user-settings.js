angular.module('settings', ['ui.bootstrap'])
.controller('UserSettingsCtrl', function($scope, $modal, $http){
    
    $http.get('/api/user/info')
    .success(function(data){
        $scope.user = data;
    });
    
    
    var confirmPass = function() {
        var modalInstance = $modal.open({
            templateUrl: '/partials/settings/confirm-password.html'
        });
        
        return modalInstance;
    };
    
    $scope.saveName = function() {
        confirmPass().result.then(function(pass) {
            
            $http.post('/api/user/update/name', {
                userData: {
                    name: $scope.user.name,
                    lastname: $scope.user.lastname
                },
                password: pass
            })
            .success(function(data){
                if(data.error)
                    return alert(data.error);
                    
                alert(data.message);
            })
            .error(function(err){
                alert(err);
            });
        });
    };
    
    
    $scope.changePass = function() {
        confirmPass().result.then(function(pass) {
            
            $http.post('/api/user/update/password', {
                userData: {
                    newPass1: $scope.newpass1,
                    newPass2: $scope.newpass2
                },
                password: pass
            })
            .success(function(data){
                alert(data.message);
            })
            .error(function(err){
                alert(err);
            });
        });
    };
    
})
;
