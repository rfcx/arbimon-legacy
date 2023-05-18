angular.module('a2.visualizer.layers.soundscapes.regions', [
    'visualizer-services', 
    'a2.utils', 
    'a2.soundscapeRegionTags'
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.soundscapes.regions.object:soundscape-regions-layer
     * @description Soundscape Regions layer. 
     * adds the soundscape-regions-layer layer_type to layer_types. This layer uses
     * a2.visualizer.layers.soundscapes.regions.controller:a2VisualizerSoundscapeRegionsLayerController as controller,
     * and requires a visobject of type soundscape to be selected.
     * The layer has a visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "soundscape-regions-layer",
        title: "",
        controller: 'a2VisualizerSoundscapeRegionsLayerController as soundscape',
        require: {
            type: 'soundscape',
            browsetype: 'soundscape',
            selection: true
        },
        visible: true,
        // hide_visibility : true
    });
})
.controller('a2VisualizerSoundscapeRegionsLayerController', function($scope, $modal, $location, a2Soundscapes, a22PointBBoxEditor, a2UserPermit, notify){
    var self = this;
    var bbox2string = function(bbox){
        var x1 = bbox.x1 | 0;
        var y1 = bbox.y1 | 0;
        var x2 = bbox.x2 | 0;
        var y2 = bbox.y2 | 0;
        return x1+','+y1+'-'+x2+','+y2;
    };
    
    a2Soundscapes.getAmplitudeReferences().then((function(amplitudeReferences){
        this.amplitudeReferences = amplitudeReferences.reduce(function(_, item){
            _[item.value] = item;
            return _;
        }, {});
    }).bind(this));
    
    this.show={
        names : true,
        tags  : true
    };
    
    this.view_playlist = function(region){
        console.log("this.view_playlist = function(region){", region);
        if(region.playlist){
            $scope.set_location("playlist/" + region.playlist);
        }        
    };
    
    this.query = function(bbox){
        if(!self.selection.valid){
            return;
        }
        a2Soundscapes.getRecordings(self.soundscape, bbox2string(bbox), {count:1, threshold:1}, function(data){
            bbox.q = data;
        });
    };
    this.submit = function(bbox, name){
        if(!self.selection.valid){
            return;
        }
        
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.error('You do not have permission to annotate soundscapes');
            return;
        }
        
        a2Soundscapes.addRegion(self.soundscape, bbox2string(bbox), {
            name : name,
            threshold: 1,
        }, function(data){
            self.regions.push(data);
            self.selection.bbox = data;
        });
    };
    this.sample = function(bbox, percent){
        if(!bbox.id){
            return;
        }
        
        $modal.open({
            templateUrl : '/app/visualizer/layers/soundscapes/regions/sample_soundscape_region_modal.html',
            controller  : 'a2VisualizerSampleSoundscapeRegionModalController',
            size        : 'sm',
            resolve     : {
                data : function(){ return {
                    soundscape : self.soundscape,
                    region : bbox
                }; }
            }
        }).result.then(function (region) {
            if(region && region.id) {
                self.regions.forEach(function(r,idx){
                    if(r.id == region.id){
                        self.regions[idx] = region;
                    }
                });
                self.selection.bbox = region;
            }
        });
    };

    this.selection = angular.extend(new a22PointBBoxEditor(), {
        reset : function(){
            this.super.reset.call(this);
            this.percent = 100;
            return this;
        },
        quantize : function(x, y, ceil){
            var q = ceil ? Math.ceil : Math.floor;
            var xi = $scope.visobject.domain.x.unit_interval;
            var yi = $scope.visobject.domain.y.unit_interval;
            return [q(x / xi) * xi, q(y / yi) * yi];
        },
        add_tracer_point : function(x, y){
            this.super.add_tracer_point.apply(this, this.quantize(x, y));
            return this;
        },
        add_point : function(x, y){
            this.super.add_point.apply(this, this.quantize(x, y));
            return this;
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
        },
        query : function(){
            self.query(this.bbox);
        },
        submit : function(){
            self.submit(this.bbox, this.bbox.name);
        },
        sample : function(){
            self.sample(this.bbox, this.percent);
        },
        view_samples : function(){
            self.view_playlist(this.bbox);
        },
        select : function(region){
            this.bbox = region;
            if($scope.visobject && $scope.visobject.id && region && region.id){
                $scope.set_location('soundscape/' + $scope.visobject.id + '/' + region.id, true);
            }
        }
    });

    $scope.$watch('visobject', function(visobject){
        var sc = visobject && (visobject.type == 'soundscape') && visobject.id;
        if(sc) {
            self.soundscape = sc;
            self.selection.reset();
            a2Soundscapes.getRegions(sc, {
                view:'tags'
            },function(regions){
                self.regions = regions;
                if(visobject.extra && visobject.extra.region){
                    self.selection.bbox = self.regions.filter(function(r){
                        return r.id == visobject.extra.region;
                    }).pop();
                }
            });
        } else {
            self.soundscape = 0;
        }
    });
})
.controller('a2VisualizerSampleSoundscapeRegionModalController', function($scope, $modalInstance, a2Soundscapes, data){
    $scope.soundscape = data.soundscape;
    $scope.region     = data.region;
    $scope.data = {
        percent : 100
    };
    
    $scope.ok = function(){
        $scope.validation = { count:0 };
        
        var sdata=$scope.data, sval = $scope.validation;
        var vdata = {};
        var tst;

        if(sdata.percent > 100){
            sval.percent = "Percent must be between 0% and 100%.";
            sval.count++;
        } 
        else if(((sdata.percent * $scope.region.count)|0) < 1) {
            sval.percent = "You must sample at least 1 recording.";
            sval.count++;
        } 
        else {
            vdata.percent = sdata.percent;
        }

        $scope.form_data=vdata;

        if(sval.count === 0){
            a2Soundscapes.sampleRegion($scope.soundscape, $scope.region.id, vdata, function(region){
                $modalInstance.close(region);
            });
        }
    };
})
;
