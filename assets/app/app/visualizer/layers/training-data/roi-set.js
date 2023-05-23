angular.module('a2.visualizer.layers.training-sets.roi_set', [
    'visualizer-services',
    'a2.permissions',
    'humane'
])
.config(function(training_set_typesProvider){
    training_set_typesProvider.add({
        type: 'roi_set',
        has_layout: true,
        templates: {
            layer_item: '/app/visualizer/layer-item/training-sets/roi_set.html',
            new_modal: '/app/visualizer/modal/new_roi_set_tset_partial.html'
        },
        action: {
            collect_new_tset_data: function(sdata, tset_data, sval) {
                if (sdata.class) {
                    tset_data.class = sdata.class.id;
                }
                else {
                    sval.class = "Please select a project class.";
                    sval.count++;
                }
            }
        },
        controller: 'a2VisualizerSpectrogramTrainingSetRoiSetData'
    });
})
.controller('a2VisualizerTrainingSetLayerRoiSetDataController', function($scope, $timeout, a2TrainingSets, training_set_types, a22PointBBoxEditor, a2UserPermit, notify) {
    var self=this;
    self.type='roi_set';
    self.typedef  = training_set_types.roi_set;
    $scope.getXCoord = function(x1, x2){
        return $scope.getXSide(x1, x2) == 'left' ? x1 : x2;
    };
    $scope.getXSide = function(x1, x2){
        var px = Math.max(0, Math.min($scope.layout.sec2x(x2, 1) / $scope.layout.spectrogram.width, 1));
        return px > .5 ? 'left' : 'right';
    };
    $scope.getTransform = function(x1, x2, y1, y2){
        var tx = $scope.getXSide(x1, x2) == 'left' ? '-100%' : '0';
        var ty = $scope.getYTranslation((y1 + y2)/2, true);
        return 'translate(' + tx + ', ' + ty + ')';
    };
    $scope.getYTranslation = function(y, asrelativeoffset){
        var py = Math.max(0.1, Math.min($scope.layout.hz2y(y, 1) / $scope.layout.spectrogram.height, .9));
        if (asrelativeoffset){
            py = -py;
        }
        return ((100 * py) | 0) + '%';
    };
    self.fetchData = function(tsetId, rec){
        self.tsetId = tsetId;
        self.recording = rec;
        a2TrainingSets.getData(tsetId, rec, function(data){
            $timeout(function(){
                self.rois = data;
            });
        });
    };
    self.editor = angular.extend(
        new a22PointBBoxEditor(), {
        reset: function(){
            this.super.reset.call(this);
            this.roi    = null;
        },
        make_new_bbox: function(){
            this.super.make_new_bbox.call(this);
            this.roi     = this.bbox;
        },
        make_new_roi: function(){
            this.make_new_bbox();
        },
        add_tracer_point : function(point){
            this.super.add_tracer_point.call(this, point.sec, point.hz);
        },
        add_point : function(point, min_eps){
            this.super.add_point.call(this, point.sec, point.hz, min_eps);
        },
        submit: function(){ 
            if(!a2UserPermit.can('manage training sets')) {
                notify.error('You do not have permission to add ROIs to training set');
                return;
            }
            
            a2TrainingSets.addData(self.tsetId, {
                recording : self.recording,
                roi : this.roi
            }, (function(new_tset_data){
                $timeout((function(){
                    this.reset();
                    self.rois.push(new_tset_data);
                }).bind(this));
            }).bind(this));
        }
    });
});
