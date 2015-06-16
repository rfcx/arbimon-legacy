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
    
    $scope.loading = true;
    $scope.rois = [];
    $scope.selectedName = '';
    $scope.species = '';
    $scope.songtype = '';
    $scope.showSetDetails = false;
    a2TrainingSets.getList(function(data){
        $scope.sets = data.map(function(d) {
            d.date_created = new Date(d.date_created);
            return d;
        });
        $scope.loading = false;
    });
    
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
    
    $scope.toggleView = function() {
        if($scope.detailedView) {
            $scope.detailedView = false;
        }
        else {
            $scope.detailedView = true;
        }
    };
    
    $scope.next = function() {
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
    
    $scope.prev = function () {
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
        $scope.currentPage = $scope.currentPage- 1;
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
    
    $scope.removeRoi = function(id) {
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
            a2TrainingSets.removeRoi(id, $scope.selectedSet.id, function(data){
                if(data.affectedRows) {
                    for(var i = 0 ; i < $scope.rois.length ; i++)
                    {
                        if ($scope.rois[i].id == id){
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
 
    Project.getInfo(function(info) {
        $scope.projecturl = info.url;
    });
 
    $scope.closeSetDetails = function(){
       $scope.showSetDetails = false;
    };
    
    $scope.add_new_tset = function() {
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
    
    $scope.loaderDisplay = false;

    $scope.displaySetData = function($object) {
        var setId = $object.id;
        var i = 0;
        while(i < $scope.sets.length)
        {
            if ($scope.sets[i].id == setId )
            {
               break;
            }else i++;   
        }
        var setIndex = i;
        $scope.showSetDetails = true;
        $scope.norois = false;
        $scope.loaderDisplay = true;
        a2TrainingSetHistory.setLastSet($scope.sets[setIndex]);
        $scope.selectedSet = $scope.sets[setIndex];
        $scope.selectedName = $scope.sets[setIndex].name;
        
        a2TrainingSets.getSpecies($scope.sets[setIndex].id, function(speciesData) {
            $scope.species = speciesData[0].species;
            $scope.songtype = speciesData[0].songtype;
        
            a2TrainingSetHistory.setLastSpecies($scope.species,$scope.songtype);
        
            a2TrainingSets.getRois($scope.sets[setIndex].id, function(data) {
                $scope.loaderDisplay = false;
                $scope.detailedView = false;
                $scope.totalRois = data.length;
                $scope.currentPage = 0;
                $scope.totalpages = Math.ceil($scope.totalRois/$scope.roisPerpage);
                
                if ($scope.totalRois>0) {
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
})
;
