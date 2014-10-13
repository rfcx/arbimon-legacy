window.qwe={};
(function(angular){
    var visualizer = angular.module('visualizer', ['ui.router', 'ngAudio', 'a2services', 'a2utils', 'a2recordingsbrowser', 'a2SpeciesValidator']);
    var template_root = '/partials/visualizer/';
    var test_data = {
        recording : {
            file     : "test-2014-08-06_12-20.wav",
            audioUrl : "/data/sample/test-2014-08-06_12-20.wav",
            duration : 60,
            sampling_rate : 44000,
            tags    : [
                'species://coqui', 'awesome'
            ],
            validations : [
                {specie: 'Eleuterodactylus coqui', present : 1},
                {specie: 'Spp 2', present : 0}
            ]
        },
        layers : [
            {   title   : "Recordings",
                visible : true,
                hide_visibility : true,
                type    : "recording-layer",
                file    : "test-2014-08-06_12-20.wav",
                tiles   : [
                    {x:0, y:0, src:'/data/sample/test-2014-08-06_12-20.wav.bmp'}
                ],
            },
            {   title     : "Data Analysis",
                visible   : false,
                type    : "data-analysis-layer",
                sublayers : {
                    collapsed : false,
                    layers    : [
                        {
                            title   : "Regions of Interest",
                            visible : true
                        }, {
                            title   : "New Model",
                            visible : true
                        }, {
                            title   : "New Model Data",
                            visible : true
                        }
                    ]
                }
            },
            {   title   : "Frequency Filter",
                visible : true,
                type    : "frequency-adjust-layer",
                params  : {
                    minfreq : 5000,
                    maxfreq : 15000
                }
            }
        ]
    };

    
    visualizer.value('layer_types',{
        'recording-layer' : {
            title : "",
            visible : true,
            hide_visibility : true,
            type    : "recording-layer"
        },
        'frequency-adjust-layer' : true,
        'species-presence' : {
            title   : "",            
            sidebar_visible : function($scope){return !!$scope.recording;},
            visible : false,
            hide_visibility : true,
            type    : "species-presence",
        }
    });
    visualizer.controller('VisualizerCtrl', function (layer_types, $location, $state, $scope, $timeout, ngAudio, itemSelection, Project) {
        var new_layer = function(layer_type){
            var layer_def = layer_types[layer_type];
            if (layer_def) {
                var layer_maker = function(){};
                layer_maker.prototype = layer_def;
                return new layer_maker();
            } else {
                return null;
            }
        }
        window.qwe.$location = $location;
        $scope.layers = [
            new_layer('recording-layer'),
            new_layer('species-presence')
        ]; // current layers in the visualizer
        $scope.isSidebarVisible = function(l){
            return !l.sidebar_visible || l.sidebar_visible($scope);
        }
        $scope.recording = null;
        $scope.layout = {
            scale : {
                def_sec2px :    5 / 100.0,
                def_hz2px  : 5000 / 100.0,
                sec2px : 100 / 1.0,
                hz2px  : 100 / 5000.0
            }
        };
        $scope.Math = Math;
        $scope.pointer   = {
            x   : 0, y  : 0,
            sec : 0, hz : 0
        };
        $scope.selection = itemSelection.make('layer');
        
        $scope.getLayers = function(){
            return $scope.layers;
        };
        $scope.setRecording = function(recording){
            if (recording) {
                $scope.loading_recording = true;
                Project.getRecordingInfo(recording.id, function(data){
                    console.log('$scope.setRecording', data);
                    $location.path("/visualizer/"+recording.file);
                    $scope.loading_recording = false;
                    $scope.recording = data;
                    $scope.recording.duration = data.stats.duration;
                    $scope.recording.sampling_rate = data.stats.sample_rate;
                    // fix up some stuff
                    $scope.recording.max_freq = data.sampling_rate / 2;
                    // set it to the scope
                    if($scope.recording.audioUrl) {
                        $scope.audio_player.load($scope.recording.audioUrl);
                    }
                    if($scope.recording.imageUrl) {
                        $scope.recording.tiles = [
                            {x:0, y:0, src:$scope.recording.imageUrl}
                        ];
                    }
                });
            } else {
                $scope.recording = null;                
            }
        };
        $scope.audio_player = {
            is_playing : false,
            is_muted   : false,
            has_recording : false,
            has_next_recording : false,
            has_prev_recording : false,
            resource: null,
            setCurrentTime: function(time){
                if(this.resource) {
                    this.resource.currentTime = time;
                }
            },
            load: function(url){
                this.stop();
                this.resource = ngAudio.load(url);
                this.has_recording = true;
            },
            mute: function(muted){
                if(this.resource) {
                    this.resource[muted ? 'mute' : 'unmute']();
                }
                this.is_muted = muted;
            },
            play: function(){
                if(this.resource) {
                    this.resource.play();
                    this.is_playing = true;
                }
            },
            pause: function(){
                if(this.resource) {
                    this.resource.pause();
                }
                this.is_playing = false;
            },
            stop: function(){
                if(this.resource) {
                    this.resource.stop();
                }
                this.is_playing = false;
            },
            prev_recording : function(){
                $scope.$broadcast('prev-recording');
            },
            next_recording : function(){
                $scope.$broadcast('next-recording');
            },
        };
        
        $scope.$on('browser-available', function(){
            if($state.params && $state.params.recording) {
                $scope.$broadcast('select-recording',[$state.params.recording]);
            }
        });
        
        // $scope.setRecording(test_data.recording);
    }).directive('a2Visualizer', function(){
        
        
        return { restrict : 'E', replace:true, templateUrl: template_root + 'main.html' }
    });

    visualizer.directive('a2Scroll', function() {
        return {
            scope: {
                a2Scroll : '&a2Scroll'
            },
            link : function($scope, $element, $attrs) {
                $element.bind("scroll", function(e) {
                    $scope.a2Scroll(e);
                });
            }
        };
    });

    
    visualizer.directive('a2VisualizerLayerItem', function(layer_types, $compile, $templateFetch){
        return {
            restrict : 'E',
            replace  : true,
            templateUrl : template_root + 'visualizer-layer-item-default.html',
            link     : function(scope, element, attrs){
                var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
                var layer_key  = layer_types[layer_type] ? layer_types[layer_type].type : null;
                if(layer_key && layer_key != 'default') {
                    var layer_url  = template_root + 'visualizer-layer-item-' + layer_key + '.html';
                    var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                        var layer_el   = $compile(layer_tmp)(scope);
                        element.append(layer_el.children().unwrap());
                    });
                }
            }
        }
    });

    visualizer.directive('a2VisualizerSpectrogram', function(){
        var layout_tmp = {
            gutter     :  20,
            axis_sizew :  60,
            axis_sizeh :  30,
            axis_lead  :  15
        }
        return {
            restrict : 'E',
            templateUrl : template_root + 'visualizer-spectrogram.html',
            replace  : true,
            link     : function($scope, $element, $attrs){
                var views = {
                    viewport : $element.children('.spectrogram-container')
                };
                $scope.onPlaying = function(e){
                    $scope.layout.y_axis.left = $element.scrollLeft();
                    $element.children('.axis-y').css({left: $scope.layout.y_axis.left + 'px'});
                    $scope.layout.x_axis.top = Math.min(
                        $scope.layout.spectrogram.top + $scope.layout.spectrogram.height,
                        $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh
                    );
                    $element.children('.axis-x').css({top: $scope.layout.x_axis.top + 'px'});
                };
                $scope.onScrolling = function(e){
                    $scope.layout.y_axis.left = $element.scrollLeft();
                    $element.children('.axis-y').css({left: $scope.layout.y_axis.left + 'px'});
                    $scope.layout.x_axis.top = Math.min(
                        $scope.layout.spectrogram.top + $scope.layout.spectrogram.height,
                        $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh
                    );
                    $element.children('.axis-x').css({top: $scope.layout.x_axis.top + 'px'});
                    $element.find('.a2-visualizer-spectrogram-affixed').each(function(i, el){
                        var $el = $(el);
                        var affix_left = $el.data('affix-left') | 0;
                        var affix_top  = $el.data('affix-top' ) | 0;
                        $el.css({position:'absolute', left : affix_left + $element.scrollLeft(), top  : affix_top  + $element.scrollTop()});
                    });
                };
                $scope.onMouseMove = function (e) {
                    var elOff = $element.offset();
                    var x = e.pageX - elOff.left + $element.scrollLeft() - $scope.layout.spectrogram.left;
                    var y = e.pageY - elOff.top  + $element.scrollTop()  - $scope.layout.spectrogram.top ;
                    x = Math.min(Math.max(                                   x, 0), $scope.layout.spectrogram.width);
                    y = Math.min(Math.max($scope.layout.spectrogram.height - y, 0), $scope.layout.spectrogram.height);
                    $scope.pointer.x = x;
                    $scope.pointer.y = y;
                    $scope.pointer.sec = x / $scope.layout.scale.sec2px;
                    $scope.pointer.hz  = y / $scope.layout.scale.hz2px;
                };
                $scope.layout.apply = function(width, height){
                    var recording = $scope.recording || {duration:60, max_freq:44100};
                    var avail_w = width  - layout_tmp.axis_sizew - layout_tmp.axis_lead;
                    var avail_h = height - layout_tmp.axis_sizeh - 5*layout_tmp.axis_lead;
                    var spec_w = Math.max(avail_w, Math.ceil(recording.duration * $scope.layout.scale.sec2px));
                    var spec_h = Math.max(avail_h, Math.ceil(recording.max_freq * $scope.layout.scale.hz2px ));
                    var scalex = d3.scale.linear().domain([0, recording.duration]).range([0, spec_w]);
                    var scaley = d3.scale.linear().domain([0, recording.max_freq]).range([spec_h, 0]);
                    var l={};
                    $scope.layout.scale.sec2px = spec_w / recording.duration;
                    $scope.layout.scale.hz2px  = spec_h / recording.max_freq;
                    l.spectrogram = { selector : '.spectrogram-container', css:{
                        top    : layout_tmp.axis_lead,
                        left   : layout_tmp.axis_sizew,
                        width  : spec_w,
                        height : spec_h,
                    }};
                    l.y_axis = { selector : '.axis-y',  scale : scaley, css:{
                        top    : 0,
                        left   : $element.scrollLeft()
                    }, attr:{
                        width  : layout_tmp.axis_sizew,
                        height : spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                    }};
                    l.x_axis = { selector : '.axis-x',  scale : scalex,  css:{
                        left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
                        top  : Math.min(l.spectrogram.css.top + spec_h, $element.scrollTop() + height  - layout_tmp.axis_sizeh)
                    }, attr:{
                        height : layout_tmp.axis_sizeh,
                        width  : spec_w + 2*layout_tmp.axis_lead
                    }};
                    for(var i in l){
                        var li = l[i];
                        $scope.layout[i] = li.css;
                        var $li = $element.children(li.selector);
                        if(li.css){ $li.css(li.css); }
                        if(li.attr){
                            $li.attr(li.attr);
                            $.extend($scope.layout[i], li.attr);
                        }
                        if(li.scale){
                            $scope.layout[i].scale = li.scale;
                        }
                    }
                    var axis = d3.select($element.children(l.x_axis.selector).empty()[0]);
                    axis.append("rect").attr({
                        class : 'bg',
                        x : 0, y : 0,
                        width : l.x_axis.attr.width,
                        height: spec_h + layout_tmp.axis_lead
                    });
                    axis.append("g").
                        attr('class', 'axis').
                        attr('transform', 'translate('+ layout_tmp.axis_lead +', 1)').
                        call(d3.svg.axis().
                            ticks(recording.duration).
                            tickFormat(function(x){return x + ' s';}).
                            scale(scalex).
                            orient("bottom")
                        );
                    axis = d3.select($element.children(l.y_axis.selector).empty()[0]);
                    axis.append("rect").attr({
                        class : 'bg',
                        x : 0, y : 0,
                        width : l.y_axis.attr.width,
                        height: spec_h + layout_tmp.axis_lead + 2
                    });
                    axis.append("rect").attr({
                        class : 'bg',
                        x : 0, y : 0,
                        width : l.y_axis.attr.width - layout_tmp.axis_lead,
                        height: spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                    });
                    axis.append("g").
                        attr('class', 'axis').
                        attr('transform', 'translate('+ (layout_tmp.axis_sizew-1) +', '+ layout_tmp.axis_lead +')').
                        call(d3.svg.axis().
                            tickFormat(function(x){return (x/1000.0) + ' KHz';}).
                            scale(scaley).
                            orient("left")
                        );
                };
                $scope.getElementDimensions = function () {
                    return { 'h': $element.height(), 'w': $element.width() };
                };
                $scope.getRecordingPlaybackTime = function () {
                    var rsc = $scope.audio_player.resource;
                    return rsc && rsc.currentTime;
                };
                $scope.$watch($scope.getElementDimensions, function (newValue, oldValue) {
                    $scope.layout.apply(newValue.w, newValue.h);
                }, true);
                $scope.$watch($scope.getRecordingPlaybackTime, function (newValue, oldValue) {
                    if($scope.audio_player.is_playing) {
                        var pbh = layout_tmp.axis_sizew + $scope.layout.scale.sec2px * newValue;
                        var sl  = $element.scrollLeft(), slw = sl + $element.width()/2;
                        var dx  =  pbh - slw ;
                        if (dx > 0) {
                            $element.scrollLeft(sl + dx);
                        }
                    }
                }, true);
                $scope.$watch('recording', function (newValue, oldValue) {
                    $element.scrollLeft(0);
                    $element.scrollTop(999999);
                }, true);
                $element.bind('resize', function () {
                    $scope.$apply();
                });
                $scope.layout.apply($element.width(), $element.height());
                $scope.onScrolling();
            }
        }
    });

    visualizer.directive('a2VisualizerSpectrogramLayer', function(layer_types, $compile, $templateFetch){
        return {
            restrict : 'E',
            templateUrl : template_root + 'visualizer-spectrogram-layer-default.html',
            replace  : true,
            link     : function(scope, element, attrs){
                var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
                var layer_key  = layer_types[layer_type] ? layer_types[layer_type].type : null;
                element.addClass(layer_type);
                if(layer_key && layer_key != 'default') {
                    var layer_url  = template_root + 'visualizer-spectrogram-layer-' + layer_key + '.html';
                    var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                        var layer_el   = $compile(layer_tmp)(scope);
                        element.append(layer_el);
                    });
                }
            }
        }
    });
    visualizer.directive('a2VisualizerSpectrogramAffixed', function($compile, $templateFetch){
        return {
            restrict :'E',
            template : '<div class="a2-visualizer-spectrogram-affixed" ng-transclude></div>',
            replace  : true,
            transclude : true,
            link     : function($scope, $element, $attrs){
                var $root = $element.closest('.visualizer-root');
                var $eloff = $element.offset(), $roff = $root.offset();
                if($roff) {
                    $element.attr('data-affix-left', $eloff.left - $roff.left);
                    $element.attr('data-affix-top', $eloff.top - $roff.top);
                }
            }
        }
    });


    angular.module('a2recordingsbrowser', ['a2utils', 'ui.bt.datepicker2'])
    .factory('rbDateAvailabilityCache', function ($cacheFactory) {
        return $cacheFactory('recordingsBrowserDateAvailabilityCache');
    })
    .directive('a2RecordingsBrowser', function ($timeout, itemSelection, Project, rbDateAvailabilityCache) {
        var project = Project;
        return {
            restrict : 'E',
            scope : {
                onRecording : '&onRecording'
            },
            templateUrl : template_root + 'browser-main.html',
            link     : function($scope, $element, $attrs){
                var browser = $scope.browser = {
                    sites : [],
                    dates : {
                        update_time : 0,
                        refreshing  : false,
                        datepickerMode : 'year',
                        cache : rbDateAvailabilityCache,
                        disabled : function(date, mode){
                            var site = browser.selection.site.value;
                            var site_name = site && site.name;
                            if(!site_name) {
                                return true;
                            }
                            
                            var key_comps=[], fetch_mode;
                            switch(mode){
                                case "day"   : key_comps.unshift(date.getDate());     
                                case "month" : key_comps.unshift(1 + date.getMonth());
                                case "year"  : key_comps.unshift(date.getFullYear());     
                            }
                            key_comps.unshift(site_name);
                            var subkey = key_comps.pop();
                            var key = key_comps.join('-');
                            
                            var availability = browser.dates.cache.get(key);
                            if(!availability) {
                                browser.dates.fetch_availability(key);
                            } else if(availability.data){
                                return !availability.data[subkey];
                            }
                            return false;
                        },
                        fetch_availability: function(key){
                            browser.dates.cache.put(key, {fetching:true});
                            browser.loading.dates = true;
                            Project.getRecordingAvailability(key, function(data){
                                $timeout(function(){
                                    var avail = data;
                                    var comps = key.split('-');
                                    while(comps.length > 0) {
                                        var comp = comps.shift();
                                        if (avail) {
                                            avail = avail[comp];
                                        }                                        
                                    }
                                    browser.dates.cache.get(key).data = avail || {};
                                    browser.dates.update_time = new Date();
                                    browser.loading.dates = false;
                                });
                            })
                        },
                        fetching  : false,
                        available : {}
                    },
                    recordings : [],
                    loading : {
                        sites: false,
                        dates: false,
                        times: false
                    },
                    selection : {
                        site : itemSelection.make(),
                        date : null,
                        recording : itemSelection.make()
                    }
                };
                browser.loading.sites = true;
                project.getSites(function(sites){
                    browser.sites = sites;
                    browser.loading.sites = false;
                });
                $scope.$watch('browser.selection.site.value', function(newValue, oldValue){
                    browser.dates.update_time = new Date();
                    browser.selection.date = null;
                    browser.selection.recording.value = null;
                    var auto_select = browser.selection.auto && browser.selection.auto.date;
                    if(auto_select) {
                        browser.selection.auto.date = null;
                        browser.selection.date = auto_select;
                    }
                });
                $scope.$watch('browser.selection.date', function(newValue, oldValue){
                    $element.find('.dropdown.open').removeClass('open');
                    browser.selection.time = null;
                    var site = browser.selection.site.value;
                    var date = browser.selection.date;
                    if (site && date) {
                        var comps = [site.name, date.getFullYear(), date.getMonth() + 1, date.getDate()];
                        var key = comps.join('-');
                        browser.loading.times = true;
                        Project.getRecordings(key, function(recordings){
                            $timeout(function(){
                                browser.recordings = recordings;
                                browser.loading.times = false;
                                var auto_select = browser.selection.auto && browser.selection.auto.recording;
                                if(auto_select) {
                                    browser.selection.auto.recording = null;
                                    var found = browser.recordings.filter(function(r){return r.id == auto_select.id;}).pop();
                                    if (found) {
                                        browser.selection.recording.select(found);
                                    } else {
                                        console.error("Could not find auto-selected recording in list.");
                                    }
                                }
                            });
                        })
                    }
                });
                $scope.$watch('browser.selection.recording.value', function(newValue, oldValue){
                    $scope.onRecording({recording:newValue});
                    $timeout(function(){
                        var $e = $element.find('.recording-list-item.active');
                        if($e.length) {
                            var $p = $e.parent();
                            var $eo = $e.offset(), $po = $p.offset(), $dt=$eo.top-$po.top;
                            $p.animate({scrollTop:$p.scrollTop() + $dt});
                        }
                    });
                });
                $scope.selectRecording = function(recording){
                    if(recording) {
                        var recdate = new Date(recording.datetime);
                        browser.selection.auto = {
                            hash : recording.file,
                            site : browser.sites.filter(function(s){return s.name == recording.site;}).pop(),
                            date : new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0),
                            recording : browser.recordings.filter(function(r){return r.id == recording.id;}).pop() || recording
                        }
                        if(browser.selection.site.value != browser.selection.auto.site) {
                            browser.selection.site.select(browser.selection.auto.site);
                        } else if (browser.selection.date != browser.selection.auto.date) {
                            browser.selection.date = browser.selection.auto.date
                        } else {
                            browser.selection.recording.select(browser.selection.auto.recording);
                        }
                    }
                };
                $scope.$on('prev-recording', function(){
                    if(browser.selection.recording.value) {
                        Project.getPreviousRecording(browser.selection.recording.value.id, $scope.selectRecording);
                    }
                });
                $scope.$on('next-recording', function(){
                    if(browser.selection.recording.value) {
                        Project.getNextRecording(browser.selection.recording.value.id, $scope.selectRecording);
                    }
                });
                $scope.$on('select-recording',function(evt, recording_path){
                    console.log('select recording event : ', recording_path);
                    Project.getOneRecording(recording_path, function(recording){
                        console.log('selecting recording : ', recording);
                        $scope.selectRecording(recording);
                    })
                });
                $timeout(function(){
                    $scope.$emit('browser-available');
                });
                $element.on('click', function(e){
                    var $e=$(e.target), $dm = $e.closest('.dropdown-menu.datepicker, [aria-labelledby^=datepicker]');
                    if($dm.length > 0) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                })
            }
        };
    });

    angular.module('a2SpeciesValidator', ['a2utils', 'a2Infotags'])
    .directive('a2SpeciesValidator', function (Project) {
        var project = Project;
        return {
            restrict : 'E',
            scope : {
                recording : '=recording'
            },
            replace : true, 
            templateUrl : template_root + 'validator-main.html',
            link     : function($scope, $element, $attrs){
                var class2key = function(project_class){
                    var cls = $scope.classes.filter(function(pc){return pc.id = project_class}).shift();
                    return cls && [cls.species, cls.songtype].join('-');
                };
                var add_validation = function(validation){
                    var key     = [validation.species, validation.songtype].join('-');
                    var present =  validation.present;
                    $scope.validations[key] = present | 0;
                };
                
                Project.getClasses(function(classes){
                    $scope.classes = classes;
                });
                
                $scope.classes = [];
                $scope.validations = {};
                $scope.validate = function(project_class, val){
                    var key = class2key(project_class);
                    if (key){
                        Project.validateRecording($scope.recording.id, {
                            'class' : key,
                            val     : val
                        }, function(validation){
                            $scope.validations[key] = validation.val;
                        })
                    }
                };
                $scope.val_options = [{label:"Present", val:1}, {label:"Not Present", val:0}];
                $scope.val_state = function(project_class, val_options){
                    if(!val_options){val_options = $scope.val_options;}
                    var key = class2key(project_class), val = $scope.validations[key];
                    return typeof val == 'undefined' ? val : ( val ? val_options[0]: val_options[1] );
                }
                $scope.$watch('recording', function(recording){
                    console.log('validated recording : ', recording);
                    $scope.validations = {};
                    recording.validations && recording.validations.forEach(add_validation);
                })
            }
        };
    });

    angular.module('a2Infotags', [])
    .factory('InfoTagService', ['$location', '$http', function($location, $http){
        return {
            getSpecies: function(species_id, callback){
                $http.get('/api/species/'+species_id).success(function(data) {
                    callback(data);
                });
            },
            getSongtype: function(songtype_id, callback) {
                $http.get('/api/songtypes/'+songtype_id).success(function(data) {
                    callback(data);
                });
            }
        };
    }])
    .directive('a2Species', function (InfoTagService, $timeout) {
        return {
            restrict : 'E',
            scope : {
                species : '='
            },
            template : '{{data.scientific_name}}',
            link     : function($scope, $element, $attrs){
                $scope.$watch('species', function(newVal, oldVal){
                    $scope.data = null;
                    if(newVal){
                        InfoTagService.getSpecies(newVal, function(data){
                            $timeout(function(){
                                $scope.data = data;
                            })
                        })
                    }
                });
            }
        };
    })
    .directive('a2Songtype', function (InfoTagService, $timeout) {
        return {
            restrict : 'E',
            scope : {
                songtype : '='
            },
            template : '{{data.name}}',
            link     : function($scope, $element, $attrs){
                $scope.$watch('songtype', function(newVal, oldVal){
                    $scope.data = null;
                    if(newVal){
                        InfoTagService.getSongtype(newVal, function(data){
                            $timeout(function(){
                                $scope.data = data;
                            })
                        })
                    }
                });
            }
        };
    });
    ;
//    .directive('a2Species', function(){
//    })
    
    
})(angular);
