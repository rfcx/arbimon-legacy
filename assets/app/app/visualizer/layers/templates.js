angular.module('a2.visualizer.layers.templates', [
    'visualizer-services',
    'a2.utils',
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.templates.object:templates
     * @description Templates layer.
     * adds the templates layer_type to layer_types. This layer uses
     * a2.visualizer.layers.templates.controller:a2VisualizerTemplateLayerController as controller,
     * and requires a visobject of type recording to be selected.
     */
    layer_typesProvider.addLayerType({
        type: "templates",
        title: "",
        controller: 'a2VisualizerTemplateLayerController as templates',
        require: {
            type: 'recording',
            selection: true
        },
        visible: true,
    });
})
.controller('a2VisualizerTemplateLayerController', function($scope, $modal, $controller, $state, $timeout, a2Templates, a2UserPermit, a22PointBBoxEditor, Project, notify) {
    var self = this;
    self.selected = null;
    self.templates = [];
    self.recordingTemplates = [];
    self.citizenScientistUser = a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper();

    Project.getClasses(function(project_classes){
        self.project_classes = project_classes;
    });

    var getTemplatesPromise = a2Templates.getList({projectTemplates: true}).then(function(templates){
        self.templates = templates;
        return templates;
    });

    self.updateState = function(){
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        getTemplatesPromise.then(function(){
            self.recordingTemplates = self.templates.filter(function(template){
                return template.recording == rec;
            });
        });
        self.editor.reset();
        self.editor.recording = rec;
    };

    self.goToSpeciesPage = function () {
        $state.go('audiodata.species', {});
    };

    self.editor = angular.extend(
        new a22PointBBoxEditor(), {
        reset: function(){
            this.super.reset.call(this);
            this.roi    = null;
        },
        make_new_bbox: function(){
            this.super.make_new_bbox.call(this);
            this.roi     = this.bbox;
        },
        make_new_roi: function(){
            this.make_new_bbox();
        },
        add_tracer_point : function(point){
            this.super.add_tracer_point.call(this, point.sec, point.hz);
        },
        add_point : function(point, min_eps){
            console.log('add_point : function(', point, ', ', min_eps, '){')
            this.super.add_point.call(this, point.sec, point.hz, min_eps);
        },
        get_placeholder_name: function(){
            return this.project_class ? (this.project_class.species_name + ' ' + this.project_class.songtype_name) : 'Template Name';
        },
        submit: function(){
            if(!a2UserPermit.can('manage templates')) {
                notify.error('You do not have permission to add a template');
                return;
            }

            if(!this.project_class.songtype_name && !this.project_class.species_name){
                return;
            }

            this.submitting = true;

            a2Templates.add({
                name : this.template_name || (this.project_class.species_name + " " + this.project_class.songtype_name),
                recording : this.recording,
                species : this.project_class.species,
                songtype : this.project_class.songtype,
                roi : this.roi
            }).then((function(new_template){
                console.log('new_template', new_template)
                this.submitting = false;

                if (new_template.id === 0) return notify.error('The template with that name already exists for this record.');
                $timeout((function(){
                    this.reset();
                    self.templates.push(new_template);
                    self.updateState();
                }).bind(this));
            }).bind(this));
        }
    });

    $scope.$watch('visobject', self.updateState);
})
// .controller('a2VisualizerAddTemplateModalController', function($scope, $modalInstance, Project, a2Templates){
//     $scope.data = {
//         name : '',
//         type : null
//     };
//
//     $scope.loadingClasses = true;
//
//     Project.getClasses(function(project_classes){
//         $scope.project_classes = project_classes;
//         $scope.loadingClasses = false;
//     });
//
//     $scope.loadingTypes = true;
//
//     a2Templates.getTypes(function(template_types){
//         $scope.template_types = template_types;
//         if(template_types && template_types.length == 1) {
//             $scope.data.type = template_types[0];
//             $scope.loadingTypes = false;
//         }
//     });
//
//     $scope.ok = function(){
//         $scope.creating = true;
//         $scope.validation = {
//             count:0
//         };
//
//         var template_data = {};
//
//         if($scope.data.name){
//             template_data.name = $scope.data.name;
//         }
//         else {
//             $scope.validation.name = "Training set name is required.";
//             $scope.validation.count++;
//         }
//
//         if($scope.data.type && $scope.data.type.id){
//             template_data.type = $scope.data.type.identifier;
//         }
//         else {
//             $scope.validation.type = "Training set type is required.";
//             $scope.validation.count++;
//         }
//
//         if($scope.data.class) {
//             template_data.class = $scope.data.class.id;
//         }
//         else {
//             $scope.validation.class = "Species sound is required.";
//             $scope.validation.count++;
//         }
//
//         // $scope.form_data=template_data;
//
//         if($scope.validation.count ===  0) {
//             a2Templates.add(template_data, function(new_template) {
//                 if(new_template.error) {
//
//                     var field = new_template.field || 'error';
//
//                     $scope.validation[field] = new_template.error;
//
//                     return;
//                 }
//                 $modalInstance.close(new_template);
//             });
//         }
//         else {
//             $scope.creating = false;
//         }
//     };
// })
;
