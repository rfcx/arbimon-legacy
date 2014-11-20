angular.module('visualizer-soundscapes', ['visualizer-services', 'a2utils'])
.controller('a2VisualizerSoundscapeLayerController', function($scope, a2Soundscapes, a22PointBBoxEditor){
    var self = this;
    this.selection = angular.extend(new a22PointBBoxEditor(), {
        quantize : function(x, y, ceil){
            var q = ceil ? Math.ceil : Math.floor;
            var xi = $scope.visobject.domain.x.unit_interval;
            var yi = $scope.visobject.domain.y.unit_interval;
            return [q(x / xi) * xi, q(y / yi) * yi];
        },
        add_tracer_point : function(x, y){
            this.super.add_tracer_point.apply(this, this.quantize(x, y));
        },
        add_point : function(x, y){
            this.super.add_point.apply(this, this.quantize(x, y));
        },
        validate : function(tmp_points){
            this.super.validate.call(this, tmp_points);
            var q = this.quantize(this.bbox.x2 + 0.1, this.bbox.y2 + 0.1, true);
            this.bbox.y2 = q[1];
            this.selbox = {
                    x1: this.bbox.x1,
                    y1: this.bbox.y1,
                    x2: q[0],
                    y2: q[1]
            };
        }
    });

    $scope.$watch('visobject', function(visobject){
        var sc = visobject && (visobject.type == 'soundscape') && visobject.id;
        if(sc) {
            self.selection.reset();
            a2Soundscapes.getRegions(sc, function(regions){
                self.regions = regions;
            });
        }
    });
});
