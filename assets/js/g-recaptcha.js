angular.module('g-recaptcha',[])
.directive('gRecaptcha', ['$interval', function($interval){
    return {
        restrict: "A",
        scope: {
            sitekey: '@',
            theme: '@?',
            type: '@?',
            callback: '&'
        },
        link: function(scope, element, attr) {
            var waitForRecaptcha = $interval(function(){
                if(typeof grecaptcha !== 'undefined') {
                    $interval.cancel(waitForRecaptcha);
                    
                    grecaptcha.render(element[0], {
                        sitekey: scope.sitekey,
                        theme: scope.theme,
                        type: scope.type,
                        callback: function(response) {
                            scope.callback({ response: response});
                        }
                    });
                }
            }, 500);
            
        }
    };
}])
;
