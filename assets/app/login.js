angular.module('a2.login', [
    'humane',
    'ui.bootstrap',
    'templates-arbimon2',
    'g-recaptcha',
    'a2.utils.google-login-button',
    'a2.utils.facebook-login-button'
])
.controller('LoginCtrl', function($scope, $http, $window, $modal, notify) {

    $scope.login = function() {

        var path = '/login' + $window.location.search;

        $http.post(path, {
            username: $scope.username,
            password: $scope.password,
            captcha: $scope.captchaResp,
        })
        .success(function(data) {
            if(data.error) {
                notify.error(data.error);

                if(data.captchaNeeded) {
                    $scope.showCaptcha = true;
                }

                $scope.resetCaptcha();
                $scope.captchaResp = '';
                return;
            }

            if(data.success) {
                $window.location.assign(data.redirect);
            }
        })
        .error(function(error) {
            notify.error(error || 'Something went wrong, try again later');
        });
    };


    this.oAuthLogin = function(type, user){
        var oauthData;
        if(type == 'google'){
            oauthData = {
                type:'google',
                token:user.getAuthResponse().id_token
            };
        } else if(type == 'facebook'){
            oauthData = {
                type:'facebook',
                token:user.authResponse.accessToken
            };
        } else {
            return;
        }

        $http.post('/oauth-login' + $window.location.search, oauthData).then(function(response){
            var data = response.data;
            if(data.error) {
                notify.error(data.error);
            } else if(data.success) {
                $window.location.assign(data.redirect);
            }
        }).catch((function(response) {
            if(response.status == 449){
                return this.showEnableOAuthModal(oauthData);
            } else {
                notify.error(response.data || 'Something went wrong, try again later');
            }
        }).bind(this));
    };

    this.showEnableOAuthModal = function(oauthData){
        var modalData={};
        $modal.open({
            templateUrl: '/common/templates/authorize-enter-credentials-pop-up.html',
            controller: function() {
                this.title = "User Authorization Required";
                this.data = modalData;
                this.oauthType = oauthData.type;
                this.messages = [
                    "Before using " + oauthData.type + " to sign into your account you must first allow it."
                ];
                this.authorizeMessage = "Authorize " + oauthData.type + " sign-in on my account.";
                this.btnOk = "Confirm";
                this.btnCancel = "Cancel";
            },
            controllerAs: 'popup'
        }).result.then(function() {
            if(!modalData.authorized){
                notify.error("Login authorization canceled.");
            } else {
                $http.post('/oauth-login' + $window.location.search, angular.extend({}, oauthData, {
                    authorize : 1,
                    username : modalData.username,
                    password : modalData.password,
                })).then(function(response){
                    var data = response.data;
                    if(data.error) {
                        notify.error(data.error);
                    } else if(data.success) {
                        $window.location.assign(data.redirect);
                    }
                }).catch((function(response) {
                    if(response.status == 449){
                        return this.showEnableOAuthModal(oauthData);
                    } else {
                        notify.error(response.data || 'Something went wrong, try again later');
                    }
                }).bind(this));
            }
        });
    };
})
.controller('RedirectToLoginCtrl', function($scope, $window) {
    var redirect = $window.location.pathname + $window.location.search + $window.location.hash;

    $scope.loginUrl = "/login?redirect=" + encodeURIComponent(redirect);
})
;
