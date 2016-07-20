angular.module('a2.qr-js',[])
.directive('a2QrCode', function($window) {
    var qr = $window.qr;
    var $ = $window.$;
    
    return {
        restrict : 'E',
        scope : {
            data : '@'
        },
        link: function ($scope, $element, $attr) {
            var canvas = $('<canvas></canvas>') .appendTo($element);
            $attr.$observe('data', function(data){
                qr.canvas({
                    canvas : canvas[0],
                    size  : 10,
                    level : 'Q',
                    value : data
                });
            });
        }
    };
});
