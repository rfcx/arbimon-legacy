
angular.module('visualizer-training-sets-roi_set', ['visualizer-services'])
.controller('a2VisualizerTrainingSetLayerRoiSetDataController', function($timeout, a2TrainingSets, training_set_types, a22PointBBoxEditor){
    var self=this;
    self.type='roi_set';
    self.typedef  = training_set_types.roi_set;
    self.fetchData = function(tset, rec){
        self.tset = tset;
        self.recording = rec;
        a2TrainingSets.getData(tset, rec, function(data){
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
            a2TrainingSets.addData(self.tset, {
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
