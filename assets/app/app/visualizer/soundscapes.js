angular.module('visualizer-soundscapes', [ 
    'visualizer-soundscape-info', 
    'visualizer-soundscape-regions'
]);

angular.module('visualizer-soundscape-regions', [
    'visualizer-services', 
    'a2.utils', 
    'a2.soundscapeRegionTags'
])
.controller('a2VisualizerSoundscapeRegionsLayerController', 
function($scope, $modal, $location, a2Soundscapes, a22PointBBoxEditor, a2UserPermit, notify){
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
        
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.log('You do not have permission to annotate soundscapes');
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
            templateUrl : '/app/visualizer/modal/sample_soundscape_region.html',
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
.controller('a2VisualizerRecordingSoundscapeRegionTagsLayerController', function($scope, a2Soundscapes){
    var self = this;
    self.loading = {};
    
    self.tag = {
        name: null,
        add: function() {
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
        remove: function(tag) {
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
    'visualizer-services', 
    'a2.utils', 
    'a2.soundscapeRegionTags',
    'a2.url-update-service',
    'a2.directives'
])
.controller('a2VisualizerSoundscapeInfoLayerController', 
function($scope, $modal, $location, a2Soundscapes, a2UserPermit, notify) {
    var self = this;
    
    a2Soundscapes.getAmplitudeReferences().then((function(amplitudeReferences){
        this.amplitudeReferences = amplitudeReferences.reduce(function(_, item){
            _[item.value] = item;
            return _;
        }, {});
    }).bind(this));
    
    this.edit_visual_scale = function(soundscape){
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.log('You do not have permission to edit soundscapes');
            return;
        }
        
        $modal.open({
            templateUrl : '/app/visualizer/modal/edit_soundscape_visual_scale.html',
            controller  : 'a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController as controller',
            // size        : 'sm',
            resolve     : {
                amplitudeReferences : function(a2Soundscapes){
                    return a2Soundscapes.getAmplitudeReferences();
                },
                data : function(){ return {
                    soundscape : soundscape
                }; }
            }
        }).result.then(function () {
            /// TODO::: aaa
        });
    };
})
.factory('a2VisualizerSoundscapeGradients', function(){
    var g=[]; for(var i=0;i<256;++i){var j=255-i; g.push('rgb('+j+','+j+','+j+')');}
    return [
        ['#4400e5', '#4000e5', '#3c00e5', '#3700e5', '#3300e5', '#2f00e5', '#2a00e5', '#2600e5', '#2200e5', '#1d00e5', '#1900e5', '#1500e5', '#1100e5', '#0c00e5', '#0800e5', '#0400e5', '#0000e5', '#0004e5', '#0008e5', '#000de5', '#0011e5', '#0015e5', '#001ae5', '#001ee5', '#0022e5', '#0027e5', '#002be5', '#002fe5', '#0034e5', '#0038e5', '#003ce5', '#0041e5', '#0045e5', '#0049e5', '#004ee5', '#0052e5', '#0056e5', '#005ae5', '#005fe5', '#0063e5', '#0067e5', '#006ce5', '#0070e5', '#0074e5', '#0079e5', '#007de5', '#0081e5', '#0086e5', '#008ae5', '#008ee5', '#0093e5', '#0097e5', '#009be5', '#00a0e5', '#00a4e5', '#00a8e5', '#00ade5', '#00b1e5', '#00b5e5', '#00bae5', '#00bee5', '#00c2e5', '#00c6e5', '#00cbe5', '#00e543', '#00e53f', '#00e53b', '#00e536', '#00e532', '#00e52e', '#00e529', '#00e525', '#00e521', '#00e51c', '#00e518', '#00e514', '#00e50f', '#00e50b', '#00e507', '#00e502', '#01e500', '#05e500', '#09e500', '#0ee500', '#12e500', '#16e500', '#1be500', '#1fe500', '#23e500', '#28e500', '#2ce500', '#30e500', '#35e500', '#39e500', '#3de500', '#42e500', '#46e500', '#4ae500', '#4fe500', '#53e500', '#57e500', '#5ce500', '#60e500', '#64e500', '#69e500', '#6de500', '#71e500', '#75e500', '#7ae500', '#7ee500', '#82e500', '#87e500', '#8be500', '#8fe500', '#94e500', '#98e500', '#9ce500', '#a1e500', '#a5e500', '#a9e500', '#aee500', '#b2e500', '#b6e500', '#bbe500', '#bfe500', '#c3e500', '#c8e500', '#cce500', '#e5e401', '#e5e303', '#e5e106', '#e5e008', '#e5df0b', '#e5de0d', '#e5dc10', '#e5db12', '#e5da15', '#e5d917', '#e5d81a', '#e5d71c', '#e5d51f', '#e5d422', '#e5d324', '#e5d227', '#e5d229', '#e5d12c', '#e5d02e', '#e5cf31', '#e5ce33', '#e5cd36', '#e5cd38', '#e5cc3b', '#e5cb3d', '#e5cb40', '#e5ca42', '#e5c945', '#e5c947', '#e5c84a', '#e5c84c', '#e5c74f', '#e5c751', '#e5c754', '#e5c656', '#e5c659', '#e5c65b', '#e5c55e', '#e5c561', '#e5c563', '#e5c566', '#e5c468', '#e5c46b', '#e5c46d', '#e5c470', '#e5c472', '#e5c475', '#e5c477', '#e5c47a', '#e5c47c', '#e5c57f', '#e5c581', '#e5c584', '#e5c586', '#e5c589', '#e5c68b', '#e5c68e', '#e5c690', '#e5c793', '#e5c795', '#e5c898', '#e5c89a', '#e5c99d', '#e5c9a0', '#916225', '#926328', '#93652a', '#95672c', '#96682f', '#986a31', '#996c33', '#9a6d36', '#9c6f38', '#9d713a', '#9f723d', '#a0743f', '#a27641', '#a37744', '#a47946', '#a67a48', '#a77c4b', '#a97e4d', '#aa7f4f', '#ab8152', '#ad8354', '#ae8456', '#b08659', '#b1885b', '#b2895d', '#b48b60', '#b58d62', '#b78e64', '#b89067', '#ba9269', '#bb936b', '#bc956e', '#be9670', '#bf9872', '#c19a75', '#c29b77', '#c39d79', '#c59f7c', '#c6a07e', '#c8a280', '#c9a483', '#caa585', '#cca787', '#cda98a', '#cfaa8c', '#d0ac8e', '#d2ad91', '#d3af93', '#d4b195', '#d6b298', '#d7b49a', '#d9b69c', '#dab79f', '#dbb9a1', '#ddbba3', '#debca6', '#e0bea8', '#e1c0aa', '#e2c1ad', '#e4c3af', '#e5c5b1', '#e7c6b4', '#e8c8b6', '#eacab9'],
        ['#ffffff', '#fefefe', '#fdfdfd', '#fcfcfc', '#fbfbfb', '#fafafa', '#f9f9f9', '#f8f8f8', '#f7f7f7', '#f6f6f6', '#f5f5f5', '#f4f4f4', '#f3f3f3', '#f2f2f2', '#f1f1f1', '#f0f0f0', '#efefef', '#eeeeee', '#ededed', '#ececec', '#ebebeb', '#eaeaea', '#e9e9e9', '#e8e8e8', '#e7e7e7', '#e6e6e6', '#e5e5e5', '#e4e4e4', '#e3e3e3', '#e2e2e2', '#e1e1e1', '#e0e0e0', '#dfdfdf', '#dedede', '#dddddd', '#dcdcdc', '#dbdbdb', '#dadada', '#d9d9d9', '#d8d8d8', '#d7d7d7', '#d6d6d6', '#d5d5d5', '#d4d4d4', '#d3d3d3', '#d2d2d2', '#d1d1d1', '#d0d0d0', '#cfcfcf', '#cecece', '#cdcdcd', '#cccccc', '#cbcbcb', '#cacaca', '#c9c9c9', '#c8c8c8', '#c7c7c7', '#c6c6c6', '#c5c5c5', '#c4c4c4', '#c3c3c3', '#c2c2c2', '#c1c1c1', '#c0c0c0', '#bfbfbf', '#bebebe', '#bdbdbd', '#bcbcbc', '#bbbbbb', '#bababa', '#b9b9b9', '#b8b8b8', '#b7b7b7', '#b6b6b6', '#b5b5b5', '#b4b4b4', '#b3b3b3', '#b2b2b2', '#b1b1b1', '#b0b0b0', '#afafaf', '#aeaeae', '#adadad', '#acacac', '#ababab', '#aaaaaa', '#a9a9a9', '#a8a8a8', '#a7a7a7', '#a6a6a6', '#a5a5a5', '#a4a4a4', '#a3a3a3', '#a2a2a2', '#a1a1a1', '#a0a0a0', '#9f9f9f', '#9e9e9e', '#9d9d9d', '#9c9c9c', '#9b9b9b', '#9a9a9a', '#999999', '#989898', '#979797', '#969696', '#959595', '#949494', '#939393', '#929292', '#919191', '#909090', '#8f8f8f', '#8e8e8e', '#8d8d8d', '#8c8c8c', '#8b8b8b', '#8a8a8a', '#898989', '#888888', '#878787', '#868686', '#858585', '#848484', '#838383', '#828282', '#818181', '#808080', '#7f7f7f', '#7e7e7e', '#7d7d7d', '#7c7c7c', '#7b7b7b', '#7a7a7a', '#797979', '#787878', '#777777', '#767676', '#757575', '#747474', '#737373', '#727272', '#717171', '#707070', '#6f6f6f', '#6e6e6e', '#6d6d6d', '#6c6c6c', '#6b6b6b', '#6a6a6a', '#696969', '#686868', '#676767', '#666666', '#656565', '#646464', '#636363', '#626262', '#616161', '#606060', '#5f5f5f', '#5e5e5e', '#5d5d5d', '#5c5c5c', '#5b5b5b', '#5a5a5a', '#595959', '#585858', '#575757', '#565656', '#555555', '#545454', '#535353', '#525252', '#515151', '#505050', '#4f4f4f', '#4e4e4e', '#4d4d4d', '#4c4c4c', '#4b4b4b', '#4a4a4a', '#494949', '#484848', '#474747', '#464646', '#454545', '#444444', '#434343', '#424242', '#414141', '#404040', '#3f3f3f', '#3e3e3e', '#3d3d3d', '#3c3c3c', '#3b3b3b', '#3a3a3a', '#393939', '#383838', '#373737', '#363636', '#353535', '#343434', '#333333', '#323232', '#313131', '#303030', '#2f2f2f', '#2e2e2e', '#2d2d2d', '#2c2c2c', '#2b2b2b', '#2a2a2a', '#292929', '#282828', '#272727', '#262626', '#252525', '#242424', '#232323', '#222222', '#212121', '#202020', '#1f1f1f', '#1e1e1e', '#1d1d1d', '#1c1c1c', '#1b1b1b', '#1a1a1a', '#191919', '#181818', '#171717', '#161616', '#151515', '#141414', '#131313', '#121212', '#111111', '#101010', '#0f0f0f', '#0e0e0e', '#0d0d0d', '#0c0c0c', '#0b0b0b', '#0a0a0a', '#090909', '#080808', '#070707', '#060606', '#050505', '#040404', '#030303', '#020202', '#010101', '#000000'],
        ['#0a0000', '#0d0000', '#0f0000', '#120000', '#150000', '#170000', '#1a0000', '#1c0000', '#1f0000', '#220000', '#240000', '#270000', '#2a0000', '#2c0000', '#2f0000', '#310000', '#340000', '#370000', '#390000', '#3c0000', '#3f0000', '#410000', '#440000', '#460000', '#490000', '#4c0000', '#4e0000', '#510000', '#540000', '#560000', '#590000', '#5b0000', '#5e0000', '#610000', '#630000', '#660000', '#690000', '#6b0000', '#6e0000', '#700000', '#730000', '#760000', '#780000', '#7b0000', '#7e0000', '#800000', '#830000', '#850000', '#880000', '#8b0000', '#8d0000', '#900000', '#930000', '#950000', '#980000', '#9a0000', '#9d0000', '#a00000', '#a20000', '#a50000', '#a80000', '#aa0000', '#ad0000', '#af0000', '#b20000', '#b50000', '#b70000', '#ba0000', '#bd0000', '#bf0000', '#c20000', '#c40000', '#c70000', '#ca0000', '#cc0000', '#cf0000', '#d20000', '#d40000', '#d70000', '#d90000', '#dc0000', '#df0000', '#e10000', '#e40000', '#e70000', '#e90000', '#ec0000', '#ee0000', '#f10000', '#f40000', '#f60000', '#f90000', '#fc0000', '#fe0000', '#ff0200', '#ff0500', '#ff0700', '#ff0a00', '#ff0c00', '#ff0f00', '#ff1200', '#ff1400', '#ff1700', '#ff1a00', '#ff1c00', '#ff1f00', '#ff2100', '#ff2400', '#ff2700', '#ff2900', '#ff2c00', '#ff2f00', '#ff3100', '#ff3400', '#ff3600', '#ff3900', '#ff3c00', '#ff3e00', '#ff4100', '#ff4400', '#ff4600', '#ff4900', '#ff4b00', '#ff4e00', '#ff5100', '#ff5300', '#ff5600', '#ff5900', '#ff5b00', '#ff5e00', '#ff6000', '#ff6300', '#ff6600', '#ff6800', '#ff6b00', '#ff6e00', '#ff7000', '#ff7300', '#ff7500', '#ff7800', '#ff7b00', '#ff7d00', '#ff8000', '#ff8300', '#ff8500', '#ff8800', '#ff8a00', '#ff8d00', '#ff9000', '#ff9200', '#ff9500', '#ff9700', '#ff9a00', '#ff9d00', '#ff9f00', '#ffa200', '#ffa500', '#ffa700', '#ffaa00', '#ffac00', '#ffaf00', '#ffb200', '#ffb400', '#ffb700', '#ffba00', '#ffbc00', '#ffbf00', '#ffc100', '#ffc400', '#ffc700', '#ffc900', '#ffcc00', '#ffcf00', '#ffd100', '#ffd400', '#ffd600', '#ffd900', '#ffdc00', '#ffde00', '#ffe100', '#ffe400', '#ffe600', '#ffe900', '#ffeb00', '#ffee00', '#fff100', '#fff300', '#fff600', '#fff900', '#fffb00', '#fffe00', '#ffff02', '#ffff06', '#ffff0a', '#ffff0e', '#ffff12', '#ffff16', '#ffff1a', '#ffff1e', '#ffff22', '#ffff26', '#ffff2a', '#ffff2e', '#ffff32', '#ffff36', '#ffff3a', '#ffff3e', '#ffff41', '#ffff45', '#ffff49', '#ffff4d', '#ffff51', '#ffff55', '#ffff59', '#ffff5d', '#ffff61', '#ffff65', '#ffff69', '#ffff6d', '#ffff71', '#ffff75', '#ffff79', '#ffff7d', '#ffff80', '#ffff84', '#ffff88', '#ffff8c', '#ffff90', '#ffff94', '#ffff98', '#ffff9c', '#ffffa0', '#ffffa4', '#ffffa8', '#ffffac', '#ffffb0', '#ffffb4', '#ffffb8', '#ffffbc', '#ffffbf', '#ffffc3', '#ffffc7', '#ffffcb', '#ffffcf', '#ffffd3', '#ffffd7', '#ffffdb', '#ffffdf', '#ffffe3', '#ffffe7', '#ffffeb', '#ffffef', '#fffff3', '#fffff7', '#fffffb', '#ffffff'],
        ['#000000', '#120102', '#240204', '#360306', '#490408', '#5b050a', '#6d060c', '#7f070e', '#920810', '#a40912', '#b60a14', '#c90b16', '#db0c18', '#ed0d1a', '#fe0e1c', '#f90f1e', '#f41020', '#ef1122', '#ea1224', '#e51326', '#e01428', '#db152a', '#d6162c', '#d1172e', '#cc1830', '#c71932', '#c21a34', '#bd1b36', '#b81c38', '#b41d3a', '#af1e3c', '#aa1f3e', '#a52040', '#a02041', '#9b2244', '#962346', '#912448', '#8c2449', '#87264c', '#82274e', '#7d2850', '#782851', '#732a54', '#6e2b56', '#692c58', '#642c59', '#5f2e5c', '#5a2f5e', '#553060', '#503061', '#4b3264', '#463366', '#413468', '#3c3469', '#37366c', '#32376e', '#2d3870', '#283871', '#233a74', '#1e3b76', '#193c78', '#143c79', '#0f3e7c', '#0a3f7e', '#404080', '#414182', '#414183', '#434386', '#444488', '#45458a', '#46468c', '#47478e', '#484890', '#494992', '#494993', '#4b4b96', '#4c4c98', '#4d4d9a', '#4e4e9c', '#4f4f9e', '#5050a0', '#5151a2', '#5151a3', '#5353a6', '#5454a8', '#5555aa', '#5656ac', '#5757ae', '#5858b0', '#5959b2', '#5959b3', '#5b5bb6', '#5c5cb8', '#5d5dba', '#5e5ebc', '#5f5fbe', '#6060c0', '#6161c2', '#6161c3', '#6363c6', '#6464c8', '#6565ca', '#6666cc', '#6767ce', '#6868d0', '#6969d2', '#6969d3', '#6b6bd6', '#6c6cd8', '#6d6dda', '#6e6edc', '#6f6fde', '#7070e0', '#7171e2', '#7171e3', '#7373e6', '#7474e8', '#7575ea', '#7676ec', '#7777ee', '#7878f0', '#7979f2', '#7979f3', '#7b7bf6', '#7c7cf8', '#7d7dfa', '#7e7efc', '#7f7ffe', '#8080fc', '#8181f8', '#8282f4', '#8383f0', '#8383eb', '#8485e7', '#8686e3', '#8787df', '#8888da', '#8989d6', '#8a8ad2', '#8b8bce', '#8c8cc9', '#8d8dc5', '#8e8ec1', '#8f8fbd', '#9090b8', '#9191b4', '#9292b0', '#9393ac', '#9393a7', '#9595a3', '#96969f', '#97979a', '#989896', '#999992', '#9a9a8e', '#9b9b89', '#9c9c85', '#9d9d81', '#9e9e7d', '#9f9f78', '#a0a074', '#a1a170', '#a2a26c', '#a3a367', '#a3a363', '#a5a55f', '#a6a65b', '#a7a756', '#a8a852', '#a9a94e', '#aaaa4a', '#abab45', '#acac41', '#adad3d', '#aeae39', '#afaf34', '#b0b030', '#b1b12c', '#b2b228', '#b3b323', '#b3b31f', '#b5b51b', '#b6b617', '#b7b712', '#b8b80e', '#b9b90a', '#baba06', '#bbbb01', '#bcbc02', '#bdbd05', '#bebe09', '#bfbf0d', '#c0c011', '#c1c115', '#c2c218', '#c3c31c', '#c3c320', '#c4c524', '#c5c627', '#c7c72b', '#c8c82f', '#c9c933', '#caca37', '#cbcb3a', '#cbcc3e', '#cdcd42', '#cece46', '#cfcf49', '#d0d04d', '#d1d151', '#d2d255', '#d3d358', '#d3d35c', '#d5d560', '#d6d664', '#d7d768', '#d8d86b', '#d9d96f', '#dada73', '#dbdb77', '#dcdc7a', '#dddd7e', '#dede82', '#dfdf86', '#e0e08a', '#e1e18d', '#e2e291', '#e3e395', '#e3e399', '#e5e59c', '#e6e6a0', '#e7e7a4', '#e8e8a8', '#e9e9ab', '#eaeaaf', '#ebebb3', '#ececb7', '#ededbb', '#eeeebe', '#efefc2', '#f0f0c6', '#f1f1ca', '#f2f2cd', '#f3f3d1', '#f3f3d5', '#f4f5d9', '#f5f6dd', '#f7f7e0', '#f8f8e4', '#f9f9e8', '#fafaec', '#fbfbef', '#fbfcf3', '#fdfdf7', '#fefefb', '#ffffff'],
        ['#000080', '#000776', '#000e6d', '#001563', '#001d5a', '#002450', '#002b47', '#00333e', '#003a34', '#00412b', '#004821', '#005018', '#00570f', '#005e05', '#005816', '#005126', '#004a37', '#004348', '#003d58', '#003669', '#002f79', '#00288a', '#00219b', '#001bab', '#0014bc', '#000dcd', '#0006dd', '#0000ee', '#000eff', '#001cff', '#002aff', '#0038ff', '#0046ff', '#0054ff', '#0062ff', '#0070ff', '#007fff', '#008dff', '#009bff', '#00a9ff', '#00b7ff', '#00c0ff', '#00c5ff', '#00caff', '#00ceff', '#00d2ff', '#00d7ff', '#00dbff', '#00e0ff', '#00e4ff', '#00e8ff', '#00edff', '#00f1fe', '#00f6f8', '#00faf1', '#00feeb', '#00fee4', '#00fede', '#00fdd7', '#00fdd1', '#00fcca', '#00fcc3', '#00fbbd', '#00fbb6', '#00fab0', '#00faa9', '#00faa3', '#00fa9c', '#00fa92', '#00fa87', '#00fa7d', '#00fa72', '#00fb68', '#00fb5d', '#00fc53', '#00fc49', '#00fc3e', '#00fd34', '#00fd29', '#00fe1f', '#06fe14', '#0cfe0a', '#13fb00', '#19f700', '#1ff300', '#26ef00', '#2cec00', '#32e800', '#39e400', '#3fe000', '#46dd00', '#4cd900', '#52d500', '#59d100', '#5fce00', '#65d100', '#67d400', '#69d700', '#6bdb00', '#6dde00', '#6fe100', '#71e400', '#73e800', '#75eb00', '#77ee00', '#79f100', '#7bf500', '#7df803', '#7ffb07', '#84fe0b', '#88ff0f', '#8dff13', '#91ff17', '#96ff1b', '#9aff1f', '#9fff23', '#a4ff27', '#a8ff2b', '#adff2f', '#b1ff33', '#b6ff37', '#baff3b', '#bfff37', '#c3ff33', '#c8ff2f', '#ccff2b', '#d1ff27', '#d6ff23', '#daff1f', '#dfff1b', '#e3ff17', '#e8ff13', '#ecff0f', '#f1ff0b', '#f5fc07', '#fafa03', '#fff700', '#fff500', '#fff200', '#fff000', '#ffed00', '#ffeb00', '#ffe800', '#ffe600', '#ffe300', '#ffe100', '#ffde00', '#ffdc00', '#ffda00', '#ffd701', '#ffd502', '#ffd203', '#ffd004', '#ffcd05', '#ffcb06', '#ffc807', '#ffc608', '#ffc309', '#ffc10a', '#ffbe0b', '#ffbc0c', '#ffb90d', '#ffb10d', '#ffa90c', '#ffa10b', '#ff990a', '#ff9109', '#ff8808', '#ff8007', '#ff7806', '#ff7005', '#ff6804', '#ff5f03', '#ff5702', '#ff4f01', '#ff4700', '#ff4200', '#ff3d00', '#ff3900', '#ff3400', '#ff2f00', '#ff2a00', '#ff2600', '#ff2100', '#ff1c00', '#ff1700', '#ff1300', '#ff0e00', '#ff0900', '#ff0411', '#ff0023', '#ff0035', '#ff0046', '#ff0058', '#ff006a', '#ff007b', '#ff008d', '#ff009f', '#ff00b1', '#ff00c2', '#ff00d4', '#ff00e6', '#ff00f8', '#f803fb', '#f106ff', '#ea0aff', '#e30dff', '#dc11ff', '#d514ff', '#ce18ff', '#c71bff', '#c11eff', '#ba22ff', '#b325ff', '#ac29ff', '#a52cfe', '#9e32fd', '#a438fc', '#aa3efb', '#b044fa', '#b64af8', '#bc50f7', '#c256f6', '#c75cf5', '#cd61f4', '#d367f2', '#d96df1', '#df73f0', '#e579ef', '#eb7fee', '#ec84ee', '#ec88ef', '#ed8df0', '#ee92f0', '#ef96f1', '#ef9bf1', '#f09ff2', '#f1a4f3', '#f1a9f3', '#f2adf4', '#f3b2f4', '#f4b7f5', '#f4bbf6', '#f5c0f6', '#f6c5f7', '#f6c9f7', '#f7cef8', '#f8d2f9', '#f9d7f9', '#f9dcfa', '#fae0fa', '#fbe5fb', '#fbeafc', '#fceefc', '#fdf3fd', '#fef7fe'],
        // ['#ffffff', '#fefefe', '#fdfdfd', '#fcfcfc', '#fbfbfb', '#fafafa', '#f9f9f9', '#f8f8f8', '#f7f7f7', '#f6f6f6', '#f5f5f5', '#f4f4f4', '#f3f3f3', '#f2f2f2', '#f1f1f1', '#f0f0f0', '#efefef', '#eeeeee', '#ededed', '#ececec', '#ebebeb', '#eaeaea', '#e9e9e9', '#e8e8e8', '#e7e7e7', '#e6e6e6', '#e5e5e5', '#e4e4e4', '#e3e3e3', '#e2e2e2', '#e1e1e1', '#e0e0e0', '#dfdfdf', '#dedede', '#dddddd', '#dcdcdc', '#dbdbdb', '#dadada', '#d9d9d9', '#d8d8d8', '#d7d7d7', '#d6d6d6', '#d5d5d5', '#d3d3d3', '#d3d3d3', '#d2d2d2', '#d1d1d1', '#d0d0d0', '#cfcfcf', '#cecece', '#cdcdcd', '#cccccc', '#cbcbcb', '#cacaca', '#c9c9c9', '#c8c8c8', '#c7c7c7', '#c6c6c6', '#c5c5c5', '#c3c3c3', '#c3c3c3', '#c2c2c2', '#c1c1c1', '#c0c0c0', '#bfbfbf', '#bebebe', '#bdbdbd', '#bcbcbc', '#bbbbbb', '#bababa', '#b9b9b9', '#b8b8b8', '#b7b7b7', '#b6b6b6', '#b5b5b5', '#b3b3b3', '#b3b3b3', '#b2b2b2', '#b1b1b1', '#b0b0b0', '#afafaf', '#aeaeae', '#adadad', '#acacac', '#ababab', '#aaaaaa', '#a9a9a9', '#a8a8a8', '#a7a7a7', '#a6a6a6', '#a5a5a5', '#a3a3a3', '#a3a3a3', '#a2a2a2', '#a1a1a1', '#a0a0a0', '#9f9f9f', '#9e9e9e', '#9d9d9d', '#9c9c9c', '#9b9b9b', '#9a9a9a', '#999999', '#989898', '#979797', '#969696', '#959595', '#939393', '#939393', '#929292', '#919191', '#909090', '#8f8f8f', '#8e8e8e', '#8d8d8d', '#8c8c8c', '#8b8b8b', '#8a8a8a', '#898989', '#888888', '#878787', '#868686', '#858585', '#838383', '#838383', '#828282', '#818181', '#808080', '#7f7f7f', '#7e7e7e', '#7d7d7d', '#7c7c7c', '#7b7b7b', '#797979', '#797979', '#787878', '#777777', '#767676', '#757575', '#747474', '#727272', '#717171', '#717171', '#707070', '#6f6f6f', '#6e6e6e', '#6d6d6d', '#6c6c6c', '#6b6b6b', '#696969', '#696969', '#686868', '#676767', '#666666', '#656565', '#646464', '#626262', '#616161', '#616161', '#606060', '#5f5f5f', '#5e5e5e', '#5d5d5d', '#5c5c5c', '#5b5b5b', '#595959', '#595959', '#585858', '#575757', '#565656', '#555555', '#545454', '#525252', '#515151', '#515151', '#505050', '#4f4f4f', '#4e4e4e', '#4d4d4d', '#4c4c4c', '#4b4b4b', '#494949', '#494949', '#484848', '#474747', '#464646', '#454545', '#444444', '#424242', '#414141', '#414141', '#404040', '#3f3f3f', '#3e3e3e', '#3d3d3d', '#3c3c3c', '#3b3b3b', '#393939', '#383838', '#383838', '#373737', '#363636', '#353535', '#343434', '#323232', '#313131', '#303030', '#303030', '#2f2f2f', '#2e2e2e', '#2d2d2d', '#2c2c2c', '#2b2b2b', '#292929', '#282828', '#282828', '#272727', '#262626', '#252525', '#242424', '#222222', '#212121', '#202020', '#202020', '#1f1f1f', '#1e1e1e', '#1d1d1d', '#1c1c1c', '#1b1b1b', '#191919', '#181818', '#181818', '#171717', '#161616', '#151515', '#141414', '#121212', '#111111', '#101010', '#101010', '#0f0f0f', '#0e0e0e', '#0d0d0d', '#0c0c0c', '#0b0b0b', '#090909', '#080808', '#080808', '#070707', '#060606', '#050505', '#040404', '#020202', '#010101', '#000000', '#000000'],
        // ['#000000', '#010000', '#030000', '#040000', '#060000', '#070000', '#090000', '#0a0000', '#0c0000', '#0d0000', '#0f0000', '#100000', '#120000', '#130000', '#150000', '#160000', '#180000', '#190000', '#1b0000', '#1c0000', '#1e0000', '#1f0000', '#200000', '#220000', '#240000', '#250000', '#270000', '#280000', '#2a0000', '#2b0000', '#2c0000', '#2e0000', '#300000', '#310000', '#330000', '#340000', '#360000', '#370000', '#380000', '#3a0000', '#3c0000', '#3d0000', '#3f0000', '#400000', '#410000', '#430000', '#450000', '#460000', '#480000', '#490000', '#4b0000', '#4c0000', '#4e0000', '#4f0000', '#510000', '#520000', '#540000', '#550000', '#570000', '#580000', '#590000', '#5b0000', '#5d0000', '#5e0000', '#600000', '#610000', '#620000', '#640000', '#660000', '#670000', '#690000', '#6a0000', '#6c0000', '#6d0000', '#6e0000', '#700000', '#710000', '#730000', '#750000', '#760000', '#780000', '#790000', '#7a0000', '#7c0000', '#7e0000', '#7f0000', '#810000', '#820000', '#830000', '#850000', '#860000', '#880000', '#8a0000', '#8b0000', '#8d0000', '#8e0000', '#900000', '#910000', '#930000', '#940000', '#960000', '#970000', '#990000', '#9a0000', '#9c0000', '#9d0000', '#9f0000', '#a00000', '#a20000', '#a30000', '#a50000', '#a60000', '#a80000', '#a90000', '#ab0000', '#ac0000', '#ae0000', '#af0000', '#b10000', '#b20000', '#b30000', '#b50000', '#b60000', '#b80000', '#ba0000', '#bb0000', '#bd0000', '#be0000', '#c00000', '#c10200', '#c30400', '#c40600', '#c50800', '#c70b00', '#c90d00', '#ca0f00', '#cc1000', '#cd1200', '#cf1400', '#d01600', '#d21900', '#d31b00', '#d51d00', '#d61f00', '#d82000', '#d92200', '#db2400', '#dc2600', '#dd2800', '#df2b00', '#e12d00', '#e22f00', '#e33000', '#e53200', '#e63400', '#e83600', '#ea3900', '#eb3b00', '#ed3d00', '#ee3f00', '#f04100', '#f14200', '#f34400', '#f44600', '#f54800', '#f74b00', '#f94d00', '#fa4f00', '#fc5100', '#fd5200', '#ff5400', '#ff5600', '#ff5900', '#ff5b00', '#ff5d00', '#ff5f00', '#ff6100', '#ff6200', '#ff6400', '#ff6600', '#ff6800', '#ff6b00', '#ff6d00', '#ff6f00', '#ff7100', '#ff7200', '#ff7400', '#ff7600', '#ff7900', '#ff7b00', '#ff7d00', '#ff7f00', '#ff8102', '#ff8306', '#ff840a', '#ff860e', '#ff8812', '#ff8b17', '#ff8d1b', '#ff8f1f', '#ff9122', '#ff9326', '#ff942a', '#ff962e', '#ff9933', '#ff9b37', '#ff9d3b', '#ff9f3f', '#ffa142', '#ffa346', '#ffa44a', '#ffa64e', '#ffa852', '#ffab57', '#ffad5b', '#ffaf5f', '#ffb162', '#ffb366', '#ffb46a', '#ffb66e', '#ffb973', '#ffbb77', '#ffbd7b', '#ffbf7f', '#ffc183', '#ffc386', '#ffc48a', '#ffc68e', '#ffc892', '#ffcb97', '#ffcd9b', '#ffcf9f', '#ffd1a3', '#ffd3a6', '#ffd4aa', '#ffd6ae', '#ffd9b3', '#ffdbb7', '#ffddbb', '#ffdfbf', '#ffe1c3', '#ffe3c6', '#ffe4ca', '#ffe6ce', '#ffe8d2', '#ffebd7', '#ffeddb', '#ffefdf', '#fff1e3', '#fff3e6', '#fff4ea', '#fff6ee', '#fff9f3', '#fffbf7', '#fffdfb', '#ffffff'],
        // ['#00007f', '#000084', '#000088', '#00008d', '#000091', '#000096', '#00009a', '#00009f', '#0000a3', '#0000a8', '#0000ac', '#0000b1', '#0000b6', '#0000ba', '#0000bf', '#0000c3', '#0000c8', '#0000cc', '#0000d1', '#0000d5', '#0000da', '#0000de', '#0000e3', '#0000e8', '#0000ec', '#0000f1', '#0000f5', '#0000fa', '#0000fe', '#0000ff', '#0000ff', '#0000ff', '#0000ff', '#0004ff', '#0008ff', '#000cff', '#0010ff', '#0014ff', '#0018ff', '#001cff', '#0020ff', '#0024ff', '#0028ff', '#002cff', '#0030ff', '#0034ff', '#0038ff', '#003cff', '#0040ff', '#0044ff', '#0048ff', '#004cff', '#0050ff', '#0054ff', '#0058ff', '#005cff', '#0060ff', '#0064ff', '#0068ff', '#006cff', '#0070ff', '#0074ff', '#0078ff', '#007cff', '#0080ff', '#0084ff', '#0088ff', '#008cff', '#0090ff', '#0094ff', '#0098ff', '#009cff', '#00a0ff', '#00a4ff', '#00a8ff', '#00acff', '#00b0ff', '#00b4ff', '#00b8ff', '#00bcff', '#00c0ff', '#00c4ff', '#00c8ff', '#00ccff', '#00d0ff', '#00d4ff', '#00d8ff', '#00dcfe', '#00e0fa', '#00e4f7', '#02e8f4', '#05ecf1', '#08f0ed', '#0cf4ea', '#0ff8e7', '#12fce4', '#15ffe1', '#18ffdd', '#1cffda', '#1fffd7', '#22ffd4', '#25ffd0', '#29ffcd', '#2cffca', '#2fffc7', '#32ffc3', '#36ffc0', '#39ffbd', '#3cffba', '#3fffb7', '#42ffb3', '#46ffb0', '#49ffad', '#4cffaa', '#4fffa6', '#53ffa3', '#56ffa0', '#59ff9d', '#5cff9a', '#5fff96', '#63ff93', '#66ff90', '#69ff8d', '#6cff89', '#70ff86', '#73ff83', '#76ff80', '#79ff7d', '#7cff79', '#80ff76', '#83ff73', '#86ff70', '#89ff6c', '#8dff69', '#90ff66', '#93ff63', '#96ff5f', '#9aff5c', '#9dff59', '#a0ff56', '#a3ff53', '#a6ff4f', '#aaff4c', '#adff49', '#b0ff46', '#b3ff42', '#b7ff3f', '#baff3c', '#bdff39', '#c0ff36', '#c3ff32', '#c7ff2f', '#caff2c', '#cdff29', '#d0ff25', '#d4ff22', '#d7ff1f', '#daff1c', '#ddff18', '#e0ff15', '#e4ff12', '#e7ff0f', '#eaff0c', '#edff08', '#f1fc05', '#f4f802', '#f7f400', '#faf000', '#feed00', '#ffe900', '#ffe500', '#ffe200', '#ffde00', '#ffda00', '#ffd700', '#ffd300', '#ffcf00', '#ffcb00', '#ffc800', '#ffc400', '#ffc000', '#ffbd00', '#ffb900', '#ffb500', '#ffb100', '#ffae00', '#ffaa00', '#ffa600', '#ffa300', '#ff9f00', '#ff9b00', '#ff9800', '#ff9400', '#ff9000', '#ff8c00', '#ff8900', '#ff8500', '#ff8100', '#ff7e00', '#ff7a00', '#ff7600', '#ff7300', '#ff6f00', '#ff6b00', '#ff6700', '#ff6400', '#ff6000', '#ff5c00', '#ff5900', '#ff5500', '#ff5100', '#ff4d00', '#ff4a00', '#ff4600', '#ff4200', '#ff3f00', '#ff3b00', '#ff3700', '#ff3400', '#ff3000', '#ff2c00', '#ff2800', '#ff2500', '#ff2100', '#ff1d00', '#ff1a00', '#ff1600', '#fe1200', '#fa0f00', '#f50b00', '#f10700', '#ec0300', '#e80000', '#e30000', '#de0000', '#da0000', '#d50000', '#d10000', '#cc0000', '#c80000', '#c30000', '#bf0000', '#ba0000', '#b60000', '#b10000', '#ac0000', '#a80000', '#a30000', '#9f0000', '#9a0000', '#960000', '#910000', '#8d0000', '#880000', '#840000', '#7f0000'],
        // ['#000000', '#00002b', '#010038', '#010043', '#02004e', '#030058', '#030063', '#04006e', '#050273', '#050474', '#060674', '#070974', '#070b74', '#080d74', '#091075', '#091275', '#0a1475', '#0b1675', '#0b1975', '#0c1b75', '#0d1d76', '#0d2076', '#0e2276', '#0f2476', '#0f2776', '#102977', '#112b77', '#112d77', '#123077', '#133277', '#133477', '#143678', '#153878', '#153a78', '#163c78', '#173e78', '#174079', '#184279', '#194579', '#194779', '#1a4979', '#1b4b79', '#1b4d7a', '#1c4f7a', '#1d517a', '#1d537a', '#1e547a', '#1f567b', '#1f587b', '#205a7b', '#215c7b', '#215e7b', '#22607b', '#23617c', '#23637c', '#24657c', '#25667c', '#25687c', '#26697d', '#276b7d', '#276d7d', '#286e7d', '#29707d', '#29717d', '#2a737e', '#2b747e', '#2b767e', '#2c787e', '#2d797e', '#2d7b7f', '#2e7c7f', '#2f7e7f', '#2f7f7f', '#30807e', '#30817d', '#31817b', '#31827a', '#328279', '#328378', '#338477', '#338475', '#348574', '#348573', '#358672', '#358670', '#36876f', '#36886e', '#37886d', '#37896c', '#38896a', '#388a69', '#388a68', '#398b67', '#398c65', '#3a8c64', '#3a8d63', '#3b8d62', '#3b8e61', '#3c8e5f', '#3c8f5e', '#3d905d', '#3d905c', '#3e915a', '#3e9159', '#3f9258', '#3f9357', '#409355', '#409454', '#409453', '#419552', '#419551', '#42964f', '#42974e', '#43974d', '#43984c', '#44984a', '#449949', '#459948', '#479a47', '#499b46', '#4b9b46', '#4e9c47', '#509c47', '#529d48', '#549d48', '#579e49', '#599f4a', '#5b9f4a', '#5da04b', '#5fa04b', '#62a14c', '#64a14d', '#66a24d', '#68a34e', '#6ba34e', '#6da34f', '#6fa44f', '#71a450', '#73a551', '#76a551', '#78a652', '#79a652', '#7ba752', '#7da752', '#7ea753', '#80a853', '#82a853', '#83a954', '#85a954', '#87aa54', '#88aa55', '#8aab55', '#8cab55', '#8dab56', '#8fac56', '#91ac56', '#92ad57', '#94ad57', '#96ae57', '#97ae58', '#99ae58', '#9aaf58', '#9caf58', '#9eb059', '#9fb059', '#a1b159', '#a3b15a', '#a4b25a', '#a6b25a', '#a8b25b', '#a9b35b', '#abb35b', '#adb45c', '#aeb45c', '#b0b55c', '#b2b55d', '#b3b55d', '#b5b65d', '#b6b65e', '#b7b55e', '#b7b55e', '#b8b45f', '#b8b35f', '#b9b25f', '#b9b15f', '#b9b060', '#baaf60', '#baaf60', '#bbae61', '#bbad61', '#bcac61', '#bcab62', '#bcaa62', '#bda962', '#bda963', '#bea863', '#bea763', '#bea664', '#bfa564', '#bfa464', '#c0a365', '#c0a367', '#c1a369', '#c2a36c', '#c3a46e', '#c5a471', '#c6a573', '#c7a676', '#c8a678', '#c9a77b', '#caa87d', '#cba97f', '#ccaa82', '#ceab84', '#cfac87', '#d0ad89', '#d1ad8c', '#d2ae8e', '#d3af91', '#d4b093', '#d5b196', '#d6b298', '#d8b39a', '#d9b59d', '#dab69f', '#dbb7a2', '#dcb9a4', '#ddbaa7', '#debca9', '#dfbdac', '#e1bfaf', '#e2c1b2', '#e3c3b5', '#e4c5b8', '#e5c7bb', '#e6c9be', '#e7cbc1', '#e8cdc4', '#e9cfc7', '#ebd1ca', '#ecd3cd', '#edd5d0', '#eed7d3', '#efd9d6', '#f0dcd9', '#f1dedc', '#f2e0df', '#f4e3e2', '#f5e6e5', '#f6e9e8', '#f7eceb', '#f8efee', '#f9f2f1', '#faf5f4', '#fbf8f7', '#fdfafa'],
        // ['#000000', '#010101', '#020202', '#030303', '#040404', '#050505', '#060606', '#070707', '#080808', '#090909', '#0a0a0a', '#0b0b0b', '#0c0c0c', '#0d0d0d', '#0e0e0e', '#0f0f0f', '#101010', '#111111', '#121212', '#131313', '#141414', '#151515', '#161616', '#171717', '#181818', '#191919', '#1a1a1a', '#1b1b1b', '#1c1c1c', '#1d1d1d', '#1e1e1e', '#1f1f1f', '#202020', '#202020', '#222222', '#232323', '#242424', '#242424', '#262626', '#272727', '#282828', '#282828', '#2a2a2a', '#2b2b2b', '#2c2c2c', '#2c2c2c', '#2e2e2e', '#2f2f2f', '#303030', '#303030', '#323232', '#333333', '#343434', '#343434', '#363636', '#373737', '#383838', '#383838', '#3a3a3a', '#3b3b3b', '#3c3c3c', '#3c3c3c', '#3e3e3e', '#3f3f3f', '#404040', '#414141', '#414141', '#434343', '#444444', '#454545', '#464646', '#474747', '#484848', '#494949', '#494949', '#4b4b4b', '#4c4c4c', '#4d4d4d', '#4e4e4e', '#4f4f4f', '#505050', '#515151', '#515151', '#535353', '#545454', '#555555', '#565656', '#575757', '#585858', '#595959', '#595959', '#5b5b5b', '#5c5c5c', '#5d5d5d', '#5e5e5e', '#5f5f5f', '#606060', '#616161', '#616161', '#636363', '#646464', '#656565', '#666666', '#676767', '#686868', '#696969', '#696969', '#6b6b6b', '#6c6c6c', '#6d6d6d', '#6e6e6e', '#6f6f6f', '#707070', '#717171', '#717171', '#737373', '#747474', '#757575', '#767676', '#777777', '#787878', '#797979', '#797979', '#7b7b7b', '#7c7c7c', '#7d7d7d', '#7e7e7e', '#7f7f7f', '#808080', '#818181', '#828282', '#838383', '#838383', '#858585', '#868686', '#878787', '#888888', '#898989', '#8a8a8a', '#8b8b8b', '#8c8c8c', '#8d8d8d', '#8e8e8e', '#8f8f8f', '#909090', '#919191', '#929292', '#939393', '#939393', '#959595', '#969696', '#979797', '#989898', '#999999', '#9a9a9a', '#9b9b9b', '#9c9c9c', '#9d9d9d', '#9e9e9e', '#9f9f9f', '#a0a0a0', '#a1a1a1', '#a2a2a2', '#a3a3a3', '#a3a3a3', '#a5a5a5', '#a6a6a6', '#a7a7a7', '#a8a8a8', '#a9a9a9', '#aaaaaa', '#ababab', '#acacac', '#adadad', '#aeaeae', '#afafaf', '#b0b0b0', '#b1b1b1', '#b2b2b2', '#b3b3b3', '#b3b3b3', '#b5b5b5', '#b6b6b6', '#b7b7b7', '#b8b8b8', '#b9b9b9', '#bababa', '#bbbbbb', '#bcbcbc', '#bdbdbd', '#bebebe', '#bfbfbf', '#c0c0c0', '#c1c1c1', '#c2c2c2', '#c3c3c3', '#c3c3c3', '#c5c5c5', '#c6c6c6', '#c7c7c7', '#c8c8c8', '#c9c9c9', '#cacaca', '#cbcbcb', '#cccccc', '#cdcdcd', '#cecece', '#cfcfcf', '#d0d0d0', '#d1d1d1', '#d2d2d2', '#d3d3d3', '#d3d3d3', '#d5d5d5', '#d6d6d6', '#d7d7d7', '#d8d8d8', '#d9d9d9', '#dadada', '#dbdbdb', '#dcdcdc', '#dddddd', '#dedede', '#dfdfdf', '#e0e0e0', '#e1e1e1', '#e2e2e2', '#e3e3e3', '#e3e3e3', '#e5e5e5', '#e6e6e6', '#e7e7e7', '#e8e8e8', '#e9e9e9', '#eaeaea', '#ebebeb', '#ececec', '#ededed', '#eeeeee', '#efefef', '#f0f0f0', '#f1f1f1', '#f2f2f2', '#f3f3f3', '#f3f3f3', '#f5f5f5', '#f6f6f6', '#f7f7f7', '#f8f8f8', '#f9f9f9', '#fafafa', '#fbfbfb', '#fcfcfc', '#fdfdfd', '#fefefe', '#ffffff']
    ];
})
.controller('a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController', 
    function(
        $scope, $modalInstance, 
        a2Soundscapes, 
        amplitudeReferences,
        data, a2UrlUpdate, a2VisualizerSoundscapeGradients
    ){
        var soundscape = data.soundscape;
        $scope.soundscape = soundscape;
        $scope.palettes = a2VisualizerSoundscapeGradients;
        
        $scope.data = {
            palette : soundscape.visual_palette,
            visual_max : soundscape.visual_max_value || soundscape.max_value,
            normalized : !!soundscape.normalized,
            amplitudeThreshold : soundscape.threshold,
            amplitudeReference : amplitudeReferences.reduce(function(_, item){
                return _ || (item.value == soundscape.threshold_type ? item : null);
            }, null)
        };
        
        this.amplitudeReferences = amplitudeReferences;
        
        $scope.ok = function(){
            a2Soundscapes.setVisualizationOptions(soundscape.id, {
                max: $scope.data.visual_max,
                palette: $scope.data.palette,
                normalized: $scope.data.normalized,
                amplitude: $scope.data.amplitudeThreshold,
                amplitudeReference: $scope.data.amplitudeReference.value
            }, function(sc){
                if(soundscape.update){
                    soundscape.update(sc);
                }
                a2UrlUpdate.update(soundscape.thumbnail);
                $scope.$emit('notify-visobj-updated', soundscape);
                $modalInstance.close();
            });
        };
        
        console.log($scope);
})
.directive('a2PaletteDrawer', function(a2Soundscapes){
    return {
        restrict : 'E',
        template : '<canvas class="palette"></canvas>',
        replace  : true,
        scope    : {
            palette : '&'
        },
        link     : function($scope, $element, $attrs){
            var draw = function(){
                var pal = $scope.palette() || [];
                var e = (pal.length | 0);
                $element.attr('width', e);
                $element.attr('height', 1);
                var ctx = $element[0].getContext('2d');
                for(var i=0; i < e; ++i){
                    ctx.fillStyle = pal[i];
                    ctx.fillRect(i, 0, 1, 1);
                }
            };
            
            $scope.$watch('palette()', draw);
        }
    };
})
.directive('a2SoundscapeDrawer', function(a2Soundscapes){
    return {
        restrict : 'E',
        template : '<canvas class="soundscape"></canvas>',
        scope    : {
            soundscape : '&',
            normalized : '&',
            amplitudeThreshold : '&',
            amplitudeThresholdType : '&',
            palette    : '&',
            visualMax  : '&'
        },
        replace  : true,
        link     : function($scope, $element, $attrs){
            var scidx;
            var soundscape;
            var norm_vector;
            var draw = function(){
                if(!soundscape || !scidx){return;}
                var vmax = $scope.visualMax() || soundscape.max_value;
                var ampTh = ($scope.amplitudeThreshold && $scope.amplitudeThreshold()) || 0;
                if($scope.amplitudeThresholdType() == 'relative-to-peak-maximum'){
                    var maxAmp = getMaxAmplitude();
                    ampTh *= maxAmp;
                }
                
                var pal = $scope.palette();
                if(!pal || !pal.length){return;}
                var pallen1 = 1.0 * (pal.length-1);
                var color = function(v){
                    var i = Math.max(0, Math.min(((v * pallen1 / vmax) | 0), pallen1));
                    return pal[i];
                };
                
                if(norm_vector){
                    vmax = 1;
                    var _cl = color;
                    color = function(v, j){
                        var n = norm_vector[j] || 1;
                        return _cl(v / n);
                    };
                }
                
                var w = scidx.width, h = scidx.height;
                $element.attr('width', w);
                $element.attr('height', h);
                
                var ctx = $element[0].getContext('2d');
                ctx.fillStyle = color(0);
                ctx.fillRect(0, 0, w, h);
                
                for(var i in scidx.index){ 
                    var row = scidx.index[i];
                    for(var j in row){
                        var cell = row[j];
                        if(ampTh && cell[1]){
                            var act=0;
                            for(var al=cell[1], ali=0,ale=al.length; ali < ale; ++ali){
                                if(al[ali] > ampTh){ ++act; }
                            }                            
                            ctx.fillStyle = color(act, j);
                        } 
                        else {
                            ctx.fillStyle = color(cell[0], j);                            
                        }
                        ctx.fillRect(j, h - i - 1, 1, 1);
                    }
                }
            };
            
            var getMaxAmplitude = function(){
                if(scidx.__maxAmplitude === undefined){
                    scidx.__maxAmplitude = Object.keys(scidx.index).reduce(function(maxAmp, i){
                        var row = scidx.index[i];
                        return Object.keys(row).reduce(function(maxAmp, j){
                            var cellMax = Math.max.apply(Math, row[j][1] || [0]);
                            return Math.max(cellMax, maxAmp);
                        }, maxAmp);
                    }, 0);
                    console.log("scidx.__maxAmplitude", scidx.__maxAmplitude);
                }
                
                return scidx.__maxAmplitude;
                
            };
            
            $scope.$watch('soundscape()', function(_soundscape){
                soundscape = _soundscape;
                if(soundscape) a2Soundscapes.getSCIdx(soundscape.id, {count:1}).then(function(_scidx){
                    scidx = _scidx;
                    draw();
                });
            });
            $scope.$watch('normalized()', function(_normalized){
                if(!_normalized){ 
                    norm_vector = null; 
                    draw();
                } else {
                    if(norm_vector){
                        draw();
                    } else {
                        a2Soundscapes.getNormVector(soundscape.id).then(function(_norm_vector){
                            norm_vector = _norm_vector;
                            draw();
                        });
                    }
                }
            });
            $scope.$watch('palette()', draw);
            $scope.$watch('amplitudeThreshold()', draw);
            $scope.$watch('amplitudeThresholdType()', draw);
            $scope.$watch('visualMax()', draw);

        }
    };

})
;
