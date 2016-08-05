/**
 * @ngdoc overview
 * @name visualizer-sidebar
 * @description
 * Sidebar directive for the visualizer module.
 */
angular.module('a2.visualizer.directive.sidebar', [
])
.directive('visualizerSidebar', function(){
    return {
        restrict: 'E',
        transclude: true,
        templateUrl: '/app/visualizer/visualizer-sidebar.html',
        scope:{
            closed:'=?'
        },
        link: function(scope, element, attrs){
            element.addClass("sidebar show");
            checkClosed();
            
            scope.toggleSidebar = function(){
                scope.closed = !scope.closed;
                checkClosed();
            };
            
            function checkClosed(){
                // element[scope.closed ? 'addClass' : 'removeClass']("collapsed");
            }
        }
    };
})
;