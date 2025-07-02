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
    self.resetSearch = false;
    self.showTemplateNotification = false;
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

    self.onSpeciesExists = function($select) {
        console.log('[onSpeciesExists] search', $select.search)
        if (!$select.search) {
            self.userSearch = '';
            return;
        }
        if (self.resetSearch) {
            $select.search = '';
            self.userSearch = '';
            self.resetSearch = false;
            return;
        }
        self.userSearch = $select.search;
        const classes = self.project_classes ? self.project_classes.filter(function(cl) {
            const species = cl.species_name.toLowerCase()
            const searchFormatted = $select.search.toLowerCase()
            if (species.indexOf(searchFormatted) != -1) {
                return true;
            } else return false;
        }) : []
        if (classes.length === 0) {
            self.toggleSpeciesAdd = true;
            self.toggleSpeciesSelect = false;
            self.selected = {};
            self.tempSelected = {};
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
            if (self.userSearch && self.classToAdd.species) {
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
    self.addSpecies = function($event) {
        $event.stopPropagation();
        self.toggleSpeciesAdd = false;
        self.toggleSpeciesSelect = true;
        Species.search(self.userSearch, function(results) {
            self.allSpecies = results;
        });
    }
    self.selectSpecies = function(specie) {
        self.classToAdd.species = specie.scientific_name
        self.toggleSpeciesSelect = false;
        self.selected = {};
        self.tempSelected = {};
        Songtypes.get(function(songs) {
            self.songtypes = songs;
        });
        self.toggleSongtypeSelect = true;
    }
    self.selectSongtype = function(song) {
        self.classToAdd.songtype = song.name
    }
    self.closeTemplateNotification = function() {
        self.showTemplateNotification = false;
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
                self.resetSearch = true;
                self.userSearch = '';
                // Reload the validations list on the Species Presence.
                $scope.$broadcast('a2-persisted', {
                    species_name: self.classToAdd.species,
                    songtype_name: self.classToAdd.songtype
                })
                $scope.$broadcast('a2-persisted-validator')
                self.getClasses().then(() => {
                    const newSelectedClass = self.project_classes.find(cl => cl.species_name === self.classToAdd.species && cl.songtype_name === self.classToAdd.songtype)
                    console.log('newSelectedClass', newSelectedClass, self.classToAdd)
                    self.selectClass(newSelectedClass)
                })
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
            self.classToAdd = { species: null, songtype: null};
            return;
        }
        self.selected = selected;
        self.tempSelected = selected;
        self.editor.project_class = selected;
        self.toggleSpeciesAdd = false;
        self.toggleSpeciesSelect = false;
        self.toggleSongtypeSelect = false;
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
        submit: function() {
            self.showTemplateNotification = false;
            if(!a2UserPermit.can('manage templates')) {
                notify.error('You do not have permission to add a template');
                return;
            }
            console.log('this.recording', this.recording, this.roi, $scope.visobject)

            const frequency = $scope.visobject.span;
            const roiX = this.roi.x2 - this.roi.x1;
            const roiY = this.roi.y2 - this.roi.y1;

            if ((roiX > 5) || (roiY > (frequency/2))) {
                self.showTemplateNotification = true;
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
;
