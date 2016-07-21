angular.module('a2.speciesValidator', ['a2.utils', 'a2.infotags'])
.directive('a2SpeciesValidator', function (Project, a2UserPermit, notify, $filter) {
    var project = Project;
    return {
        restrict : 'E',
        scope : {
            recording : '=recording'
        },
        templateUrl: '/app/visualizer/validator-main.html',
        link: function($scope, $element, $attrs){
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
                var present =  validation.present;
                $scope.validations[key] = present | 0;
            };

            var load_project_classes = function(){
                Project.getClasses(function(classes){
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
                    notify.log('You do not have permission to validate species');
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
                        val: val
                    }, function(validations) {
                        validations.forEach(function(validation) {
                            var key = class2key(validation);
                            
                            if(validation.val == 2) {
                                delete $scope.validations[key];
                            }
                            else {
                                $scope.validations[key] = validation.val;
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
                else{
                    return val_options.filter(function(v) { return v.val == val; })[0];
                }
            };
            
            $scope.$watch('recording', function(recording){
                $scope.validations = {};
                if(recording && recording.validations) {
                    recording.validations.forEach(add_validation);
                }
            });
            
            load_project_classes();
        }
    };
});
