angular.module('a2.audiodata.training-sets', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.visualizer.layers.training-sets',
    'humane'
])
.config(function($stateProvider) {
    $stateProvider
        .state('audiodata.training-sets', {
            url: '/training-sets',
            controller: 'TrainingSetsCtrl',
            templateUrl: '/app/audiodata/training-sets.html',
        })
})
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
.controller('TrainingSetsCtrl', function($scope, $state, a2TrainingSets, Project, $q, $modal, a2TrainingSetHistory, a2UserPermit, notify, $window) {
    var p={
        set : $state.params.set,
        show : $state.params.show
    };

    $scope.selected = {roi_index:0, roi:null, page:0};
    $scope.total = {rois:0, pages:0};
    $scope.loading = { list:false, details:false };

    $scope.rois = [];
    $scope.species = '';
    $scope.songtype = '';
    $scope.detailedView = p.show != "gallery";
    $scope.currentrois = [];
    $scope.roisPerpage = 100;
    $scope.detailedView = false;
    $scope.loaderDisplay = false;

    $scope.getROIVisualizerUrl = function(roi){
        return roi ? "/project/"+$scope.projecturl+"/visualizer/rec/"+roi.recording : '';
    };

    $scope.setROI = function(roi_index){
        if($scope.total.rois <= 0){
            $scope.selected.roi_index = 0;
            $scope.selected.roi = null;
        } else {
            $scope.selected.roi_index = Math.max(0, Math.min(roi_index | 0, $scope.total.rois - 1));
            $scope.selected.roi = $scope.rois[$scope.selected.roi_index];
        }
        a2TrainingSetHistory.setLastRoi($scope.selected.roi);
        return $scope.selected.roi;
    };

    $scope.setPage = function(page){
        if($scope.total.rois <= 0){
            $scope.selected.page = 0;
            $scope.selected.currentrois = [];
        } else {
            $scope.selected.page = Math.max(0, Math.min(page, ($scope.total.rois / $scope.roisPerpage) | 0));
            $scope.currentrois = $scope.rois.slice(
                ($scope.selected.page  ) * $scope.roisPerpage,
                ($scope.selected.page+1) * $scope.roisPerpage
            );
        }
        a2TrainingSetHistory.setLastPage($scope.selected.page);
        return $scope.currentrois;
    };

    $scope.setROISet = function(rois){
        $scope.rois = rois;
        a2TrainingSetHistory.setLastRoiSet($scope.rois);
    };

    $scope.nextROI = function(step) {
        return $scope.setROI($scope.selected.roi_index + (step || 1));
    };

    $scope.prevROI = function (step) {
        return $scope.setROI($scope.selected.roi_index - (step || 1));
    };

    $scope.nextPage = function(step) {
        return $scope.setPage($scope.selected.page + (step || 1));
    };

    $scope.prevPage = function(step) {
        return $scope.setPage($scope.selected.page - (step || 1));
    };

    $scope.next = function(step) {
        if(!step){step = 1;}
        if($scope.detailedView) {
            $scope.nextROI(step);
        } else {
            $scope.nextPage(step);
        }
    };

    $scope.prev = function(step) {
        if(!step){step = 1;}
        return $scope.next(-step);
    };

    $scope.removeRoi = function(roiId) {
        if (!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to delete training sets');
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

    $scope.closeSetDetails = function(){
       $scope.showSetDetails = false;
    };

    $scope.isShareTsEnabled = function() {
        return a2UserPermit.getUserRole() === 'Expert' || a2UserPermit.getUserRole() === 'Admin' || a2UserPermit.getUserRole() === 'Owner';
    }

    $scope.shareTrainingSet = function() {
        if (!$scope.isShareTsEnabled()) {
            notify.error('You do not have permission to share training sets');
            return;
        }
        const trainingSetsData = $scope.trainingSets;
        const modalInstance = $modal.open({
            templateUrl: '/app/audiodata/training-sets-share-modal.html',
            controller: 'ShareTrainingSetInstanceCtrl',
            resolve: {
                trainingSets: function() {
                    return trainingSetsData;
                }
            },
            windowClass: 'modal-element'
        });

        modalInstance.result.then(
            function(res) {
                if (res.error) {
                    notify.error(res.error);
                }
                else notify.log(res.message);
            }
        );
    };

    $scope.combineTrainingSet = function() {
        if (!$scope.isShareTsEnabled()) {
            notify.error('You do not have permission to combine training sets');
            return;
        }
        const trainingSetsData = $scope.trainingSets;
        const modalInstance = $modal.open({
            templateUrl: '/app/audiodata/training-sets-combine-modal.html',
            controller: 'CombineTrainingSetInstanceCtrl',
            resolve: {
                trainingSets: function() {
                    return trainingSetsData;
                }
            },
            windowClass: 'modal-element width-490'
        });

        modalInstance.result.then(
            function(res) {
                if (res.error) {
                    notify.error(res.error);
                }
                else {
                    notify.log(res.message);
                    $scope.getTrainingSetList();
                }
            }
        );
    };

    $scope.getTrainingSetList = function() {
        $scope.loading.list = true;
        return a2TrainingSets.getList((function(data){
            $scope.trainingSets = data.map(function(d) {
                d.date_created = new Date(d.date_created);
                return d;
            });
            if(p.set){
                var selected = $scope.trainingSets.filter(function(tset){
                    return tset.id == p.set;
                }).pop();
                if(selected){
                    $scope.selectTrainingSet(selected);
                }
            }
            $scope.loading.list = false;
        }.bind(this)));
    };

    $scope.addNewTrainingSet = function() {
        if(!a2UserPermit.can('manage training sets')) {
            notify.error('You do not have permission to create training sets');
            return;
        }

        $modal.open({
            templateUrl : '/app/visualizer/layers/training-data/add_tset_modal.html',
            controller  : 'a2VisualizerAddTrainingSetModalController',
            windowClass: 'modal-element'
        }).result.then(
            $scope.getTrainingSetList()
        );
    };

    $scope.goToSourceProject = function(row) {
        if (!row.source_project_id) return;
        Project.getProjectById(row.source_project_id, function(data) {
            if (data) {
                $window.location.href = "/project/"+data.url+"/analysis/random-forest-models/models?tab=trainingSets";
            }
        });
    }

    $scope.selectTrainingSet = function(selected) {
        if($scope.selected.trainingSet == selected) {
            $scope.selected.trainingSet = undefined
            $scope.loaderDisplay = false;
            return
        }

        $state.transitionTo($state.current.name, {set:selected.id, show:$state.params.show}, {notify:false});

        $scope.detailedView = $state.params.show != "gallery";
        $scope.loaderDisplay = true;
        a2TrainingSetHistory.setLastSet(selected);

        if($scope.selected.trainingSet){
            if($scope.selected.trainingSet.edit){
                delete $scope.selected.trainingSet.edit;
            }
        }

        $scope.selected.trainingSet = selected;

        Project.validationBySpeciesSong(selected.species, selected.songtype, (function(data) {
            $scope.selected.trainingSet.validations = data;
        }).bind(this));

        a2TrainingSets.getSpecies(selected.id, (function(speciesData) {
            $scope.species = speciesData.species;
            $scope.songtype = speciesData.songtype;

            a2TrainingSetHistory.setLastSpecies($scope.species,$scope.songtype);

            a2TrainingSets.getRois(selected.id, (function(data) {
                $scope.loaderDisplay = false;
                $scope.detailedView = false;
                $scope.total.rois = data.length;
                $scope.total.pages = Math.ceil($scope.total.rois/$scope.roisPerpage);
                $scope.setROISet(data);
                $scope.setROI(0);
                $scope.setPage(0);
                $scope.selected.page = 0;
            }).bind(this) );
        }).bind(this));
    };

    $scope.isSelectedTsCombined = function() {
        if ($scope.selected && $scope.selected.trainingSet && $scope.selected.trainingSet.name !== undefined) {
            return $scope.selected.trainingSet.name.indexOf('union') !== -1;
        } else false
    }

    $scope.getCombinedTs1 = function() {
        return $scope.selected && $scope.selected.trainingSet && $scope.selected.trainingSet.name && $scope.selected.trainingSet.name.substring(0, $scope.selected.trainingSet.name.indexOf('union'));
    }

    $scope.getCombinedTs2 = function() {
        return $scope.selected && $scope.selected.trainingSet && $scope.selected.trainingSet.name && $scope.selected.trainingSet.name.split('union').pop();
    }

    $scope.setupExportUrl = function() {
        $scope.selected.trainingSet.export_url = a2TrainingSets.getExportUrl($scope.selected.trainingSet.id);
    };

    $scope.exportTSReport = function ($event) {
        $event.stopPropagation();
        if (a2UserPermit.isSuper()) return $scope.setupExportUrl();
        if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
            return notify.error('You do not have permission to export Training Set data');
        } else return $scope.setupExportUrl()
    };

    $scope.setDetailedView = function(detailedView){
        $state.transitionTo($state.current.name, {set:$state.params.set, show:detailedView?"detail":"gallery"}, {notify:false});
        $scope.detailedView = detailedView;
        a2TrainingSetHistory.setViewState($scope.detailedView);
    };

    $scope.editSelectedTrainingSet = function(){
        if (!a2UserPermit.can('manage training sets')) {
            return notify.error('You do not have permission to edit training sets');
        }

        if($scope.selected.trainingSet){
            var trainingSet = $scope.selected.trainingSet;
            var speciesClass = {species:trainingSet.species, songtype:trainingSet.songtype};
            speciesClass.species_name = $scope.species;
            speciesClass.songtype_name = $scope.songtype;
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
                $scope.selectTrainingSet(trainingSet);
            }).bind(this)).finally(function(){
                delete trainingSet.edit;
            });
        }
    };

    $scope.deleteSelectedTrainingSet = function() {
        var trainingSet = $scope.selected.trainingSet;
        if (!trainingSet) {
            return;
        }

        if (!a2UserPermit.can('manage training sets')) {
            return notify.error('You do not have permission to delete training set.');
        }

        const modalInstance = $modal.open({
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
        })
        modalInstance.result.then(function() {
            return a2TrainingSets.delete(trainingSet.id).then(function(res) {
                delete $scope.selected.trainingSet;
                if (res.error) {
                    notify.error('Error removing training set.');
                }
                else notify.log(res.data.message);
                $scope.getTrainingSetList();
            });
        });
    };

    $scope.getTrainingSetList();
    $scope.projecturl = Project.getUrl();

    a2TrainingSetHistory.getLastSet((function(data) {
        if(data.ls) {
            $scope.showSetDetails = true;
            $scope.selected.trainingSet = data.ls;
            $scope.species = data.sp;
            $scope.songtype = data.sg;
            $scope.detailedView = data.vs;
            $scope.total.rois = data.lrs.length;
            $scope.total.pages = Math.ceil($scope.total.rois/$scope.roisPerpage);
            $scope.selected.page = data.lp;
            $scope.setROISet(data.lrs);
            $scope.setPage(data.lp);
            $scope.setROI(data.lr || 0);
        }
    }).bind(this));

    $scope.getSharedTrainingSet = function(trainingSetId) {
        return a2TrainingSets.getSharedTrainingSet(trainingSetId)
            .success(function(data) {
                $scope.sharedTrainingSet = data;
            })
            .error(function(data, status) {
                notify.serverError();
            });
    }


    $scope.openSharingHistory = function() {
        if (!$scope.isShareTsEnabled()) {
            notify.error('You do not have permission to share training sets');
            return;
        }
        if (!$scope.selected && !$scope.selected.trainingSet && !$scope.selected.trainingSet.id) {
            return false
        }

        $scope.getSharedTrainingSet($scope.selected.trainingSet.id).then(function() {
            const  sharedTrainingSet = $scope.sharedTrainingSet;
            const modalInstance = $modal.open({
                templateUrl: '/app/audiodata/training-sets-unshare-modal.html',
                controller: 'UnshareTrainingSetInstanceCtrl',
                resolve: {
                    trainingSets: function() {
                        return sharedTrainingSet;
                    }
                },
                windowClass: 'modal-element width-700'
            });

            modalInstance.result.then(
                function(res) {
                    if (res.error) {
                        notify.error(res.error);
                    }
                    else notify.log(res.message);
                }
            );
        });
    };

})

