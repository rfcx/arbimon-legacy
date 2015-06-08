angular.module('a2.user-settings', [
    'templates-arbimon2', 
    'a2.forms',
    'ui.bootstrap', 
    'humane', 
    'angularytics', 
])
.config(function(AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
})
.run(function(Angularytics) {
    Angularytics.init();
})
.controller('UserSettingsCtrl', function($scope, $modal, $http, notify){
    
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
                {
                    notify.serverError();
                    
                }
                else
                {    
                    notify.log(data.message);
                }
            })
            .error(function(err){
                notify.serverError();
            });
        });
    };
    
    
    $scope.changePass = function() {
        console.log($scope.passResult);
        
        if(!$scope.passResult.valid) {
            return notify.log($scope.passResult.msg);
        }
        
        confirmPass().result.then(function(pass) {
            $http.post('/api/user/update/password', {
                userData: {
                    newPass: $scope.newPass,
                },
                password: pass
            })
            .success(function(data){
                notify.log(data.message);
            })
            .error(function(err){
                notify.serverError();
            });
        });
    };
    
})
;
