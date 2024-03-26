angular.module('a2.user-settings', [
    'templates-arbimon2', 
    'a2.forms',
    'ui.bootstrap', 
    'humane', 
])
.controller('UserSettingsCtrl', function($scope, $modal, $http, notify){
    this.data={};
    
    $http.get('/legacy-api/user/info').then((function(response){
        $scope.user = response.data;
        this.user = response.data;
        this.reset();
    }).bind(this));
    
    this.reset = function(){
        this.data = angular.copy(this.user);
    };
    
    this.save = function() {
        var data = this.data;
        return $http.post('/legacy-api/user/update', {
            userData: {
                name     : data.name,
                lastname : data.lastname,
                oauth    : data.oauth
            }
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
    };
        
})
;
