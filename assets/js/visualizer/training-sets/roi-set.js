
angular.module('visualizer-training-sets-roi_set', ['visualizer-services'])
.controller('a2VisualizerTrainingSetLayerRoiSetDataController', function($timeout, a2TrainingSets, training_set_types){
    var self=this;
    self.type='roi_set';
    self.typedef  = training_set_types['roi_set'];
    self.fetchData = function(tset, rec){
        self.tset = tset;
        self.recording = rec;
        a2TrainingSets.getData(tset, rec, function(data){
            $timeout(function(){
                self.rois = data;
            })
        })
    };
    self.editor = {
        roi    : null, 
        points : null,
        valid  : false,
        min_eps: .001,
        reset: function(){
            this.roi    = null;
            this.points = null;
            this.tracer = null;
            this.valid  = false;
        },
        make_new_roi: function(){
            this.roi    = {};
            this.points = [];
            this.valid  = false;
        },
        add_tracer_point : function(point){
            if(this.roi){
                var tracer = [point.sec, point.hz];
                this.tracer = tracer;
                this.validate([tracer]);
            }
        },
        add_point : function(point, min_eps){
            min_eps = min_eps || this.min_eps;
            var similars = this.points && this.points.filter(function(pt){
                var dx=pt[0] - point.sec, dy=(pt[1] - point.hz)/1000.0, dd = dx*dx + dy*dy;
                return  dd <= min_eps;
            });
            if(similars && similars.length > 0){
                return;
            }
            if(!this.roi){
                this.make_new_roi();
            }
            if(this.points.length < 2){
                this.points.push([point.sec, point.hz]);
            }
            this.validate();
        },
        validate : function(tmp_points){
            var secs = this.points.map(function(x){return x[0];});
            var hzs  = this.points.map(function(x){return x[1];});
            if(tmp_points){
                secs.push.apply(secs, tmp_points.map(function(x){return x[0];}));
                hzs .push.apply(hzs , tmp_points.map(function(x){return x[1];}));
            }
            this.roi.x1 = Math.min.apply(null, secs);
            this.roi.y1 = Math.min.apply(null, hzs);
            this.roi.x2 = Math.max.apply(null, secs);
            this.roi.y2 = Math.max.apply(null, hzs);
            this.valid = this.points.length >= 2;
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
            }).bind(this))
        }
    };
})
