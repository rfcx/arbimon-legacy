angular.module('arbimon.directive.a2-switch', [
])
.directive('a2Switch', function(){
    return {
        restict:'E',
        templateUrl: '/directives/a2-switch/template.html',
        require: 'ngModel',
        scope:{
            onText :'@',
            offText :'@'
        },
        link: function(scope, element, attrs, ngModelCtrl){
            scope.toggle = function(event) {
                scope.value = !scope.value;
                ngModelCtrl.$setViewValue(scope.value, event && event.type);
            };

            ngModelCtrl.$render = function() {
                scope.value = !!ngModelCtrl.$viewValue;
            };
        }
    };
})
;
