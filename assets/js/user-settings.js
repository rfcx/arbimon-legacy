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
    this.data={};
    
    $http.get('/api/user/info').then((function(response){
        $scope.user = response.data;
        this.user = response.data;
        this.reset();
    }).bind(this));
    
    this.reset = function(){
        this.data = angular.copy(this.user);
    };
    
    var confirmPass = function() {
        var modalInstance = $modal.open({
            templateUrl: '/partials/settings/confirm-password.html'
        });
        
        return modalInstance.result;
    };
    
    this.save = function() {
        confirmPass().then(function(pass) {
            
            $http.post('/api/user/update/name', {
                userData: {
                    name: $scope.user.name,
                    lastname: $scope.user.lastname,
                    oauth: user.oauth,
                    password: $scope.newPass
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
