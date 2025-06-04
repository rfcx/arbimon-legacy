angular.module('a2.audiodata.species', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane',
    'angularFileUpload'
])
.controller('SpeciesCtrl', function($scope, Project, $modal, notify, a2UserPermit, a2Templates, a2AudioBarService, $localStorage, $state, $window, $downloadResource) {
    $scope.loading = false;
    $scope.isAdding = false;
    $scope.selected = {};
    $scope.supportLink = 'https://help.arbimon.org/article/226-creating-a-template'

    var timeout;

    $scope.pagination = {
        page: 1,
        limit: 10,
        offset: 0,
        totalItems: 0,
        totalPages: 0
    }

    $scope.searchSpecies = { q: '' };
    var timeout

    $scope.getProjectClasses = function(isLoading, isTimeout) {
       if (isLoading === true) {
            $scope.loading = true;
       }
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
                            console.log('--addedTemplate', $scope.addedTemplate, cl.templates[0].id)
                            cl.templates[0].addedTemplate = $scope.addedTemplate && cl.templates[0].id === $scope.addedTemplate.id ? true : false
                        }
                    })
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
                        if (isLoading === true) $scope.loading = false;
                        $scope.classes = classes
                        if (isLoading == false && isTimeout == true) {
                            console.log('--getProjectClasses after adding')
                            $scope.addedTemplate = undefined
                            clearTimeout(timeout);
                            timeout = setTimeout(() => {
                                $scope.getProjectClasses(false, false)
                            }, 1500)
                        }
                    });
                });
            } else {
                if (isLoading === true) {
                    $scope.loading = false;
                }
            }
        });

    }

    $scope.getProjectClasses(true)

    $scope.setCurrentPage = function() {
        $scope.pagination.offset = $scope.pagination.page - 1;
        $scope.getProjectClasses(true)
    };

    $scope.checkUserPermissions = function(publicTemplate) {
        if (!a2UserPermit.can('manage templates')) {
            return true;
        }
        else if (publicTemplate.project_url === Project.getUrl()) {
            return true;
        }
        const cl = $scope.classes.find(c => c.species === publicTemplate.species && c.songtype === publicTemplate.songtype)
        var isDuplicate = false
        if (cl && cl.templates && cl.templates.length) {
            cl.templates.forEach(template => {
                if (template.recording === publicTemplate.recording && template.x1 === publicTemplate.x1 && template.x2 === publicTemplate.x2
                        && template.y1 === publicTemplate.y1 && template.y2 === publicTemplate.y2) {
                            isDuplicate = true
                        }
            })
        }
        return isDuplicate
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
            $scope.isAdding = false;
            $scope.addedTemplate = data;
            if (data.id === 0) notify.error('The template already exists in the project templates.');
            else if (data.error) notify.error('You do not have permission to manage templates');
            $scope.resetPagination()
            $scope.getProjectClasses(false, true)
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
            if ($scope.searchSpecies.q.trim().length > 0 && $scope.searchSpecies.q.trim().length < 3) return
            $scope.resetPagination()
            $scope.getProjectClasses(true)
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
        console.log(species)
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
            windowClass: 'modal-element width-900'
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

    $scope.bulkImport = function() {
        if (!a2UserPermit.can("manage project species")) {
            return notify.error("You do not have permission to add species");
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/audiodata/species-bulk-insert-modal.html',
            controller: 'SpeciesBulkInsertModalCtrl',
            size: 'lg',
            windowClass: 'modal-element width-900'
        });

        modalInstance.result.then(function() {
            $scope.getProjectClasses();
        });
    }

    $scope.exportSpecies = function() {
        if (a2UserPermit.isSuper()) return $downloadResource(Project.getSpeciesExportUrl());
        if (a2UserPermit.getUserRole() === 'Data Entry') {
            $downloadResource(Project.getSpeciesExportUrl());
        }
        else if (!a2UserPermit.can('manage project species')) {
            return notify.error('You do not have permission to export species')
        } else $downloadResource(Project.getSpeciesExportUrl());
    }

    $scope.removeSpecies = function() {
        if(!$scope.checked || !$scope.checked.length)
            return;
        if(!a2UserPermit.can("manage project species") || (a2UserPermit.can("manage project species") && !a2UserPermit.can('export report'))) {
            notify.error("You do not have permission to remove species");
            return;
        }

        var speciesClasses = $scope.checked.map(function(row) {
            return '"'+row.species_name +' | ' + row.songtype_name+'"';
        });

        var message = ["Are you sure you would like to delete the following species call from this project?"];

        $scope.popup = {
            title: "Delete species",
            messages: message.concat(speciesClasses),
            btnOk: "Delete",
            btnCancel: "Cancel",
            note: "Note: validations for this species call will also be deleted from this project.",
            isForDeletePopup: true
        };

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            scope: $scope,
            windowClass: 'modal-element'
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
                    $scope.getProjectClasses(true)
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
})

