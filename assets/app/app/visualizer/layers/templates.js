angular.module('a2.visualizer.layers.templates', [
    'visualizer-services',
    'a2.utils',
    'a2.directive.click-outside'
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
.controller('a2VisualizerTemplateLayerController', function($scope, $state, $timeout, a2Templates, a2UserPermit, a22PointBBoxEditor, Project, Species, Songtypes, notify) {
    var self = this;
    self.selectedRoi = null;
    self.toggleSpeciesAdd = false;
    self.toggleSpeciesSelect = false;
    self.toggleSongtypeSelect = false;
    self.userSearch = '';
    self.allSpecies = [];
    self.songtypes = [];
    self.classToAdd = { species: null, songtype: null};
    self.timeout;
    self.selected = {}
    self.tempSelected = {}
    self.templates = [];
    self.recordingTemplates = [];
    self.citizenScientistUser = a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper();

    self.getClasses = function() {
        return Project.getClasses().then(project_classes => {
            self.project_classes = project_classes.list ? project_classes.list : project_classes;
        });
    }

    self.getClasses();

    self.onSpeciesExists = function(search) {
        console.log('[onSpeciesExists] search', search)
        if (!search) {
            self.userSearch = '';
            return;
        }
        self.userSearch = search;
        const classes = self.project_classes ? self.project_classes.filter(function(cl) {
            const species = cl.species_name.toLowerCase()
            const searchFormatted = search.toLowerCase()
            if (species.indexOf(searchFormatted) != -1) {
                return true;
            } else return false;
        }) : []
        console.log('[onSpeciesExists] classes', classes)
        if (classes.length === 0) {
            self.toggleSpeciesAdd = true;
            self.toggleSpeciesSelect = false;
        }
        else {
            self.toggleSpeciesAdd = false;
            self.toggleSpeciesSelect = false;
        }
    }

    self.hide = function() {
        self.toggleSpeciesAdd = false;
        self.toggleSpeciesSelect = false;
        self.toggleSongtypeSelect = false;
    }
    self.onSearchClick = function() {
        clearTimeout(self.timeout);
        self.timeout = setTimeout(() => {
            console.log('[onSearchClick]', self.userSearch, self.classToAdd.species)
            if (self.userSearch && self.classToAdd.species) {
                self.toggleSpeciesAdd = false;
                self.toggleSpeciesSelect = false;
                self.toggleSongtypeSelect = true;
                return;
            }
            if (self.userSearch && !self.classToAdd.species) {
                self.toggleSpeciesSelect = false;
                self.toggleSongtypeSelect = false;
                const classes = self.project_classes ? self.project_classes.filter(function(cl) {
                    const species = cl.species_name.toLowerCase()
                    const searchFormatted = self.userSearch.toLowerCase()
                    if (species.indexOf(searchFormatted) != -1) {
                        return true;
                    } else return false;
                }) : []
                self.toggleSpeciesAdd = classes.length === 0 ? true : false;
                return;
            }
        }, 300);
    }
    self.addSpecies = function() {
        self.toggleSpeciesAdd = false;
        self.toggleSpeciesSelect = true;
        Species.search(self.userSearch, function(results) {
            self.allSpecies = results;
        });
    }

    self.selectSpecies = function(specie) {
        self.classToAdd.species = specie.scientific_name
        self.toggleSpeciesSelect = false;
        Songtypes.get(function(songs) {
            self.songtypes = songs;
        });
        self.toggleSongtypeSelect = true;
    }

    self.selectSongtype = function(song) {
        self.classToAdd.songtype = song.name
    }
    self.backToSelectSpecies = function() {
        self.toggleSpeciesSelect = true;
        self.toggleSongtypeSelect = false;
    }
    self.addClass = function() {
        self.toggleSpeciesSelect = false;
        Project.addClass(self.classToAdd)
            .success(function(result) {
                notify.log(self.classToAdd.species + ' ' + self.classToAdd.songtype + " added to the project");
                self.toggleSongtypeSelect = false;
                // Reload the validations list on the Species Presence
                $scope.$broadcast('a2-persisted')
                self.getClasses().then(() => {
                    const newSelectedClass = self.project_classes.find(cl => cl.species_name === self.classToAdd.species && cl.songtype_name === self.classToAdd.songtype)
                    self.selectClass(newSelectedClass)
                });
            })
            .error(function(data, status) {
                self.toggleSongtypeSelect = false;
                if (status < 500)
                    notify.error(data.error);
                else
                    notify.error('There was a system error. Please try again.');
            });
    }
    self.selectClass = function(selected) {
        console.log('[selectClass] selected', selected)
        if (!selected) {
            self.selected = {};
            self.tempSelected = {};
            self.userSearch = '';
            self.classToAdd = { species: null, songtype: null};
            return;
        }
        self.selected = selected;
        self.tempSelected = selected;
        self.editor.project_class = selected;
        self.toggleSpeciesAdd = false;
        self.toggleSpeciesSelect = false;
        self.toggleSongtypeSelect = false;
        self.userSearch = '';
        self.classToAdd = { species: null, songtype: null};
    }

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
