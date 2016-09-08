/**
 * @ngdoc overview
 * @name a2-palette-drawer
 * @description
 * Directive for drawing a color palette.
 */
angular.module('a2.directive.a2-palette-drawer', [
])
.directive('a2PaletteDrawer', function(a2Soundscapes){
    return {
        restrict : 'E',
        template : '<canvas class="palette"></canvas>',
        replace  : true,
        scope    : {
            palette : '&'
        },
        link     : function($scope, $element, $attrs){
            var draw = function(){
                var pal = $scope.palette() || [];
                var e = (pal.length | 0);
                $element.attr('width', e);
                $element.attr('height', 1);
                var ctx = $element[0].getContext('2d');
                for(var i=0; i < e; ++i){
                    ctx.fillStyle = pal[i];
                    ctx.fillRect(i, 0, 1, 1);
                }
            };
            
            $scope.$watch('palette()', draw);
        }
    };
});