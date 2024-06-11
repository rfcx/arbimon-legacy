angular.module('a2.speciesValidator', ['a2.utils', 'a2.infotags', 'a2.directive.click-outside'])
.directive('a2SpeciesValidator', function (Project, Species, Songtypes, a2UserPermit, notify, $filter, $window) {
    return {
        restrict : 'E',
        scope : {
            recording: '=recording',
            layer: '=',
        },
        templateUrl: '/app/visualizer/validator-main.html',
        link: function($scope, $element, $attrs){
            $scope.toggleSpeciesAdd = false;
            $scope.toggleSpeciesSelect = false;
            $scope.toggleSongtypeSelect = false;
            $scope.userSearch = '';
            $scope.allSpecies = [];
            $scope.songtypes = [];
            $scope.classToAdd = { species: null, songtype: null};
            $scope.selected = {}
            $scope.tempSelected = {}
            $scope.timeout;

            $scope.onSpeciesExists = function(search) {
                console.log('species search', search)
                if (!search) {
                    $scope.userSearch = '';
                    return;
                }
                $scope.userSearch = search;
                const classes = $scope.classes ? $scope.classes.filter(function(cl) {
                    const species = cl.species_name.toLowerCase()
                    const searchFormatted = search.toLowerCase()
                    if (species.indexOf(searchFormatted) != -1) {
                        return true;
                    } else return false;
                }) : []
                if (classes.length === 0) {
                    $scope.toggleSpeciesAdd = true;
                    $scope.toggleSpeciesSelect = false;
                }
                else {
                    $scope.toggleSpeciesAdd = false;
                    $scope.toggleSpeciesSelect = false;
                }
            }
            $scope.hide = function() {
                $scope.toggleSpeciesAdd = false;
                $scope.toggleSpeciesSelect = false;
                $scope.toggleSongtypeSelect = false;
            }
            $scope.onSearchClick = function() {
                clearTimeout($scope.timeout);
                $scope.timeout = setTimeout(() => {
                    console.log('onSearchClick', $scope.userSearch, $scope.classToAdd.species)
                    if ($scope.userSearch && $scope.classToAdd.species) {
                        $scope.toggleSpeciesAdd = false;
                        $scope.toggleSpeciesSelect = false;
                        $scope.toggleSongtypeSelect = true;
                        return;
                    }
                    if ($scope.userSearch && !$scope.classToAdd.species) {
                        $scope.toggleSpeciesSelect = false;
                        $scope.toggleSongtypeSelect = false;
                        $scope.toggleSpeciesAdd = true;
                        return;
                    }
                }, 500);
            }
            $scope.addSpecies = function($event) {
                $event.stopPropagation();
                $scope.toggleSpeciesAdd = false;
                $scope.toggleSpeciesSelect = true;
                Species.search($scope.userSearch, function(results) {
                    $scope.allSpecies = results;
                });
            }
            $scope.selectSpecies = function(specie) {
                $scope.classToAdd.species = specie.scientific_name
                $scope.toggleSpeciesSelect = false;
                Songtypes.get(function(songs) {
                    $scope.songtypes = songs;
                });
                $scope.toggleSongtypeSelect = true;
            }
            $scope.selectSongtype = function(song) {
                $scope.classToAdd.songtype = song.name
            }
            $scope.backToSelectSpecies = function() {
                $scope.toggleSpeciesSelect = true;
                $scope.toggleSongtypeSelect = false;
            }
            $scope.addClass = function() {
                $scope.toggleSpeciesSelect = false;
                Project.addClass($scope.classToAdd)
                    .success(function(result) {
                        notify.log($scope.classToAdd.species + ' ' + $scope.classToAdd.songtype + " added to the project");
                        $scope.toggleSongtypeSelect = false;
                        load_project_classes().finally(() => {
                            const newSelectedClass = $scope.classes.find(cl => cl.species_name === $scope.classToAdd.species && cl.songtype_name === $scope.classToAdd.songtype)
                            console.log('newSelectedClass', newSelectedClass, $scope.classToAdd)
                            $scope.selectClass(newSelectedClass)
                        })
                    })
                    .error(function(data, status) {
                        $scope.toggleSongtypeSelect = false;
                        if (status < 500)
                            notify.error(data.error);
                        else
                            notify.error('There was a system error. Please try again.');
                    });
            }
            $scope.selectClass = function(selected) {
                if (!selected) {
                    $scope.selected = {};
                    $scope.tempSelected = {};
                    $scope.is_selected = {};
                    Object.values($scope.byTaxon).forEach(taxon => taxon.open = false)
                    return;
                }
                $scope.selected = selected;
                $scope.tempSelected = selected;
                $scope.toggleSpeciesAdd = false;
                $scope.toggleSpeciesSelect = false;
                $scope.toggleSongtypeSelect = false;
                $scope.scrollToClass(selected.species_name, selected.songtype_name);
            }
            $scope.scrollToClass = function(species, songtype) {
                const taxon = $scope.classes.find(cl => cl.species_name === species && cl.songtype_name === songtype)
                $scope.byTaxon[taxon.taxon].open = true;
                if (taxon) {
                    $scope.is_selected = {};
                    $scope.is_selected[taxon.id] = true;
                }
            }
            $scope.getHeight = function(species) {
                return species ? '56px' : '40px'
            }
            var class2key = function(project_class){
                var cls;
                
                if(/number|string/.test(typeof project_class)) { 
                    cls = $scope.classes.filter(function(pc){ return pc.id == project_class; }).shift();
                }
                else {
                    cls = project_class;
                }
                
                return cls && [cls.species, cls.songtype].join('-');
            };
            
            var add_validation = function(validation){
                var key     = [validation.species, validation.songtype].join('-');
                var present = Object.values({present: validation.present, presentReview: validation.presentReview, presentAed: validation.presentAed});
                $scope.validations[key] = present;
            };

            var load_project_classes = function() {
                return Project.getClasses().then(classes => {
                    $scope.classes = classes;
                    
                    var taxons = {};
                    
                    for(var i = 0; i < classes.length; i++) {
                        var c = classes[i];
                        
                        if(!taxons[c.taxon]) taxons[c.taxon] = [];
                        
                        taxons[c.taxon].push(c);
                    }
                    
                    for(var t in taxons) {
                        taxons[t] = $filter('orderBy')(taxons[t], ['species_name','songtype_name']);
                    }
                    
                    $scope.byTaxon = taxons;
                    $scope.taxons = Object.keys($scope.byTaxon).sort();
                });
            };
            
            $scope.$on('a2-persisted', load_project_classes);
            
            $scope.classes = [];
            $scope.is_selected = {};
            
            $scope.select = function(taxon, project_class, $event) {
                if($($event.target).is('a')){
                    return;
                }
                
                if($event.shiftKey){
                    $scope.is_selected[project_class.id] = true;
                    
                    var sel_range = {
                        from: Infinity, 
                        to: -Infinity,
                    };
                    
                    var taxonSpecies = $scope.byTaxon[taxon];
                    
                    taxonSpecies.forEach(function(pc, idx){
                        if($scope.is_selected[pc.id]){
                            sel_range.from = Math.min(sel_range.from, idx);
                            sel_range.to   = Math.max(sel_range.to  , idx);
                        }
                    });
                    
                    for(var si = sel_range.from, se = sel_range.to + 1; si < se; ++si){
                        $scope.is_selected[taxonSpecies[si].id] = true;
                    }
                } 
                else if($event.ctrlKey){
                    $scope.is_selected[project_class.id] = !$scope.is_selected[project_class.id];
                } 
                else {
                    $scope.is_selected = {};
                    $scope.is_selected[project_class.id] = true;
                }
            };
            
            $scope.validations = {};
            
            $scope.validate = function(val) {
                if(!a2UserPermit.can('validate species')) {
                    notify.error('You do not have permission to validate species');
                    return;
                }
                
                var keys = [],
                    key_idx = {};
                    
                var k;
                // var k = class2key(project_class);
                
                // if (k && !key_idx[k]) {
                //     key_idx[k] = true;
                //     keys.push(k);
                // }
                
                // sel_pc_id -> selected project class id
                for (var sel_pc_id in $scope.is_selected) {
                    if ($scope.is_selected[sel_pc_id]) {
                        k = class2key(sel_pc_id);
                        if (k && !key_idx[k]) {
                            key_idx[k] = true;
                            keys.push(k);
                        }
                    }
                }

                if (keys.length > 0) {
                    Project.validateRecording($scope.recording.id, {
                        'class': keys.join(','),
                        val: val,
                        determinedFrom: 'visualizer'
                    }, function(validations) {
                        validations.forEach(function(validation) {
                            var key = class2key(validation);
                            
                            if(validation.val == 2) {
                                delete $scope.validations[key];
                            }
                            else {
                                $scope.validations[key] = Object.values({present: validation.val, presentReview: 0});
                            }
                        });
                    });
                }
            };
            
            $scope.val_options = [
                { label: "Clear",   val: 2 },
                { label: "Present", val: 1 }, 
                { label: "Absent",  val: 0 }, 
            ];
            
            $scope.val_state = function(project_class, val_options){
                if(!val_options) { 
                    val_options = $scope.val_options;
                }
                
                var key = class2key(project_class), 
                    val = $scope.validations[key];
                if(typeof val === 'undefined') {
                    return;
                }
                else {
                    if (val[0] == 1 || val[1] > 0 || val[2] > 0) {
                        val_options[1].showDropdown = (val[1] > 0 || val[2] > 0)
                        return val_options[1];
                    } if (val[0] == null && val[1] == 0 && val[2] == 0) {
                        return;
                    } else {
                        return val_options[2];
                    }
                }
            };
            
            $scope.$watch('recording', function(recording){
                $scope.validations = {};
                if(recording && recording.validations) {
                    recording.validations.forEach(add_validation);
                }
            });

            $scope.$watch('layer', function(newVal, oldVal) {
                if (newVal && newVal.is_open === false) {
                    $scope.toggleSpeciesAdd = false;
                    $scope.toggleSpeciesSelect = false;
                    $scope.toggleSongtypeSelect = false;
                }
            }, true);
            
            load_project_classes();
        }
    };
});