.controller('UnshareTrainingSetInstanceCtrl', function($scope, $modalInstance, a2TrainingSets, trainingSets) {
    $scope.sharedTrainingSet = trainingSets;
    $scope.isUnshareTrainingSet = false;
    $scope.unshareTrainingSet = function(trainingSet) {
        $scope.isUnshareTrainingSet = true;
        a2TrainingSets.unshareTrainingSet(trainingSet.trainingSetId)
            .success(function(data) {
                $scope.isUnshareTrainingSet = false;
                $modalInstance.close(data);
            })
            .error(function(err) {
                $scope.isUnshareTrainingSet = false;
                $modalInstance.close(err);
            });
    };

    $scope.cancel = function() {
        $scope.isUnshareTrainingSet = false;
        $modalInstance.dismiss('cancel');
    };

})

.controller('ShareTrainingSetInstanceCtrl', function($scope, $modalInstance, a2TrainingSets, trainingSets, Project) {
    $scope.trainingSets = trainingSets.filter(ts => !ts.source_project_id);
    $scope.isShareTrainingSet = false;
    $scope.selectedData = { project: {}, trainingSet: {} };
    $scope.isTrainingSetEmpty = false;
    $scope.isProjectEmpty = false;
    Project.getProjectsToShareModel(function(data) {
        $scope.projects = data;
    });

    $scope.ok = function() {
        $scope.isTrainingSetEmpty = !$scope.selectedData.trainingSet.id;
        $scope.isProjectEmpty = !$scope.selectedData.project.project_id;
        if ($scope.isTrainingSetEmpty || $scope.isProjectEmpty) return;
        $scope.isShareTrainingSet = true;
        a2TrainingSets.shareTrainingSet({
                trainingSetId: $scope.selectedData.trainingSet.id,
                projectIdTo: $scope.selectedData.project.project_id,
                species: $scope.selectedData.trainingSet.species,
                songtype: $scope.selectedData.trainingSet.songtype,
                trainingSetName: $scope.selectedData.trainingSet.name
            })
            .success(function(data) {
                $scope.isShareTrainingSet = false;
                $scope.isTrainingSetEmpty = false;
                $scope.isProjectEmpty = false;
                $modalInstance.close(data);
            })
            .error(function(err) {
                $scope.isShareTrainingSet = false;
                $scope.isTrainingSetEmpty = false;
                $scope.isProjectEmpty = false;
                $modalInstance.close(err);
            });
    };

    $scope.cancel = function() {
        $scope.isShareTrainingSet = false;
        $modalInstance.dismiss('cancel');
    };

})

