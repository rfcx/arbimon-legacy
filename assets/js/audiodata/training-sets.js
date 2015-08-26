angular.module('a2.audiodata.training-sets', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'visualizer-training-sets',
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
.controller('TrainingSetsCtrl', function($scope, a2TrainingSets, Project, $modal, a2TrainingSetHistory, a2UserPermit, notify) {
    
    $scope.nextROI = function() {
        $scope.currentRoi = $scope.currentRoi + 1;
        if ($scope.currentRoi >= $scope.totalRois) {
            $scope.currentRoi = $scope.currentRoi - 1;
        }
        else {
            $scope.roi = $scope.rois[$scope.currentRoi];
            $scope.currentDuration = $scope.roi.dur;
            $scope.currentlow = $scope.roi.y1;
            $scope.currenthigh = $scope.roi.y2;
            $scope.currentId = $scope.roi.id;
            $scope.currentUri = $scope.roi.uri;
            $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
        }
    };
    
    $scope.prevROI = function () {
        $scope.currentRoi = $scope.currentRoi- 1;
        if ($scope.currentRoi  < 0) {
            $scope.currentRoi = 0;
        }
        else {
            $scope.roi = $scope.rois[$scope.currentRoi];
            $scope.currentDuration = $scope.roi.dur;
            $scope.currentlow = $scope.roi.y1;
            $scope.currenthigh = $scope.roi.y2;
            $scope.currentId = $scope.roi.id;
            $scope.currentUri = $scope.roi.uri;
            $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
        }
    };
    
    $scope.nextPage = function() {
        $scope.currentPage = $scope.currentPage + 1;
        if ($scope.currentPage*$scope.roisPerpage >= $scope.totalRois) {
            $scope.currentPage= $scope.currentPage - 1;
        }
        else {
            $scope.currentrois = $scope.rois.slice( 
                ($scope.currentPage ) * $scope.roisPerpage, 
                ($scope.currentPage+1) * $scope.roisPerpage
            );
        }
    };
    
    $scope.prevPage = function() {
        $scope.currentPage = $scope.currentPage - 1;
        if ($scope.currentPage*$scope.roisPerpage  < 0) {
            $scope.currentPage = 0;
        }
        else {
            $scope.currentrois = $scope.rois.slice(
                ($scope.currentPage ) * $scope.roisPerpage, 
                ($scope.currentPage+1) * $scope.roisPerpage
            );
        }
    };
    
    $scope.next = function() {
        if($scope.detailedView) {
            $scope.nextROI();
        }
        else {
            $scope.nextPage();
        }
    };
    
    $scope.prev = function() {
        if($scope.detailedView) {
            $scope.prevROI();
        }
        else {
            $scope.prevPage();
        }
    };
    
    $scope.removeRoi = function(roiId) {
        if(!a2UserPermit.can('manage training sets')) {
            notify.log('You do not have permission to edit training sets');
            return;
        }
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            controller: function() {
                this.messages = [
                    "You are about to delete a ROI. Are you sure??"
                ];
                this.btnOk = "Yes, do it!";
                this.btnCancel = "No";
            },
            controllerAs: 'popup'
        });
        
        modalInstance.result.then(function() {
            a2TrainingSets.removeRoi($scope.selectedSet.id, roiId, function(data){
                if(data.affectedRows) {
                    for(var i = 0 ; i < $scope.rois.length ; i++)
                    {
                        if ($scope.rois[i].id == roiId){
                            $scope.rois.splice(i,1);
                            break;
                        }
                    }

                    if ($scope.currentRoi >= $scope.rois.length) {
                        $scope.currentRoi = $scope.rois.length -1;
                    }
                    $scope.totalRois = $scope.rois.length;
                    if ($scope.totalRois>0) {
                    
                        $scope.roi = $scope.rois[$scope.currentRoi];
                        $scope.currentDuration = $scope.roi.dur;
                        $scope.currentlow = $scope.roi.y1;
                        $scope.currenthigh = $scope.roi.y2;
                        $scope.currentId = $scope.roi.id;
                        $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
                        $scope.currentUri = $scope.roi.uri;
                        $scope.totalpages = Math.ceil( $scope.totalRois/$scope.roisPerpage);
                        if($scope.currentPage>($scope.totalpages-1)){
                            $scope.currentPage = $scope.totalpages-1;
                        }
                        $scope.currentrois =  $scope.rois.slice(
                            ($scope.currentPage ) * $scope.roisPerpage, 
                            ($scope.currentPage+1) * $scope.roisPerpage
                        );
                    }
                    else {
                        $scope.rois = [];
                        $scope.norois = true;
                    }
                }
            });
        });
    };
    
    $scope.closeSetDetails = function(){
       $scope.showSetDetails = false;
    };
    
    $scope.addNewTrainingSet = function() {
        if(!a2UserPermit.can('manage training sets')) {
            notify.log('You do not have permission to create training sets');
            return;
        }
        
        $modal.open({
            templateUrl : '/partials/visualizer/modal/add_tset.html',
            controller  : 'a2VisualizerAddTrainingSetModalController'
        }).result.then(function (new_tset) {
            a2TrainingSets.getList(function(data){
                $scope.sets = data.map(function(d) {
                    d.date_created = new Date(d.date_created);
                    return d;
                });
            });
        });
    };
    
    $scope.displaySetData = function(selected) {
        $scope.showSetDetails = true;
        $scope.norois = false;
        $scope.loaderDisplay = true;
        a2TrainingSetHistory.setLastSet(selected);
        
        $scope.selectedSet = selected;
        $scope.selectedName = selected.name;
        
        Project.validationBySpeciesSong(selected.species, selected.songtype, function(data) {
            $scope.selectedSet.validations = data;
        });
        
        a2TrainingSets.getSpecies(selected.id, function(speciesData) {
            $scope.species = speciesData.species;
            $scope.songtype = speciesData.songtype;
            
        
            a2TrainingSetHistory.setLastSpecies($scope.species,$scope.songtype);
        
            a2TrainingSets.getRois(selected.id, function(data) {
                $scope.loaderDisplay = false;
                $scope.detailedView = false;
                $scope.totalRois = data.length;
                $scope.currentPage = 0;
                $scope.totalpages = Math.ceil($scope.totalRois/$scope.roisPerpage);
                
                if($scope.totalRois > 0) {
                    $scope.roi = data[0];
                    $scope.currentDuration = $scope.roi.dur;
                    $scope.currentRoi = 0;
                    $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
                    $scope.currentUri = $scope.roi.uri;
                    $scope.currentlow = $scope.roi.y1;
                    $scope.currenthigh = $scope.roi.y2;
                    $scope.currentId = $scope.roi.id;
                    $scope.currentrois = data.slice(
                        ($scope.currentPage ) * $scope.roisPerpage, 
                        ($scope.currentPage+1) * $scope.roisPerpage
                    );
                    $scope.rois = data;
                } 
                else { 
                    $scope.rois = []; 
                    $scope.norois = true;
                }
            });
        });
    };
    
    $scope.loading = true;
    $scope.rois = [];
    $scope.selectedName = '';
    $scope.species = '';
    $scope.songtype = '';
    $scope.showSetDetails = false;
    $scope.roi = null;
    $scope.currentrois = [];
    $scope.currentPage = 0;
    $scope.roisPerpage = 12;
    $scope.currentRoi = 0;
    $scope.totalRois = 0;
    $scope.currentUri = '';
    $scope.totalpages = 0;
    $scope.detailedView = false;
    $scope.currentDuration = 0;
    $scope.currentlow = 0;
    $scope.currenthigh = 0;
    $scope.currentId = 0;
    $scope.currentUrl = '';
    $scope.norois = false;
    $scope.loaderDisplay = false;
    
    a2TrainingSets.getList(function(data){
        $scope.sets = data.map(function(d) {
            d.date_created = new Date(d.date_created);
            return d;
        });
        
        $scope.loading = false;
    });
    
    $scope.projecturl = Project.getUrl();
    
    a2TrainingSetHistory.getLastSet(function(data) {
        if(data.ls) {
            $scope.showSetDetails = true;
            $scope.selectedSet = data.ls;
            $scope.selectedName = $scope.selectedSet.name;
            $scope.species = data.sp;
            $scope.songtype = data.sg;
            $scope.detailedView = data.vs;
            $scope.totalRois = data.lrs.length;
            $scope.currentPage = data.lp;
            $scope.totalpages = Math.ceil($scope.totalRois/$scope.roisPerpage);
            
            if($scope.totalRois > 0) {
                if (data.lr === undefined){
                    data.lr = 0;
                }
                $scope.roi = data.lrs[data.lr];
                $scope.currentDuration = $scope.roi.dur;
                $scope.currentRoi = data.lr;
                $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
                $scope.currentUri = $scope.roi.uri;
                $scope.currentlow = $scope.roi.y1;
                $scope.currenthigh = $scope.roi.y2;
                $scope.currentId = $scope.roi.id;
                $scope.currentrois = data.lrs.slice(
                    ($scope.currentPage ) * $scope.roisPerpage, 
                    ($scope.currentPage+1) * $scope.roisPerpage
                );
                $scope.rois = data.lrs;
            } 
            else { 
                $scope.rois = []; 
                $scope.norois = true;
            }
        }
    });
    
    $scope.$watch('detailedView', function() {
        a2TrainingSetHistory.setViewState($scope.detailedView);
    });
     
    $scope.$watch('currentPage', function() {
        a2TrainingSetHistory.setLastPage($scope.currentPage);
    });
    
    $scope.$watch('currentRoi', function() {
        a2TrainingSetHistory.setLastRoi($scope.currentRoi);
    });
    
    $scope.$watch('rois', function() {
        a2TrainingSetHistory.setLastRoiSet($scope.rois);
    });
})
;
