angular.module('a2.audiodata.training-sets', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.visualizer.layers.training-sets',
    'humane'
])
.factory('a2TrainingSetHistory',
    function() {
        var lastSet,
            lastPage,
            lastRoi,
            lastRoiSet,
            viewState,
            lastSpecie,
            lastSongtype;

        return {
            getLastSet : function(callback) {
                callback ({ls:lastSet,lp:lastPage,lr:lastRoi,lrs:lastRoiSet,vs:viewState,sp:lastSpecie,sg:lastSongtype}) ;
            },
            setLastSet : function(val) {
                lastSet = val;
            },
            setLastPage: function(val) {
                lastPage = val;
            },
            setLastRoi: function(val) {
                lastRoi = val;
            },
            setLastRoiSet: function(val) {
                lastRoiSet = val;
            },
            setViewState: function(val) {
                viewState = val;
            },
            setLastSpecies: function(valsp,valsg) {
                lastSpecie = valsp;
                lastSongtype = valsg;
            }
        };
    }
)
.controller('TrainingSetsCtrl', function($state, a2TrainingSets, Project, $q, $modal, a2TrainingSetHistory, a2UserPermit, notify) {
    var p={
        set : $state.params.set,
        show : $state.params.show
    };

    this.selected = {roi_index:0, roi:null, page:0};
    this.total = {rois:0, pages:0};
    this.loading = {list:false, details:false};

    this.rois = [];
    this.species = '';
    this.songtype = '';
    this.detailedView = p.show != "gallery";
    this.currentrois = [];
    this.roisPerpage = 100;
    this.detailedView = false;
    this.loaderDisplay = false;

    this.getROIVisualizerUrl = function(roi){
        return roi ? "/project/"+this.projecturl+"/visualizer/rec/"+roi.recording : '';
    };

    this.setROI = function(roi_index){
        if(this.total.rois <= 0){
            this.selected.roi_index = 0;
            this.selected.roi = null;
        } else {
            this.selected.roi_index = Math.max(0, Math.min(roi_index | 0, this.total.rois - 1));
            this.selected.roi = this.rois[this.selected.roi_index];
        }
        a2TrainingSetHistory.setLastRoi(this.selected.roi);
        return this.selected.roi;
    };

    this.setPage = function(page){
        if(this.total.rois <= 0){
            this.selected.page = 0;
            this.selected.currentrois = [];
        } else {
            this.selected.page = Math.max(0, Math.min(page, (this.total.rois / this.roisPerpage) | 0));
            this.currentrois = this.rois.slice(
                (this.selected.page  ) * this.roisPerpage,
                (this.selected.page+1) * this.roisPerpage
            );
        }
        a2TrainingSetHistory.setLastPage(this.selected.page);
        return this.currentrois;
    };

    this.setROISet = function(rois){
        this.rois = rois;
        a2TrainingSetHistory.setLastRoiSet(this.rois);
    };

    this.nextROI = function(step) {
        return this.setROI(this.selected.roi_index + (step || 1));
    };

    this.prevROI = function (step) {
        return this.setROI(this.selected.roi_index - (step || 1));
    };

    this.nextPage = function(step) {
        return this.setPage(this.selected.page + (step || 1));
    };

    this.prevPage = function(step) {
        return this.setPage(this.selected.page - (step || 1));
    };

    this.next = function(step) {
        if(!step){step = 1;}
        if(this.detailedView) {
            this.nextROI(step);
        } else {
            this.nextPage(step);
        }
    };

    this.prev = function(step) {
        if(!step){step = 1;}
        return this.next(-step);
    };

    this.removeRoi = function(roiId) {
        if(!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to edit training sets');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            controller: function() {
                this.title = "Delete a ROI";
                this.messages = ["You are about to delete a ROI. Are you sure?"];
                this.btnOk = "Delete";
                this.btnCancel = "Cancel";
                this.isForDeletePopup = true;
            },
            controllerAs: 'popup',
            windowClass: 'modal-element width-490'
        });

        modalInstance.result.then((function() {
            a2TrainingSets.removeRoi(this.selected.trainingSet.id, roiId, (function(data){
                if(data.affectedRows) {
                    for(var i = 0 ; i < this.rois.length ; i++){
                        if (this.rois[i].id == roiId){
                            this.rois.splice(i,1);
                            break;
                        }
                    }

                    this.total.rois = this.rois.length;
                    this.setROI(this.selected.roi_index);
                    this.setPage(this.selected.page);
                }
            }).bind(this));
        }).bind(this));
    };

    this.closeSetDetails = function(){
       this.showSetDetails = false;
    };

    this.getTrainingSetList = function(){
        this.loading.list = true;
        return a2TrainingSets.getList((function(data){
            this.trainingSets = data.map(function(d) {
                d.date_created = new Date(d.date_created);
                return d;
            });
            if(p.set){
                var selected = this.trainingSets.filter(function(tset){
                    return tset.id == p.set;
                }).pop();
                if(selected){
                    this.selectTrainingSet(selected);
                }
            }
            this.loading.list = false;
        }.bind(this)));
    };

    this.addNewTrainingSet = function() {
        if(!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to create training sets');
            return;
        }

        $modal.open({
            templateUrl : '/app/visualizer/layers/training-data/add_tset_modal.html',
            controller  : 'a2VisualizerAddTrainingSetModalController',
            windowClass: 'modal-element'
        }).result.then(
            this.getTrainingSetList.bind(this)
        );
    };

    this.selectTrainingSet = function(selected) {
        $state.transitionTo($state.current.name, {set:selected.id, show:$state.params.show}, {notify:false});

        this.detailedView = $state.params.show != "gallery";
        this.loaderDisplay = true;
        a2TrainingSetHistory.setLastSet(selected);

        if(this.selected.trainingSet){
            if(this.selected.trainingSet.edit){
                delete this.selected.trainingSet.edit;
            }
        }

        this.selected.trainingSet = selected;

        Project.validationBySpeciesSong(selected.species, selected.songtype, (function(data) {
            this.selected.trainingSet.validations = data;
        }).bind(this));

        a2TrainingSets.getSpecies(selected.id, (function(speciesData) {
            this.species = speciesData.species;
            this.songtype = speciesData.songtype;

            a2TrainingSetHistory.setLastSpecies(this.species,this.songtype);

            a2TrainingSets.getRois(selected.id, (function(data) {
                this.loaderDisplay = false;
                this.detailedView = false;
                this.total.rois = data.length;
                this.total.pages = Math.ceil(this.total.rois/this.roisPerpage);
                this.setROISet(data);
                this.setROI(0);
                this.setPage(0);
                this.selected.page = 0;
            }).bind(this) );
        }).bind(this));
    };

    this.setupExportUrl = function() {
        this.selected.trainingSet.export_url = a2TrainingSets.getExportUrl(this.selected.trainingSet.id);
    };

    this.exportTSReport = function ($event) {
        $event.stopPropagation();
        if (a2UserPermit.isSuper()) return this.setupExportUrl();
        if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
            return notify.error('You do not have permission to export Training Set data');
        } else return this.setupExportUrl()
    };

    this.setDetailedView = function(detailedView){
        $state.transitionTo($state.current.name, {set:$state.params.set, show:detailedView?"detail":"gallery"}, {notify:false});
        this.detailedView = detailedView;
        a2TrainingSetHistory.setViewState(this.detailedView);
    };

    this.editSelectedTrainingSet = function(){
        if(!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to edit training sets');
            return;
        }

        if(this.selected.trainingSet){
            var trainingSet = this.selected.trainingSet;
            var speciesClass = {species:trainingSet.species, songtype:trainingSet.songtype};
            speciesClass.species_name = this.species;
            speciesClass.songtype_name = this.songtype;
            Project.getClasses().then(function(classes){
                var d = $q.defer();
                var current = classes.filter(function(cls){
                    return speciesClass.species == cls.species && speciesClass.songtype == cls.songtype;
                }).pop() || speciesClass;

                trainingSet.edit = {
                    name : trainingSet.name,
                    class : current,
                    projectClasses : classes
                };
                trainingSet.edit.cancel = d.reject.bind(d);
                trainingSet.edit.save = function(){
                    return a2TrainingSets.edit(trainingSet.id, {
                        name: trainingSet.edit.name,
                        class: trainingSet.edit.class.id
                    }).then(function(response){
                        d.resolve(response.data);
                    }, function(response){
                        notify.log(response.data);
                    });
                };

                return d.promise;
            }).then((function(editedTrainingSet){
                for(var i in editedTrainingSet){
                    trainingSet[i] = editedTrainingSet[i];
                }
                this.selectTrainingSet(trainingSet);
            }).bind(this)).finally(function(){
                delete trainingSet.edit;
            });
        }
    };

    this.deleteSelectedTrainingSet = function() {
        var trainingSet = this.selected.trainingSet;
        if(!trainingSet){
            return;
        }

        if(!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to edit training sets');
            return;
        }

        $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            controller: function() {
                this.title = "Delete training set";
                this.messages = ["You are about to delete a the training set \"" + trainingSet.name + "\". Are you sure?"];
                this.btnOk = "Delete";
                this.btnCancel = "Cancel";
                this.isForDeletePopup = true;
            },
            controllerAs: 'popup',
            windowClass: 'modal-element width-490'
        }).result.then((function() {
            a2TrainingSets.delete(trainingSet.id, (function(data){
                this.trainingSets.splice(this.trainingSets.indexOf(trainingSet), 1);
                delete this.selected.trainingSet;
            }).bind(this));
        }).bind(this));
    };

    this.getTrainingSetList();
    this.projecturl = Project.getUrl();

    a2TrainingSetHistory.getLastSet((function(data) {
        if(data.ls) {
            this.showSetDetails = true;
            this.selected.trainingSet = data.ls;
            this.species = data.sp;
            this.songtype = data.sg;
            this.detailedView = data.vs;
            this.total.rois = data.lrs.length;
            this.total.pages = Math.ceil(this.total.rois/this.roisPerpage);
            this.selected.page = data.lp;
            this.setROISet(data.lrs);
            this.setPage(data.lp);
            this.setROI(data.lr || 0);
        }
    }).bind(this));

})
;
