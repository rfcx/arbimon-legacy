angular.module('visualizer-soundscapes', ['visualizer-soundscape-info', 'visualizer-soundscape-regions']);

angular.module('visualizer-soundscape-regions', ['visualizer-services', 'a2utils', 'a2SoundscapeRegionTags'])
.controller('a2VisualizerSoundscapeRegionsLayerController', function($scope, $modal, $location, a2Soundscapes, a22PointBBoxEditor){
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
                console.log(visobject.extra);
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
})
;


angular.module('visualizer-soundscape-info', [
    'visualizer-services', 'a2utils', 'a2SoundscapeRegionTags',
    'a2Colors'
])
.controller('a2VisualizerSoundscapeInfoLayerController', function($scope, $modal, $location, a2Soundscapes){
    var self = this;
    this.edit_visual_scale = function(soundscape){        
        $modal.open({
            templateUrl : '/partials/visualizer/modal/edit_soundscape_visual_scale.html',
            controller  : 'a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController',
            // size        : 'sm',
            resolve     : {
                data : function(){ return {
                    soundscape : soundscape
                }; }
            }
        }).result.then(function () {
            /// TODO::: aaa
        });
    };
})
.factory('a2VisualizerSoundscapeGradient', function(){
    return [
    '#4400e5', '#4000e5', '#3c00e5', '#3700e5', '#3300e5', '#2f00e5', '#2a00e5', '#2600e5', '#2200e5', '#1d00e5', '#1900e5', '#1500e5', '#1100e5', 
    '#0c00e5', '#0800e5', '#0400e5', '#0000e5', '#0004e5', '#0008e5', '#000de5', '#0011e5', '#0015e5', '#001ae5', '#001ee5', '#0022e5', '#0027e5', 
    '#002be5', '#002fe5', '#0034e5', '#0038e5', '#003ce5', '#0041e5', '#0045e5', '#0049e5', '#004ee5', '#0052e5', '#0056e5', '#005ae5', '#005fe5', 
    '#0063e5', '#0067e5', '#006ce5', '#0070e5', '#0074e5', '#0079e5', '#007de5', '#0081e5', '#0086e5', '#008ae5', '#008ee5', '#0093e5', '#0097e5', 
    '#009be5', '#00a0e5', '#00a4e5', '#00a8e5', '#00ade5', '#00b1e5', '#00b5e5', '#00bae5', '#00bee5', '#00c2e5', '#00c6e5', '#00cbe5', '#00e543', 
    '#00e53f', '#00e53b', '#00e536', '#00e532', '#00e52e', '#00e529', '#00e525', '#00e521', '#00e51c', '#00e518', '#00e514', '#00e50f', '#00e50b', 
    '#00e507', '#00e502', '#01e500', '#05e500', '#09e500', '#0ee500', '#12e500', '#16e500', '#1be500', '#1fe500', '#23e500', '#28e500', '#2ce500', 
    '#30e500', '#35e500', '#39e500', '#3de500', '#42e500', '#46e500', '#4ae500', '#4fe500', '#53e500', '#57e500', '#5ce500', '#60e500', '#64e500', 
    '#69e500', '#6de500', '#71e500', '#75e500', '#7ae500', '#7ee500', '#82e500', '#87e500', '#8be500', '#8fe500', '#94e500', '#98e500', '#9ce500', 
    '#a1e500', '#a5e500', '#a9e500', '#aee500', '#b2e500', '#b6e500', '#bbe500', '#bfe500', '#c3e500', '#c8e500', '#cce500', '#e5e401', '#e5e303', 
    '#e5e106', '#e5e008', '#e5df0b', '#e5de0d', '#e5dc10', '#e5db12', '#e5da15', '#e5d917', '#e5d81a', '#e5d71c', '#e5d51f', '#e5d422', '#e5d324', 
    '#e5d227', '#e5d229', '#e5d12c', '#e5d02e', '#e5cf31', '#e5ce33', '#e5cd36', '#e5cd38', '#e5cc3b', '#e5cb3d', '#e5cb40', '#e5ca42', '#e5c945', 
    '#e5c947', '#e5c84a', '#e5c84c', '#e5c74f', '#e5c751', '#e5c754', '#e5c656', '#e5c659', '#e5c65b', '#e5c55e', '#e5c561', '#e5c563', '#e5c566', 
    '#e5c468', '#e5c46b', '#e5c46d', '#e5c470', '#e5c472', '#e5c475', '#e5c477', '#e5c47a', '#e5c47c', '#e5c57f', '#e5c581', '#e5c584', '#e5c586', 
    '#e5c589', '#e5c68b', '#e5c68e', '#e5c690', '#e5c793', '#e5c795', '#e5c898', '#e5c89a', '#e5c99d', '#e5c9a0', '#916225', '#926328', '#93652a', 
    '#95672c', '#96682f', '#986a31', '#996c33', '#9a6d36', '#9c6f38', '#9d713a', '#9f723d', '#a0743f', '#a27641', '#a37744', '#a47946', '#a67a48', 
    '#a77c4b', '#a97e4d', '#aa7f4f', '#ab8152', '#ad8354', '#ae8456', '#b08659', '#b1885b', '#b2895d', '#b48b60', '#b58d62', '#b78e64', '#b89067', 
    '#ba9269', '#bb936b', '#bc956e', '#be9670', '#bf9872', '#c19a75', '#c29b77', '#c39d79', '#c59f7c', '#c6a07e', '#c8a280', '#c9a483', '#caa585', 
    '#cca787', '#cda98a', '#cfaa8c', '#d0ac8e', '#d2ad91', '#d3af93', '#d4b195', '#d6b298', '#d7b49a', '#d9b69c', '#dab79f', '#dbb9a1', '#ddbba3', 
    '#debca6', '#e0bea8', '#e1c0aa', '#e2c1ad', '#e4c3af', '#e5c5b1', '#e7c6b4', '#e8c8b6', '#eacab9'
    ];
})
.controller('a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController', function($scope, $modalInstance, a2Soundscapes, a2VisualizerSoundscapeGradient, data){
    var soundscape = data.soundscape;
    $scope.soundscape = soundscape;
    $scope.data = {
        visual_max : soundscape.visual_max_value || soundscape.max_value
    };
    
    $scope.ok = function(){
        // a2Soundscapes.sampleRegion($scope.soundscape, $scope.region.id, vdata, function(region){
        //     $modalInstance.close(region);
        // });
    };
})
.directive('a2SoundscapeDrawer', function(d3, a2Soundscapes, a2VisualizerSoundscapeGradient){
    return {
        restrict : 'E',
        template : '<svg class="soundscape"></svg>',
        scope    : {
            soundscape : '&',
            visualMax  : '&'
        },
        replace  : true,
        link     : function($scope, $element, $attrs){
            $scope.color = function(v, max){
                max = max || soundscape.max_value;
                var i = Math.max(0, Math.min(((v * 255.0 / max) | 0), 255));
                return a2VisualizerSoundscapeGradient[i];
            };
            
            var scidx;
            var soundscape;
            
            $scope.$watch('soundscape()', function(_soundscape){
                soundscape = _soundscape;
                if(soundscape) a2Soundscapes.getSCIdx(soundscape.id, {count:1}).then(function(_scidx){
                    scidx = _scidx;
                    var indices=[];
                    for(var i in scidx.index){ 
                        for(var j in scidx.index[i]){ 
                            indices.push([i,j]);
                        }
                    }
                    var svg = d3.select($element[0]);
                    var vmax = $scope.visualMax();
                    svg.selectAll("rect.bg").data([0]).enter().append('rect')
                        .classed('bg', true)
                        .attr('width', '100%')
                        .attr('height', '100%')
                        .style('fill', $scope.color(0, vmax || soundscape.max_value))
                    ;
                    var rects = svg.selectAll("rect.cell").data(indices);
                        rects.exit().remove();
                        rects.enter().append("rect").classed('cell', true)
                            .attr('x', function(d){ return (100*d[1]/scidx.width )+'%'; })
                            .attr('y', function(d){ return (100*(scidx.height-d[0]-1)/scidx.height)+'%'; })
                            .attr('width' , (100/scidx.width )+'%')
                            .attr('height', (100/scidx.height)+'%')
                            .style('fill', function(d){
                                return $scope.color(scidx.index[d[0]][d[1]], vmax || soundscape.max_value);
                            })
                    ;
                });
            });
            $scope.$watch('visualMax()', function(visualMax){
                if(!soundscape){return;}
                var vmax = visualMax;
                var svg = d3.select($element[0]);
                svg.selectAll("rect.bg").style('fill', $scope.color(0, vmax || soundscape.max_value));
                var rects = svg.selectAll("rect.cell").style('fill', function(d){
                    return $scope.color(scidx.index[d[0]][d[1]], vmax || soundscape.max_value);
                });
            });            

        }
    };
// <rect width="100%" height="100%" ng-attr-style="fill:{{color(0, data.visual_max)}};" />
// <g ng-repeat="(i, row) in counts.index">
//     <rect 
//         ng-repeat = "(j, count) in row"
//         ng-attr-x      = "{{100 * j / counts.width}}%"
//         ng-attr-y      = "{{100 * (counts.height - i - 1) / counts.height}}%"
//         ng-attr-width  = "{{100 * 1 / counts.width }}%"
//         ng-attr-height = "{{100 * 1 / counts.height}}%"                    
//         ng-attr-style="fill:{{color(count, data.visual_max)}};" 
//     />
// </g>
// </svg>

})
;
