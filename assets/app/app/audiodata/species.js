angular.module('a2.audiodata.species', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane'
])
.controller('SpeciesCtrl', function($scope, Project, $modal, notify, a2UserPermit, a2Templates, a2AudioBarService, $localStorage, $state, $window) {
    $scope.loading = false;
    $scope.isAdding = false;
    $scope.selected = {};
    $scope.supportLink = 'https://support.rfcx.org/article/34-pattern-matching-template'

    var timeout;

    $scope.pagination = {
        page: 1,
        limit: 10,
        offset: 0,
        totalItems: 0,
        totalPages: 0
    }

    $scope.searchSpecies = { q: '' };

    $scope.getProjectClasses = function() {
        $scope.loading = true;
        const opts = {
            q: $scope.searchSpecies.q,
            limit: $scope.pagination.limit,
            offset: $scope.pagination.offset * $scope.pagination.limit
        }

        Project.getClasses(opts).then(data => {
            $scope.pagination.totalItems = data.count
            const classes = data.list;
            if (classes.length) {
                a2Templates.getList({projectTemplates: true}).then(function(templates) {
                    const redirectLink = '/project/' + Project.getUrl() + '/analysis/patternmatching?tab=projectTemplates'
                    const cl = classes
                    $scope.templates = templates;
                    cl.forEach(cl => {
                        const temp = $scope.templates.filter(template => template.songtype === cl.songtype && template.species === cl.species)
                        if (temp && temp.length) {
                            if (temp.length >= 3) {
                                cl.extraTemplatesLink = redirectLink
                            }
                            cl.redirectLink = redirectLink
                            cl.templates = temp.slice(0, 3);
                        }
                    })
                });
                const classIds = classes.map(function(cl) {
                    return cl.id
                });
                a2Templates.getTemplatesByClass({classIds: classIds}).then(function(templates) {
                    const redirectLink = '/project/' + Project.getUrl() + '/analysis/patternmatching?tab=publicTemplates'
                    const cl = classes
                    const publicTemplates = templates;
                    cl.forEach(cl => {
                        const temp = publicTemplates.filter(template => template.songtype === cl.songtype && template.species === cl.species)
                        if (temp && temp.length) {
                            if (temp.length >= 3) {
                                cl.extraPublicTemplatesLink = redirectLink
                            }
                            cl.redirectPublicLink = redirectLink
                            cl.publicTemplates = temp.slice(0, 3);
                        }
                    })
                    $scope.loading = false;
                    $scope.classes = classes
                });
            } else {
                $scope.loading = false;
            }
        });

    }

    $scope.getProjectClasses()

    $scope.setCurrentPage = function() {
        $scope.pagination.offset = $scope.pagination.page - 1;
        $scope.getProjectClasses()
    };

    $scope.checkUserPermissions = function(publicTemplate) {
        if (!a2UserPermit.can('manage templates')) {
            return true;
        }
        else if (publicTemplate.project_url === Project.getUrl()) {
            return true;
        }
        else return false
    }

    $scope.addTemplate = function(template) {
        template.isAddingTemplate = true;
        $scope.isAdding = true
        a2Templates.add({
            name : template.name,
            recording : template.recording,
            species : template.species,
            songtype : template.songtype,
            roi : {
                x1: template.x1,
                y1: template.y1,
                x2: template.x2,
                y2: template.y2,
            },
            source_project_id: template.project
        }).then((function(data){
            console.log('new template', data);
            template.isAddingTemplate = false;
            $scope.isAdding = false
            if (data.id === 0) notify.error('The template already exists in the project templates.');
            else if (data.error) notify.error('You do not have permission to manage templates');
            else notify.log('The template is added to the project.');
            $scope.resetPagination()
            $scope.getProjectClasses()
        })).catch((function(err){
            console.log('err', err);
            template.isAddingTemplate = false;
            $scope.isAdding = false
            notify.error(err);
        }));
    },

    $scope.onFilterChanged = function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if ($scope.searchSpecies.q.trim().length > 0 && $scope.searchSpecies.q.trim().length < 4) return
            $scope.resetPagination()
            $scope.getProjectClasses()
        }, 1000);
    }

    $scope.resetPagination = function () {
        $scope.pagination.page = 1
        $scope.pagination.offset = 0
        $scope.pagination.totalItems = 0
        $scope.pagination.totalPages = 0
    }

    Project.getInfo(function(info){
        $scope.project = info;
    });

    $scope.showExtraTemplates = function(species, extraTemplatesLink) {
        $scope.removeFromLocalStorage();
        $localStorage.setItem('audiodata.templates', JSON.stringify(species));
        $window.location.href = extraTemplatesLink;
    }

    $scope.removeFromLocalStorage = function () {
        $localStorage.setItem('audiodata.templates', null);
        $state.params.tab = '';
    }

    $scope.playTemplateAudio = function(template, $event) {
        if ($event) {
            $event.preventDefault();
            $event.stopPropagation();
        };
        $localStorage.setItem('a2-audio-param-gain', JSON.stringify(2));
        console.info('play')
        a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(template), true);
    }

    $scope.getTemplateVisualizerUrl = function(template){
        const box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
        return template ? "/project/"+template.project_url+"/visualizer/rec/"+template.recording+"?a="+box : '';
    }

    $scope.add = function() {

        if(!a2UserPermit.can("manage project species")) {
            notify.error("You do not have permission to add species");
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/audiodata/select-species.html',
            controller: 'SelectSpeciesCtrl',
            size: 'lg',
        });

        modalInstance.result.then(function(selected) {

            var cls = {
                species: selected.species.scientific_name,
                songtype: selected.song.name
            };

            Project.addClass(cls)
                .success(function(result){
                    notify.log(selected.species.scientific_name + ' ' + selected.song.name +" added to project");

                    $scope.getProjectClasses()
                })
                .error(function(data, status) {
                    if(status < 500)
                        notify.error(data.error);
                    else
                        notify.serverError();
                });

        });
    };

    $scope.removeSpecies = function() {
        if(!$scope.checked || !$scope.checked.length)
            return;

        if(!a2UserPermit.can("manage project species")) {
            notify.error("You do not have permission to remove species");
            return;
        }

        var speciesClasses = $scope.checked.map(function(row) {
            return '"'+row.species_name +' | ' + row.songtype_name+'"';
        });

        var message = ["Are you sure you would like to remove the following species call from this project?"];
        var message2 = ["Note: validations for this species call will also be removed from this project."];

        $scope.popup = {
            messages: message.concat(message2, speciesClasses),
            btnOk: "Delete",
            btnCancel: "Cancel",
        };

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            scope: $scope
        });

        modalInstance.result.then(function() {
            var classesIds = $scope.checked.map(function(row) {
                return row.id;
            });

            var params = {
                project_classes: classesIds
            };

            Project.removeClasses(params)
                .success(function(result) {
                    $scope.getProjectClasses()
                })
                .error(function(data, status) {
                    if(status < 500)
                        notify.error(data.error);
                    else
                        notify.serverError();
                });
        });

    };
})
.controller('SelectSpeciesCtrl', function($scope, Species, Songtypes) {
    var timeout;
    Songtypes.get(function(songs) {
        $scope.songtypes = songs;
    });
    $scope.searchSpecies = function() {
        if($scope.search === "") {
            $scope.species = [];
            return;
        }
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            Species.search($scope.search, function(results){
                $scope.species = results;
            });
        }, 500)
    };
});
