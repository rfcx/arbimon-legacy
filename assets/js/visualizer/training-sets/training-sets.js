

angular.module('visualizer-training-sets', ['visualizer-services', 'a2utils'])
.controller('a2VisualizerTrainingSetLayerController', function($scope, $modal, $controller, $timeout, a2TrainingSets){
    var self=this;
    self.tset      = null;
    self.tset_type = null;
    self.tset_list = [];
    self.data      = null;

    a2TrainingSets.getList(function(training_sets){
        self.tset_list = training_sets;
        if(!self.tset && training_sets && training_sets.length > 0) {
            self.tset = training_sets[0];
        }
    });


    self.add_new_tset = function(){
        $modal.open({
            templateUrl : '/partials/visualizer/modal/add_tset.html',
            controller  : 'a2VisualizerAddTrainingSetModalController'
        }).result.then(function (new_tset) {
            if(new_tset && new_tset.id) {
                self.tset_list.push(new_tset);
                if(!self.tset) {
                    self.tset = new_tset;
                }
            }
        });
    }

    var fetchTsetData = function(){
        var tset = self.tset && self.tset.name;
        var tset_type = self.tset && self.tset.type;
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if(tset && rec) {
            if(!self.data || self.data.type != tset_type){
                var cont_name = tset_type.replace(/(^|-|_)(\w)/g, function(_,_1,_2,_3){ return _2.toUpperCase()});
                cont_name = 'a2VisualizerTrainingSetLayer'+cont_name+'DataController';
                self.data = $controller(cont_name,{$scope : $scope});
            }
            self.data.fetchData(tset, rec);
        }
    };

    $scope.$watch(function(){return self.tset;}, fetchTsetData);
    $scope.$watch('visobject', fetchTsetData);
})
.directive('a2VisualizerSpectrogramTrainingSetData', function(training_set_types, $compile, $controller, $templateFetch){
    return {
        restrict : 'A',
        template : '<div class="training-set-data"></div>',
        replace  : true,
        link     : function(scope, element, attrs){
            scope.$watch(attrs.a2VisualizerSpectrogramTrainingSetData, function(tset_type){
                var type_def = training_set_types[tset_type];
                element.attr('data-tset-type', tset_type);
                if(type_def) {
                    if(type_def.has_layout){
                        var tmp_url  = '/partials/visualizer/spectrogram-layer/training-sets/' + tset_type + '.html';
                        $templateFetch(tmp_url, function(tmp){
                            element.empty().append($compile(tmp)(scope));
                        });
                    }
                }
            });
        }
    }
})
.controller('a2VisualizerAddTrainingSetModalController', function($scope, $modalInstance, Project, training_set_types, a2TrainingSets){
    $scope.data = {
        name : '',
        type : null
    }
    $scope.typedefs = training_set_types;
    Project.getClasses(function(project_classes){
        $scope.project_classes = project_classes;
    });
    a2TrainingSets.getTypes(function(tset_types){
        $scope.tset_types = tset_types;
        if(tset_types && tset_types.length == 1) {
            $scope.data.type = tset_types[0];
        }
    });
    $scope.ok = function(){
        $scope.validation={count:0};
        
        var sdata=$scope.data, sval = $scope.validation;
        var tset_data = {};
        var tst;

        if(sdata.name){
            tset_data.name = $scope.data.name;
        } else {
            sval.name = "Training set name is required.";
            sval.count++;
        }

        if(sdata.type && sdata.type.id){
            tset_data.type = sdata.type.identifier;
            tst = training_set_types[sdata.type.identifier];
        } else {
            sval.type = "Training set type is required.";
            sval.count++;
        }

        if(tst && tst.action && tst.action.collect_new_tset_data){
            tst.action.collect_new_tset_data(sdata, tset_data, sval);
        }

        $scope.form_data=tset_data;

        if(sval.count == 0){
            a2TrainingSets.add(tset_data, function(new_tset){
                if(new_tset.error) {
                    sval[new_tset.field] = new_tset.error;
                    return;
                }
                $modalInstance.close(new_tset);
            });
        }
    };
});
