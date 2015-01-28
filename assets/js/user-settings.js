angular.module('settings', ['templates-arbimon2', 'ui.bootstrap', 'humane','angularytics']).
config(function(AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
}).
run(function(Angularytics) {
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
                    notify.error('Error Communicating with Server');
                    
                }
                else
                {    
                    notify.log(data.message);
                }
            })
            .error(function(err){
                notify.error('Error Communicating with Server');
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
                notify.log(data.message);
            })
            .error(function(err){
                notify.error('Error Communicating with Server');
            });
        });
    };
    
})
;
