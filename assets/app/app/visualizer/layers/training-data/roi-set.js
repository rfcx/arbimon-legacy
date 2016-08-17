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
.controller('a2VisualizerTrainingSetLayerRoiSetDataController', function($timeout, a2TrainingSets, training_set_types, a22PointBBoxEditor, a2UserPermit, notify) {
    var self=this;
    self.type='roi_set';
    self.typedef  = training_set_types.roi_set;
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
                notify.log('You do not have permission to add ROIs to training set');
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
