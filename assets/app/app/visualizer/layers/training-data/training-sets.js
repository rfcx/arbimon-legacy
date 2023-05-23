angular.module('a2.visualizer.layers.training-sets', [
    'visualizer-services',
    'a2.visualizer.layers.training-sets.roi_set',
    'a2.utils',
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.training-sets.object:training-data
     * @description Training Data layer.
     * adds the training-data layer_type to layer_types. This layer uses
     * a2.visualizer.layers.training-sets.controller:a2VisualizerTrainingSetLayerController as controller,
     * and requires a visobject of type recording to be selected.
     */
    layer_typesProvider.addLayerType({
        type: "training-data",
        title: "",
        controller: 'a2VisualizerTrainingSetLayerController as training_data',
        require: {
            type: 'recording',
            selection: true
        },
        visible: true,
    });
})
.controller('a2VisualizerTrainingSetLayerController', function($scope, $modal, $controller, $timeout, a2TrainingSets, a2UserPermit, notify) {
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
        if(!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to create training sets');
            return;
        }

        $modal.open({
            templateUrl : '/app/visualizer/layers/training-data/add_tset_modal.html',
            controller  : 'a2VisualizerAddTrainingSetModalController'
        }).result.then(function (new_tset) {
            if(new_tset && new_tset.id) {
                self.tset_list.push(new_tset);
                if(!self.tset) {
                    self.tset = new_tset;
                }
            }
        });
    };

    var fetchTsetData = function(){
        var tset = self.tset && self.tset.id;
        var tset_type = self.tset && self.tset.type;
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if(tset && rec) {
            if(!self.data || self.data.type != tset_type){
                var cont_name = tset_type.replace(/(^|-|_)(\w)/g, function(_,_1,_2,_3){ return _2.toUpperCase(); });
                cont_name = 'a2VisualizerTrainingSetLayer'+cont_name+'DataController';
                self.data = $controller(cont_name,{$scope : $scope});
            }
            self.data.fetchData(tset, rec);
        }
    };

    $scope.$watch(function(){ return self.tset; }, fetchTsetData);
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
                        var tmp_url  = '/app/visualizer/spectrogram-layer/training-sets/' + tset_type + '.html';
                        $templateFetch(tmp_url, function(tmp){
                            element.empty().append($compile(tmp)(scope));
                        });
                    }
                }
            });
        }
    };
})
.controller('a2VisualizerAddTrainingSetModalController', function($scope, $modalInstance, Project, a2TrainingSets, $state){
    $scope.data = {
        name : '',
        type : null
    };

    $scope.loadingClasses = true;

    Project.getClasses(function(project_classes){
        $scope.project_classes = project_classes;
        $scope.loadingClasses = false;
    });

    $scope.loadingTypes = true;

    a2TrainingSets.getTypes(function(tset_types){
        $scope.tset_types = tset_types;
        if(tset_types && tset_types.length == 1) {
            $scope.data.type = tset_types[0];
            $scope.loadingTypes = false;
        }
    });

    $scope.goToSpeciesPage = function () {
        $state.go('audiodata.species', {});
    };

    $scope.ok = function(){
        $scope.creating = true;
        $scope.validation = {
            count:0
        };

        var tset_data = {};

        if($scope.data.name){
            tset_data.name = $scope.data.name;
        }
        else {
            $scope.validation.name = "Training set name is required.";
            $scope.validation.count++;
        }

        if($scope.data.type && $scope.data.type.id){
            tset_data.type = $scope.data.type.identifier;
        }
        else {
            $scope.validation.type = "Training set type is required.";
            $scope.validation.count++;
        }

        if($scope.data.class) {
            tset_data.class = $scope.data.class.id;
        }
        else {
            $scope.validation.class = "Species sound is required.";
            $scope.validation.count++;
        }

        // $scope.form_data=tset_data;

        if($scope.validation.count ===  0) {
            a2TrainingSets.add(tset_data, function(new_tset) {
                if(new_tset.error) {

                    var field = new_tset.field || 'error';

                    $scope.validation[field] = new_tset.error;

                    return;
                }
                $modalInstance.close(new_tset);
            });
        }
        else {
            $scope.creating = false;
        }
    };
});
