angular.module('a2.audiodata.soundscape-composition-classes', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('audiodata.scAnnotationClasses', {
        url: '/soundscape-annotation-classes',
        controller:'SoundscapeCompositionClassesScreenCtrl as controller',
        templateUrl: '/app/audiodata/soundscape-composition-classes.html'
    });
})
.controller('SoundscapeCompositionClassesScreenCtrl', function(
    $modal,
    notify,
    Project,
    a2SoundscapeCompositionService, a2UserPermit
) {
    this.initialize = function(){
        this.loading = true;
        this.newClass = {};
        this.canManageClasses = a2UserPermit.can("manage project species");
        a2SoundscapeCompositionService.getClassList({tally:1, groupByType:true, isSystemClass:1}).then((function(classes){
            this.classes = classes;
            this.loading = false;
        }).bind(this));
    };

    this.addNewClass = function(groupType){
        var className = this.newClass[groupType.typeId];
        delete this.newClass[groupType.typeId];
        if(className){

            if(!a2UserPermit.can("manage project species")) {
                notify.error("You do not have permission to add soundscape composition classes");
                return;
            }

            a2SoundscapeCompositionService.addClass(className, groupType.typeId).then((function(newClass){
                groupType.list.push(newClass);
            }).bind(this)).catch(function(err){
                notify.error(err.data || err.message);
            });
        }
    };

    this.removeClass = function(scClass){
        if(scClass.isSystemClass){
            return;
        }

        if(!a2UserPermit.can("manage project species")) {
            notify.error("You do not have permission to remove soundscape composition classes");
            return;
        }

        a2SoundscapeCompositionService.removeClass(scClass.id).then((function(){
            this.classes.forEach(function(classGroup){
                var index = classGroup.list.indexOf(scClass);
                if(index >= 0){
                    classGroup.list.splice(index, 1);
                }
            });
        }).bind(this)).catch(function(err){
            notify.error(err.data || err.message);
        });
    };

    this.add = function() {

        if(!a2UserPermit.can("manage project species")) {
            notify.error("You do not have permission to add species");
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/audiodata/select-species.html',
            controller: 'SelectSoundscapeCompositionClassesScreenCtrl',
            windowClass: 'modal-bg-echo',
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

                    Project.getClasses().then(classes => {
                        this.classes = classes;
                    });
                })
                .error(function(data, status) {
                    if(status < 500)
                        notify.error(data.error);
                    else
                        notify.serverError();
                });

        });
    };

    this.del = function() {
        if(!this.checked || !this.checked.length)
            return;

        if(!a2UserPermit.can("manage project species")) {
            notify.error("You do not have permission to remove species");
            return;
        }

        var speciesClasses = this.checked.map(function(row) {
            return '"'+row.species_name +' | ' + row.songtype_name+'"';
        });

        var message = ["You are about to delete the following project species: "];
        var message2 = ["Are you sure?"];

        this.popup = {
            messages: message.concat(speciesClasses, message2),
            btnOk: "Yes, do it!",
            btnCancel: "No",
        };

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            windowClass: 'modal-bg-echo',
            scope: this
        });

        modalInstance.result.then(function() {
            var classesIds = this.checked.map(function(row) {
                return row.id;
            });

            var params = {
                project_classes: classesIds
            };

            Project.removeClasses(params)
                .success(function(result) {
                    Project.getClasses().then(classes => {
                        this.classes = classes;
                    });
                })
                .error(function(data, status) {
                    if(status < 500)
                        notify.error(data.error);
                    else
                        notify.serverError();
                });
        });

    };

    this.initialize();

})
;
