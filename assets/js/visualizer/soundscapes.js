angular.module('visualizer-soundscapes', ['visualizer-services', 'a2utils', 'a2SoundscapeRegionTags'])
.controller('a2VisualizerSoundscapeLayerController', function($scope, $modal, $location, a2Soundscapes, a22PointBBoxEditor){
    var self = this;
    var bbox2string = function(bbox){
        var x1 = bbox.x1 | 0;
        var y1 = bbox.y1 | 0;
        var x2 = bbox.x2 | 0;
        var y2 = bbox.y2 | 0;
        return x1+','+y1+'-'+x2+','+y2;
    };
    
    this.show={
        names : true,
        labels : true
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
        a2Soundscapes.getRecordings(self.soundscape, bbox2string(bbox), {count:1}, function(data){
            bbox.q = data;
        });
    };
    this.submit = function(bbox, name){
        if(!self.selection.valid){
            return;
        }
        a2Soundscapes.addRegion(self.soundscape, bbox2string(bbox), {
            name : name
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
            templateUrl : '/partials/visualizer/modal/sample_soundscape_region.html',
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
        $scope.validation={count:0};
        
        var sdata=$scope.data, sval = $scope.validation;
        var vdata = {};
        var tst;

        if(sdata.percent > 100){
            sval.percent = "Percent must be between 0% and 100%.";
            sval.count++;
        } else if(((sdata.percent * $scope.region.count)|0) < 1) {
            sval.percent = "You must sample at least 1 recording.";
            sval.count++;
        } else {
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


.controller('a2VisualizerRecordingSoundscapeRegionTagsLayerController', function($scope, a2Soundscapes){
    var self = this;
    self.loading = {};
    
    self.tag = {
        name : null,
        add  : function(){
            var tag = this.name;
            
            this.name = null;
            
            a2Soundscapes.addRecordingTag(self.soundscape.id, self.region.id, self.recording.id, tag, function(tag){
                var tagid = tag.id | 0;
                if(!self.tags.filter(function(t){
                    return t.id == tagid;
                }).length){
                    self.tags.push(tag);
                }
            });
        },
        remove : function(tag){
            var tagid = tag.id | 0;
            a2Soundscapes.removeRecordingTag(self.soundscape.id, self.region.id, self.recording.id, tagid, function(){
                self.tags = self.tags.filter(function(t){
                    return t.id != tagid;
                });
            });
        }
    };
    
    $scope.$watch('visobject', function(visobject){
        self.recording  = null;
        self.playlist   = null;
        self.soundscape = null;
        self.region     = null;
        self.tags       = null;

        if(visobject && (visobject.type == 'recording') && visobject.id &&
            visobject.extra && visobject.extra.playlist &&
            visobject.extra.playlist.soundscape &&
            visobject.extra.playlist.region
        ){
            self.recording = visobject;
            self.playlist  = visobject.extra.playlist;
            self.loading.soundscape = true;
            self.loading.region = true;
            self.loading.tags = true;
            a2Soundscapes.get(self.playlist.soundscape, function(soundscape){
                self.loading.soundscape = false;
                self.soundscape = soundscape;
                a2Soundscapes.getRegion(soundscape.id, self.playlist.region, function(region){
                    self.loading.region = false;
                    self.region = region;
                    a2Soundscapes.getRecordingTags(soundscape.id, region.id, self.recording.id, function(tags){
                        self.loading.tags = false;
                        self.tags = tags;
                    });
                });
            });
        }
    });
    
    console.log($scope);
})
;