.controller('SpeciesBulkInsertModalCtrl', function($scope, $modalInstance, Project, FileUploader) {
    $scope.isActiveStepper = 'Select';
    $scope.infoMessage = 'All uploaded species will have a default “Simple Call”';
    $scope.errorSpecies = false;
    $scope.files=[];
    $scope.isSpeciesReading = false;
    $scope.isSpeciesBulkLoading = false;

    $scope.uploader = new FileUploader();

    $scope.handler = function(e, files) {
        $scope.isSpeciesReading = true;
        var reader = new FileReader();
        if (!e.target.files[0]) return
        $scope.fileName = e.target.files[0].name;
        reader.onload = function(event) {
            const res = reader.result.split(/\r\n|\n/);
            res.length ? $scope.parseSpeciesBulk(res) : $scope.showErrorMessage('Not any data provided.');
            Project.recognizeClasses({classes: $scope.files})
                .success(function(result){
                    $scope.files = result.classes;
                    $scope.errorSpecies = $scope.files.filter(f => f.status === 'Failed');
                    if ($scope.errorSpecies.length) $scope.infoMessage = $scope.errorSpecies.length + ' species names are not recognized. Please add them manually.';
                    $scope.reviewState();
                })
                .error(function(data, status) {
                    notify.serverError();
                });
        }
        reader.readAsText(files[0]);
        $scope.isSpeciesReading = false;
    }

    $scope.parseSpeciesBulk = function (res) {
       res.forEach((sp, ind) => {
        if (!sp.length) return
        $scope.files.push({
            species: sp,
            sound: 'Simple Call',
            status: 'Waiting',
            position: ind + 1
        })
       })
    }

    $scope.uploadState = function () {
        $scope.isSpeciesBulkLoading = true;
        $scope.isActiveStepper = 'Upload';
        $scope.percentage = 10;
    }

    $scope.isPercentageFinished = function () {
        return $scope.percentage === 100;
    }

    $scope.isSelectStepper = function () {
        return isActiveStepper === 'Select';
    }

    $scope.isUploadStepper = function () {
        return isActiveStepper === 'Upload';
    }

    $scope.isReviewStepper = function () {
        return isActiveStepper === 'Review';
    }

    $scope.reviewState = function () {
        $scope.isSpeciesReading = false;
        $scope.isActiveStepper = 'Review';
    }

    $scope.uploadSpecies = function () {
        $scope.uploadState();
        $scope.successFiles = $scope.files.filter(file => file.status === 'Success');
        $scope.percentage = 80;
        Project.bulkAddClasses({classes: $scope.successFiles})
            .success(function(result) {
                $scope.percentage = 100;
                $scope.isSpeciesBulkLoading = false
                $modalInstance.close();
            })
            .error(function(data, status) {
                $scope.isSpeciesBulkError = true;
            });
    }

    $scope.cancel = function(){
        $modalInstance.dismiss();
    }
})
