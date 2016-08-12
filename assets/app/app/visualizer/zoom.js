
angular.module('a2-visualizer-spectrogram-click2zoom', ['a2.classy'])
.service('a2SpectrogramClick2Zoom', function(makeClass, a22PointBBoxEditor){
    return makeClass({
        super : a22PointBBoxEditor.prototype,
        toggle_active : function(){
            this.active = !this.active;
            if(this.active){
                this.reset();
            }
        },
        constructor : function(layout){
            this.super.constructor.call(this);
            this.layout = layout;
            this.active = false;
        },
        add_point: function(x, y, zoom){
            this.super.add_point.call(this, x, y);
            if(zoom){
                this.zoom();
            }
        },
        zoom_out: function(){
            var layout = this.layout;
            this.active=false;
            layout.scale.zoom.x = Math.max(0, layout.scale.zoom.x - 0.1);
            layout.scale.zoom.y = Math.max(0, layout.scale.zoom.y - 0.1);
        },
        zoom_reset: function(){
            var layout = this.layout;
            this.active=false;
            layout.scale.zoom.x = 0;
            layout.scale.zoom.y = 0;
        },
        zoom: function(){
            var layout = this.layout;
            var bbox = this.bbox;
            var dx = (bbox.x2 - bbox.x1), dy = (bbox.y2 - bbox.y1);
            var cp = [(bbox.x2 + bbox.x1)/2, (bbox.y2 + bbox.y1)/2];
            var avail_h = layout.viewport.height;
            var avail_w = layout.viewport.width;
            var lzoom = layout.scale.zoom;
            var zoom_x = avail_w / dx, zoom_y = avail_h / dy;
            var zoom_level_x = Math.max(0, Math.min((zoom_x - lzoom.levelx[0]) / (lzoom.levelx[1] - lzoom.levelx[0]), 1));
            var zoom_level_y = Math.max(0, Math.min((zoom_y - lzoom.levely[0]) / (lzoom.levely[1] - lzoom.levely[0]), 1));

            this.active = false;
            
            layout.center = {s : cp[0], hz : cp[1]};
            layout.scale.zoom.x = zoom_level_x;
            layout.scale.zoom.y = zoom_level_y;
            
            console.log("zoom :: ", [dx, dy], cp, [zoom_level_x, zoom_level_y]);
        }
    });
})
.directive('a2ZoomControl', function(){
    return {
        restrict :'E',
        scope : {
            'level' : '='
        },
        templateUrl : '/directives/zoom-ctrl.html',
        replace  : true,
        link : function($scope, $element, $attrs) {
            var delta = (+$attrs.delta) || 0.1;
            var horizontal = !!(($attrs.horizontal|0) || (/on|yes|true/.test($attrs.horizontal+'')));
            $scope.horizontal = horizontal;
            $scope.switched   = horizontal;
            $scope.step = function(step){
                $scope.level = Math.min(1, Math.max($scope.level + step*delta, 0));
            };
            $scope.set_by_mouse = function($event){
                var track = $element.find('.zoom-track'), trackpos=track.offset();
                var px = (track.width()  - ($event.pageX - trackpos.left )) / track.width() ;
                var py = (track.height() - ($event.pageY - trackpos.top  )) / track.height();
                // console.log('$scope.set_by_mouse', [px,py]);
                var level = $scope.horizontal ? px : py;
                $scope.level = $scope.switched ? (1-level) : level;
            };
        }
    };
})
;
