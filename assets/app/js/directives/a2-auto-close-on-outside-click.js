angular.module('a2.directive.a2-auto-close-on-outside-click', [])
.directive('a2AutoCloseOnOutsideClick', function($document, $rootScope){
    function getElementPath(element){
        var ancestors = [];
        element = element;
        while(element){
            ancestors.push(element);
            element = element.parentElement;
        }
        return ancestors;
    }

    return {
        restrict:'A',
        require:'?dropdown', 
        link: function(scope, element, $attrs, dropdownController) {
            $attrs.$set('autoClose', "disabled");
            
            function closeDropdown(evt){
                if(!evt || !dropdownController.isOpen()){
                    return;
                }
                
                var ancestors = getElementPath(evt.target);
                var htmlIdx = ancestors.indexOf($document[0].documentElement);
                var toggleElementIdx = ancestors.indexOf(dropdownController.toggleElement[0]);
                var elementIdx = ancestors.indexOf(dropdownController.dropdownMenu[0]);
                // console.log(htmlIdx, toggleElementIdx, elementIdx);

                if(toggleElementIdx != -1 || elementIdx != -1 || htmlIdx == -1){
                    return;
                }
                
                dropdownController.toggle(false);
                if(!$rootScope.$$phase){
                    scope.$apply();
                }
            }
            
            $document.bind('click', closeDropdown);
            
            scope.$on('$destroy', function(){
                $document.unbind('click', closeDropdown);
            });
        }
    };
})
;