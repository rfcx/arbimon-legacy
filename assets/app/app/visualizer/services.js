angular.module('visualizer-services', ['a2.services'])
    .provider('layer_types', function(){

        var type_array = [];
        
        return {
            addLayerType: function(layerType){
                type_array.push(layerType);
                return this;
            },
            $get : function(){
                var layer_types = {};
                type_array.forEach(function(lt) {
                    layer_types[lt.type] = lt;
                });
                return layer_types;
            }
        };

    })
    .service('a2VisualizerLayers', function(layer_types, $controller) {
        var layers = function($scope, VisualizerCtrl) {
            this.$scope = $scope;
            this.VisualizerCtrl = VisualizerCtrl;
            this.list = [];
        };
        
        layers.prototype = {
            types: layer_types,
            __new_layer__: function(layer_type) {
                var layer_def = this.types[layer_type];
                if (layer_def) {
                    var layer_maker = function() {};
                    layer_maker.prototype = layer_def;
                    var layer = new layer_maker();
                    if (layer.controller && typeof layer.controller == 'string') {
                        var cname = /^(.*?)( as (.*?))$/.exec(layer.controller);
                        if (cname) {
                            layer[cname[2] ? cname[3] : 'controller'] = $controller(cname[1], {
                                $scope: this.$scope,
                                VisualizerCtrl: this.VisualizerCtrl
                            });
                        }
                    }
                    return layer;
                }
                else {
                    return null;
                }
            },
            add: function() {
                for (var a = arguments, i = 0, e = a.length; i < e; ++i) {
                    var layer_type = a[i];
                    if (layer_types[layer_type]) {
                        this.list.push(this.__new_layer__(layer_type));
                    } else {
                        console.warn("Unknown layer of type " + layer_type + ".");
                    }
                }
            },
            __check_type: function(reqtype, curtype) {
                if (reqtype instanceof Array) {
                    var idx = reqtype.indexOf(curtype);
                    if (idx == -1) {
                        return false;
                    }
                }
                else if (curtype != reqtype) {
                    return false;
                }
                return true;
            },
            check_requirements: function(req) {
                var browsetype = this.$scope.visobject_type;
                var votype = this.$scope.visobject ? this.$scope.visobject.type : browsetype;
                if (!req) {
                    return true;
                }
                else if (req.selection && !this.$scope.visobject) {
                    return false;
                }
                else if (req.type && !this.__check_type(req.type, votype)) {
                    return false;
                }
                else if (req.browsetype && !this.__check_type(req.browsetype, browsetype)) {
                    return false;
                }
                else if (req.that && !req.that(this.$scope)) {
                    return false;
                }
                return true;
            },
            sidebar_visible: function(l) {
                if (l.sidebar_visible && !l.sidebar_visible($scope)) {
                    return false;
                }
                else if (!this.check_requirements(l.require)) {
                    return false;
                }

                return true;
            },
            spectrogram_visible: function(l) {
                return this.check_requirements(l.require) && l.visible;
            },
            display_sidebar: function(l) {
                return !l.display || l.display.sidebar !== false;
            },
            display_spectrogram: function(l) {
                return !l.display || (l && l.display && l.display.spectrogram !== false)
            }
        };

        return layers;
    })
    .provider('training_set_types', function() {
        var training_set_types = [];

        return {
            add: function(type){
                training_set_types.push(type);
                return this;
            },
            $get : function(){
                return training_set_types.reduce(function(_, tst) {
                    _[tst.type] = tst;
                    return _;
                }, {});
            }
        };

    })
    .controller('a2ProjectClasses', function(Project) {
        var self = this;
        Project.getClasses().then(list => {
            self.list = list;
        });
    })
    .service('a22PointBBoxEditor', function($timeout, a2TrainingSets, training_set_types) {
        var editor = function() {
            this.min_eps = 0.001;
            this.scalex = 1.0;
            this.scaley = 0.001;
            this.reset();
        };
        editor.prototype = {
            reset: function() {
                this.bbox = null;
                this.points = null;
                this.tracer = null;
                this.valid = false;
                return this;
            },
            make_new_bbox: function() {
                this.bbox = {};
                this.points = [];
                this.valid = false;
            },
            add_tracer_point: function(x, y) {
                if (this.bbox && !this.valid) {
                    var tracer = [x, y];
                    this.tracer = tracer;
                    this.validate([tracer]);
                }
            },
            add_point: function(x, y, min_eps) {
                min_eps = min_eps || this.min_eps;
                var similars = this.points && this.points.filter(function(pt) {
                    var dx = (pt[0] - x) * this.scalex,
                        dy = (pt[1] - y) * this.scaley,
                        dd = dx * dx + dy * dy;
                    return dd <= min_eps;
                });
                if (similars && similars.length > 0) {
                    return;
                }
                if (!this.bbox) {
                    this.make_new_bbox();
                }
                if (this.points.length < 2) {
                    this.points.push([x, y]);
                }
                this.validate();
            },
            validate: function(tmp_points) {
                var pts_x = this.points.map(function(x) {
                    return x[0];
                });
                var pts_y = this.points.map(function(x) {
                    return x[1];
                });
                if (tmp_points) {
                    pts_x.push.apply(pts_x, tmp_points.map(function(x) {
                        return x[0];
                    }));
                    pts_y.push.apply(pts_y, tmp_points.map(function(x) {
                        return x[1];
                    }));
                }
                this.bbox.x1 = Math.min.apply(null, pts_x);
                this.bbox.y1 = Math.min.apply(null, pts_y);
                this.bbox.x2 = Math.max.apply(null, pts_x);
                this.bbox.y2 = Math.max.apply(null, pts_y);
                this.valid = this.points.length >= 2;
            }
        };
        editor.prototype.super = editor.prototype;

        return editor;
    });
