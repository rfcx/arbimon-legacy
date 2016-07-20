angular.module('arbimon2.directive.validation-dropdown', [])
.directive('validationDropdown', function(){
    var empty_option = {label:undefined, val:undefined};
    var val_options = [
        { label: "Clear",   val: 2 },
        { label: "Present", val: 1 }, 
        { label: "Absent",  val: 0 }, 
    ];
    var by_val = val_options.reduce(function(_, option){
        _[option.val] = option;
        return _;
    }, {});

    return {
        templateUrl: '/directives/validation-dropdown.html',
        require:'ngModel',
        scope:{
        }, 
        link: function(scope, element, attrs, ngModelCtrl){
            scope.options = val_options;

            function updateLabel(val){
                var option = val < 2 && by_val[val] ? by_val[val] : empty_option;
                scope.val = option.val;
                scope.label = option.label;
            }
            
            scope.select = function(val) {
                updateLabel(val);
                ngModelCtrl.$$lastCommittedViewValue = undefined;
                ngModelCtrl.$modelValue = undefined;
                ngModelCtrl.$setViewValue(val, true);
            };

            ngModelCtrl.$render = function() {
                updateLabel(ngModelCtrl.$viewValue);
            };
        }
    };
});