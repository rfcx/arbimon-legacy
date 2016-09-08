angular.module('a2.directive.require-non-empty', [
])
.directive('requireNonEmpty', function(){
    return {
        restrict: 'A',
        require: '?ngModel',
        link: function(scope, elm, attr, ctrl) {
            if(!ctrl){
                return;
            }
            
            attr.required = true; // force truthy in case we are on non input element

            ctrl.$validators.required = function(modelValue, viewValue){
                return !attr.required || !(
                    ctrl.$isEmpty(viewValue) ||
                    (viewValue instanceof Array && !viewValue.length)
                );
            };

            attr.$observe('required', function(){
                ctrl.$validate();
            });
        }
    };
})
;