

angular.module('a2SpeciesValidator', ['a2utils', 'a2Infotags'])
.directive('a2SpeciesValidator', function (Project) {
    var project = Project;
    return {
        restrict : 'E',
        scope : {
            recording : '=recording'
        },
        replace : true,
        templateUrl : '/partials/visualizer/validator-main.html',
        link     : function($scope, $element, $attrs){
            var class2key = function(project_class){
                var cls = /number|string/.test(typeof project_class) ? 
                    $scope.classes.filter(function(pc){ return pc.id == project_class; }).shift() :
                    project_class;
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
                });
            };
            
            
            
            $scope.$on('a2-persisted', load_project_classes);
            
            $scope.classes = [];
            $scope.is_selected = {};
            $scope.select = function(project_class, $event){
                if($($event.target).is('button, a')){
                    return;
                }
                
                if($event.shiftKey){
                    $scope.is_selected[project_class.id] = true;
                    var sel_range={from:1/0, to:-1/0};
                    $scope.classes.forEach(function(pc, idx){
                        if($scope.is_selected[pc.id]){
                            sel_range.from = Math.min(sel_range.from, idx);
                            sel_range.to   = Math.max(sel_range.to  , idx);
                        }
                    });
                    for(var si = sel_range.from, se = sel_range.to + 1; si < se; ++si){
                        $scope.is_selected[$scope.classes[si].id] = true;
                    }
                } else if($event.ctrlKey){
                    $scope.is_selected[project_class.id] = !$scope.is_selected[project_class.id];
                } else {
                    $scope.is_selected={};
                    $scope.is_selected[project_class.id] = true;
                }
            };
            $scope.validations = {};
            $scope.validate = function(project_class, val){
                var keys=[], key_idx = {};
                var k = class2key(project_class);
                if(k && !key_idx[k]){key_idx[k]=true; keys.push(k);}
                for(var sel_pc_id in $scope.is_selected){
                    if($scope.is_selected[sel_pc_id]){
                        k = class2key(sel_pc_id);
                        if(k && !key_idx[k]){key_idx[k]=true; keys.push(k);}
                    }
                }
                
                if(keys.length > 0){
                    Project.validateRecording($scope.recording.id, {
                        'class' : keys.join(','),
                        val     : val
                    }, function(validations){
                        validations.forEach(function(validation){
                            var key = class2key(validation);
                            $scope.validations[key] = validation.val;
                        });
                    });
                }
                
            };
            $scope.val_options = [{label:"Present", val:1}, {label:"Not Present", val:0}, {label:"Clear", val:2}];
            $scope.val_state = function(project_class, val_options){
                if(!val_options){val_options = $scope.val_options;}
                var key = class2key(project_class), val = $scope.validations[key];
                var returnVal;
                if (val == 2) {
                    returnVal = val_options[2];
                }
                else returnVal = typeof val == 'undefined' ? val : ( val ? val_options[0]: val_options[1] );
                return returnVal;
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
