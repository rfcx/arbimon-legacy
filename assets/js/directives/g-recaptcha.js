angular.module('g-recaptcha',[])
.directive('gRecaptcha', function($interval, $timeout, $window) {
        return {
            restrict: "A",
            scope: {
                sitekey: '@',
                theme: '@?',
                type: '@?',
                response: '=',    // readonly captchaResponse 
                resetWidget: '=?' // readonly method to reset the widget
            },
            link: function(scope, element, attr) {
                var waitForRecaptcha = $interval(function(){
                    if(typeof $window.grecaptcha !== 'undefined') {
                        $interval.cancel(waitForRecaptcha);
                        var grecaptcha = $window.grecaptcha;
                        
                        scope.widgetId = grecaptcha.render(element[0], {
                            sitekey: scope.sitekey,
                            theme: scope.theme,
                            type: scope.type,
                            callback: function(response) {
                                scope.response = response;
                                scope.$apply();
                                
                                scope.resetTimeout = $timeout(function() {
                                    grecaptcha.reset(scope.widgetId);
                                }, 30000);
                            }
                        });
                        
                        scope.resetWidget = function() {
                            if(scope.resetTimeout) {
                                $timeout.cancel(scope.resetTimeout);
                            }
                            grecaptcha.reset(scope.widgetId);
                        };
                    }
                }, 500);
            }
        };
    })
;
