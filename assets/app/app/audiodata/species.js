angular.module('a2.audiodata.species', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane'
])
.controller('SpeciesCtrl', function($scope, Project, $modal, notify, a2UserPermit, a2Templates, a2AudioBarService, $localStorage, $state, $window) {
    $scope.loading = true;
    $scope.selected = {};
    $scope.supportLink = 'https://support.rfcx.org/article/34-pattern-matching-template'

    $scope.getProjectClasses = function() {
        Project.getClasses().then(classes => {
            $scope.classes = classes;
        });

        a2Templates.getList({projectTemplates: true}).then(function(templates){
            const classes = $scope.classes
            $scope.templates = templates;
            classes.forEach(cl => {
                const temp = $scope.templates.filter(template => template.songtype === cl.songtype && template.species === cl.species)
                if (temp && temp.length) {
                    cl.templates = temp.slice(0, 3);
                    cl.extraTemplatesLink = '/project/' + Project.getUrl() + '/analysis/patternmatching?tab=publicTemplates'
                }
            })
            $scope.classes = classes
            $scope.loading = false;
        });
    }

    $scope.getProjectClasses()

    Project.getInfo(function(info){
        $scope.project = info;
    });

    $scope.showExtraTemplates = function(species, extraTemplatesLink) {
        $scope.removeFromLocalStorage();
        $localStorage.setItem('audiodata.templates',  JSON.stringify(species));
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
        return template ? "/project/"+template.project_url+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
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

    $scope.del = function() {
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
            btnOk: "Yes, do it!",
            btnCancel: "No",
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