.controller('CombineTrainingSetInstanceCtrl', function($scope, $modalInstance, a2TrainingSets, trainingSets) {
    $scope.originalTrainingSets = trainingSets.filter(ts => !ts.source_project_id && !ts.name.includes('union'));
    $scope.trainingSets1 = $scope.trainingSets2 = $scope.originalTrainingSets;
    $scope.isCombineTrainingSet = false;
    $scope.selectedData = { trainingSet1: {}, trainingSet2: {}, trainingSetName: '' };
    $scope.isTrainingSet1Empty = false;
    $scope.isTrainingSet2Empty = false;

    $scope.ok = function() {
        $scope.resetFormStatus();
        $scope.isTrainingSet1Empty = !$scope.selectedData.trainingSet1.id;
        $scope.isTrainingSet2Empty = !$scope.selectedData.trainingSet2.id;
        if ($scope.isTrainingSet1Empty || $scope.isTrainingSet2Empty) return;
        if (!$scope.selectedData.trainingSetName.length) {
            $scope.updateNamePlaceholder();
        }
        $scope.isCombineTrainingSet = true;
        a2TrainingSets.combineTrainingSet({
            term1: $scope.selectedData.trainingSet1.id,
            term2: $scope.selectedData.trainingSet2.id,
            species: $scope.selectedData.trainingSet1.species,
            songtype: $scope.selectedData.trainingSet1.songtype,
            name: $scope.selectedData.trainingSetName
        })
            .success(function(data) {
                $scope.resetFormStatus();
                $modalInstance.close(data);
            })
            .error(function(err) {
                $scope.resetFormStatus();
                $scope.isProjectEmpty = false;
                $modalInstance.close(err);
            });
    };

    $scope.cancel = function() {
        $scope.isShareTrainingSet = false;
        $modalInstance.dismiss('cancel');
    };

    $scope.resetFormStatus = function() {
        $scope.isCombineTrainingSet = false;
        $scope.isTrainingSet1Empty = false;
        $scope.isTrainingSet2Empty = false;
    }

    $scope.isCombinedTrainingSetsMismatch = function () {
        if ($scope.selectedData.trainingSet2.id) {
            return !(($scope.selectedData.trainingSet1.species === $scope.selectedData.trainingSet2.species) && ($scope.selectedData.trainingSet1.songtype === $scope.selectedData.trainingSet2.songtype));
        }
        return false
    }

    $scope.updateNamePlaceholder = function() {
        const term1 = $scope.selectedData.trainingSet1.name || 'Training Set 1';
        const term2 = $scope.selectedData.trainingSet2.name  || 'Training Set 2';
        $scope.selectedData.trainingSetName = term1 + ' union ' + term2;
    };

    $scope.filterTrainingSetData = function() {
        $scope.trainingSets2 = $scope.originalTrainingSets.filter(ts => (ts.id !== $scope.selectedData.trainingSet1.id));
    }

})
;
