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
        return $modal.open({
            templateUrl: '/partials/settings/confirm-password.html'
        }).result;
    };
    
    this.save = function() {
        var data = this.data;
        return confirmPass().then(function(pass) {
            return $http.post('/api/user/update', {
                userData: {
                    name     : data.name,
                    lastname : data.lastname,
                    oauth    : data.oauth,
                    password : data.password
                },
                password: pass
            }).then(function(response){
                if(response.data.error){
                    notify.error(response.data.error);
                } else {
                    notify.log(response.data.message);
                }
            }).catch(function(err){
                console.log("err", err);
                notify.serverError();
            });
        });
    };
        
})
;
