angular.module('a2.audiodata.species', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane',
    'angularFileUpload',
    'uiSwitch'
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
            $scope.pagination.totalItems = data.count;
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

.controller('SpeciesBulkInsertModalCtrl', function($scope, $modalInstance, Project, notify, a2UserPermit) {
    $scope.isActiveStepper = 'Select';
    $scope.files=[];
    $scope.originalFiles=[];
    $scope.isSpeciesReading = false;
    $scope.isSpeciesBulkLoading = false;
    $scope.toggleErrorSpecies = 0;
    $scope.fileContent = [];

    $scope.handler = function(e, files) {
        $scope.isSpeciesReading = true;
        var reader = new FileReader();
        if (!e.target.files[0]) return
        $scope.fileName = e.target.files[0].name;
        $scope.csvFile = $scope.fileName.includes('.csv');
        reader.onload = function(event) {
            if ($scope.csvFile) {
                const res = reader.result.split(/\r\n|\n/);
                $scope.readFileData(res);
            } else {
                const data = new Uint8Array(reader.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                $scope.readFileData(json);
            }
        }
        $scope.csvFile ? reader.readAsText(files[0]) : reader.readAsArrayBuffer(e.target.files[0]);
        $scope.isSpeciesReading = false;
    }

    $scope.$on('fileContent', function(event, data) {
        $scope.csvFile = data.csvFile;
        $scope.fileName = data.fileName;
        const content = data.fileContent;
        if (content && content.length) $scope.readFileData(content);
     });

    $scope.readFileData = function(res) {
        if (!res.length) return $scope.errorMessage = 'The imported file is empty. Please check and try again.';
        $scope.csvFile ? $scope.parseCSVSpeciesBulk(res) : $scope.parseExcelSpeciesBulk(res);
        Project.recognizeClasses({classes: $scope.files})
            .success(function(result){
                $scope.files = result.classes;
                $scope.originalFiles = result.classes;
                $scope.errorSpecies = $scope.files.filter(f => f.status === 'Failed' && f.error !== 'Species class already exists.');
                $scope.existedSpecies = $scope.files.filter(f => f.status === 'Failed' && f.error === 'Species class already exists.');
                $scope.errorSpecies = $scope.errorSpecies.map((sp, ind) => {
                    return {
                        species: sp.species,
                        sound: sp.sound,
                        status: sp.status,
                        error: sp.error,
                        position: ind + 1
                    }
                })
                $scope.existedSpecies = $scope.existedSpecies.map((sp, ind) => {
                    return {
                        species: sp.species,
                        sound: sp.sound,
                        status: sp.status,
                        error: sp.error,
                        position: ind + 1
                    }
                })
                console.log($scope.errorSpecies, $scope.existedSpecies)
                if ($scope.errorSpecies.length) {
                    $scope.errorMessage = $scope.errorSpecies.length + ($scope.errorSpecies.length === 1 ? ' species name is not recognized. Please add it manually.' : ' species names are not recognized. Please add them manually.');
                }
                if ($scope.existedSpecies.length) {
                    $scope.existedSpeciesMessage = $scope.existedSpecies.length + ($scope.existedSpecies.length === 1 ? ' species is already existed.' : ' species are already existed.');
                }
                $scope.reviewState();
            })
            .error(function(data, status) {
                notify.serverError();
            });
    }

    $scope.disableUpload = function () {
        const errSpecies = $scope.files.filter(f => f.status === 'Failed');
        return !$scope.fileName || $scope.isActiveStepper === 'Select' || (errSpecies && errSpecies.length === $scope.files.length)
    }

    $scope.parseCSVSpeciesBulk = function (res) {
        var ind = 0
        res.forEach(sp => {
            if (!sp.length) return
            const cl = sp.split(',');
            const species = cl[0].trim();
            const sound = cl[1].trim();
            if (species.toLowerCase() === 'species' || sound.toLowerCase() === 'sound') return
            $scope.files.push({
                species: species,
                sound: sound,
                status: 'Waiting',
                position: ind + 1
            })
            ind++
        })
    }

    $scope.parseExcelSpeciesBulk = function (res) {
        res.forEach((sp, ind) => {
            const species  = sp.species ? sp.species : sp.Species;
            const sound = sp.sound ? sp.sound : sp.Sound ? sp.Sound : sp.Songtype ? sp.Songtype : sp.songtype;
            $scope.files.push({
                species: species,
                sound: sound,
                status: 'Waiting',
                position: ind + 1
            })
        })
    }

    $scope.downloadSpeciesExample = function () {
        const headers = { species: 'Species', sound: 'Sound' };
        const species = [
            { species: 'Acanthis flammea', sound: 'Common Song' },
            { species: 'Alophoixus bres', sound: 'Simple Call' },
            { species: 'Amaurornis olivacea moluccana', sound: 'Common Song'},
            { species: 'Amazona mercenaria', sound: 'Common Song' },
            { species: 'Amazona xanthops', sound: 'Common Song' },
            { species: 'Aramides cajanea', sound: 'Common Song' }
        ]
        exportCSVFile(headers, species, 'species_example');
    }

    $scope.downloadUnrecognizedSpecies = function () {
        const headers = { species: 'Species', sound: "Sound" };
        var itemsFormatted = [];
        $scope.errorSpecies.forEach((item) => {
            itemsFormatted.push({
                species: item.species,
                sound: item.sound
            });
        });
        exportCSVFile(headers, itemsFormatted, 'unrecognized_species');
    }

    var exportCSVFile = function(headers, items, fileTitle) {
        if (headers) {
            items.unshift(headers);
        }
        const jsonObject = JSON.stringify(items);
        const csv = convertToCSV(jsonObject);
        const exportedFilenmae = fileTitle + '.csv' || 'export.csv';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, exportedFilenmae);
        } else {
            var link = document.createElement("a");
            if (link.download !== undefined) {
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", exportedFilenmae);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

    var convertToCSV = function(objArray) {
        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        var str = '';
        for (var i = 0; i < array.length; i++) {
            var line = '';
            for (var index in array[i]) {
                if (line != '') line += ','
                line += array[i][index];
            }
            str += line + '\r\n';
        }
        return str;
    }

    $scope.disableToggle = function() {
        const isDisable = !a2UserPermit.can('manage project species');
        if (isDisable) { $scope.toggleErrorSpecies = 0 }
        return isDisable
    }

    $scope.toggleShowErrorOnly = function() {
        if ($scope.disableToggle()) return;
        $scope.toggleErrorSpecies = !$scope.toggleErrorSpecies;
        if ($scope.toggleErrorSpecies) {
            $scope.files = $scope.existedSpecies ? $scope.errorSpecies.concat($scope.existedSpecies) : $scope.errorSpecies;
            $scope.files = $scope.files.map((sp, ind) => {
                return {
                    species: sp.species,
                    sound: sp.sound,
                    status: sp.status,
                    error: sp.error,
                    position: ind + 1
                }
            })
        } else $scope.files = $scope.originalFiles;
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
        return $scope.isActiveStepper === 'Select';
    }

    $scope.isUploadStepper = function () {
        return $scope.isActiveStepper === 'Upload';
    }

    $scope.isReviewStepper = function () {
        return $scope.isActiveStepper === 'Review';
    }

    $scope.reviewState = function () {
        $scope.isSpeciesReading = false;
        $scope.isActiveStepper = 'Review';
    }

    $scope.uploadSpecies = function () {
        $scope.uploadState();
        $scope.successFiles = $scope.originalFiles.filter(file => file.status === 'Success');
        $scope.percentage = 80;
        Project.bulkAddClasses({classes: $scope.successFiles})
            .success(function(result) {
                $scope.percentage = 100;
                $scope.isSpeciesBulkLoading = false
            })
            .error(function(data, status) {
                $scope.isSpeciesBulkError = true;
            });
    }

    $scope.cancel = function(){
        $modalInstance.dismiss();
    }
})
.directive('fileDrop', function() {
    return {
        restrict: 'A',
        scope: {
            fileContent: '='
        },
        link: function(scope, element) {
            element.bind('dragover', function(event) {
                if (event != null) {
                    event.preventDefault();
                }
                (event.originalEvent || event).dataTransfer.effectAllowed = 'copy';
                return false;
            });
            element.bind('dragenter', function(event) {
                event.preventDefault();
                return false;
            });
            element.bind('drop', function(event) {
                if (event != null) {
                    event.preventDefault();
                }
                const file = (event.originalEvent || event).dataTransfer.files[0];
                var reader = new FileReader();
                const fileName = file.name;
                const csvFile = fileName.includes('.csv');
                reader.onload = function(event) {
                    const result = event.target.result;
                    if (csvFile) {
                        scope.fileContent = result.split(/\r\n|\n/);
                    } else {
                        const data = new Uint8Array(result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(worksheet);
                        scope.fileContent = json;
                    }
                    scope.$apply();
                    scope.$emit('fileContent', { fileContent: scope.fileContent, csvFile: csvFile, fileName: fileName });
                };
                csvFile ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
            });
        }
    };
})
