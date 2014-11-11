angular.module('audiodata', ['a2services', 'a2directives', 'ui.bootstrap', 'angularFileUpload','visualizer-training-sets'])
.config(function($stateProvider, $urlRouterProvider) {
   
    $urlRouterProvider.when("/audiodata", "/audiodata/recordings");

    $stateProvider.state('audiodata.recordings', {
        url: '/recordings',
        controller: 'RecsCtrl',
        templateUrl: '/partials/audiodata/recordings.html'
    })
    .state('audiodata.uploads', {
        url: '/uploads',
        controller: 'UploadCtrl',
        templateUrl: '/partials/audiodata/upload.html'
    })
    .state('audiodata.trainingSets', {
        url: '/training-sets',
        controller: 'TrainingSetsCtrl',
        templateUrl: '/partials/audiodata/training-sets.html'
    });
})
.controller('RecsCtrl', function($scope, Project, $http) {
    $scope.loading = true;
    
    var searchRecs = function(count) {
        
        Project.getRecs({
            project_id: $scope.project.project_id,
            limit: $scope.limitPerPage,
            offset: ($scope.currentPage-1) * $scope.limitPerPage,
            sortBy: $scope.sortKey,
            sortRev: $scope.reverse,
            sites: $scope.params.sites ? $scope.params.sites.map(function(site){ return site.name; }) : undefined,
            count: count
        },
        function(data){
            if(!count) {
                $scope.recs = data;
            
                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            else {
                $scope.totalRecs = data[0].count;
            }
        });
    };
    
    $scope.params = {};
    $scope.sites = [];
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;
    
    
    Project.getSites(function(data){
        $scope.sites = data
    });
    
    // to do advance filters and playlist generation
    // $scope.hours = d3.range(24);
    
    $scope.fields = [
        { name: 'Site', key: 'site' },
        { name: 'Time', key: 'datetime' },
        { name: 'Recorder', key: 'recorder' },
        { name: 'Microphone', key: 'mic' },
        { name: 'Software ver', key: 'version' },
        { name: 'Filename', key: 'file' },
    ];
    
    Project.getInfo(function(data){
        $scope.project = data;
        searchRecs(true);
        
        $scope.$watch(function(scope) {
            return [
                $scope.currentPage,
                $scope.limitPerPage
            ];
        }, 
        function(){
            searchRecs();
        }, 
        true);

    });
    
    
    $scope.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        searchRecs();
    };
    
    $scope.applyFilters = function() {
        $scope.currentPage  = 1;
        searchRecs(true);
        searchRecs();
    };
    
    $scope.resetFilters = function() {
        $scope.currentPage  = 1;
        $scope.params = {};
        searchRecs(true);
        searchRecs();
    };
    
})
.controller('UploadCtrl', function($scope, uploads, Project, $modal){ 
    $scope.prettyBytes = function(bytes) {
        
        var labels = ['B', 'kB', 'MB', 'GB'];
        
        var newBytes;
        var p;
        
        for(p=1; bytes/Math.pow(1024, p) > 1; p++) {
            newBytes = bytes/Math.pow(1024, p);
        }        
        
        newBytes = Math.round(newBytes*100)/100;
        
        return String(newBytes) + ' ' + labels[--p];
    }; 
    
    
    $scope.verifyAndUpload = function() {
        $scope.uploader.queue.forEach(function(item) {
            
            Project.recExists($scope.info.site.id, item.file.name.split('.')[0], function(exists) {                
                if(item.isSuccess) // file uploaded on current batch
                    return;
                
                if(exists) {
                    console.log('duplicated');
                    return item.isDuplicate = true;
                }
                
                item.formData.push({ project: JSON.stringify($scope.project) });
                item.formData.push({ info: JSON.stringify($scope.info) });
                item.upload();
            });

        });

    };
      
    $scope.uploader = uploads.getUploader();
    $scope.info = uploads.getBatchInfo();
    
    
    $scope.batchInfo = function() {
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/batch-info.html',
            controller: 'BatchInfoCtrl',
            resolve: {
                info: function() {
                    return $scope.info;
                }
            }
        });
        
        modalInstance.result.then(function(newInfo) {
            uploads.setBatchInfo(newInfo);
            $scope.info = newInfo;
        });
    };
    
    
    Project.getInfo(function(info) {
        $scope.project = info;
        $scope.uploader.url = '/uploads/audio/project/' + info.project_id;
    });
    
    $scope.uploader.filters.push({
        name: 'supportedFormats',
        fn: function(item) {
            var name = item.name.split('.');
            var extension = name[name.length-1];
            
            //~ console.log('format', extension);
            var validFormats = /mp3|flac|wav/i;
            
            if(!validFormats.exec(extension))
                return false;
                
            return true;
        }
    });
    
    $scope.uploader.filters.push({
        name: 'notDuplicate',
        fn: function(item) {
            
            var duplicate = $scope.uploader.queue.filter(function(qItem) {
               return qItem.file.name === item.name; 
            });
                        
            return !duplicate.length;
        }
    });
})
.controller('BatchInfoCtrl', function($scope, Project, info, $modalInstance) {
    
    if(info) {
        $scope.info = angular.copy(info);
    }
    else {
        $scope.info = {};
        $scope.info.format = "Arbimon";
    }
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
    });
    
    
    $scope.close = function(){
        if($scope.uploadInfo.$valid) {
            $scope.info.site = $scope.sites[$scope.info.site];
            $modalInstance.close($scope.info);
        }
        
        $scope.error = true;
    };
})
.factory('uploads', function(FileUploader){
    var u = new FileUploader();
    
    var uploadInfo = null;

    window.addEventListener("beforeunload", function (e) {
        if(u.isUploading) {
            var confirmationMessage = "Upload is in progress, Are you sure to exit?";
        
            (e || window.event).returnValue = confirmationMessage;     //Gecko + IE
            return confirmationMessage;                                //Webkit, Safari, Chrome etc.
        }
    });

    
    return {        
        getUploader: function() {
            return u;
        },
        
        getBatchInfo: function() {
            return uploadInfo;
        },
        
        setBatchInfo: function(info) {
            uploadInfo = info;
        }
    };
})
.controller('TrainingSetsCtrl', function($scope, a2TrainingSets,Project,$modal) {
    $scope.fields = [
        { name: 'Name', key: 'name' },
        { name: 'Set type', key: 'type' },
        { name: 'Date created', key: 'date_created' },
    ];
    
    $scope.rois = []
    $scope.selectedName = ''
    $scope.species = ''
    $scope.songtype = ''
    a2TrainingSets.getList(function(data){
        $scope.sets = data.map(function(d) {
            d.date_created = new Date(d.date_created);
            return d;
        });
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
    $scope.toggleView = function ()
    {
        if ($scope.detailedView)
        {
            $scope.detailedView = false;
        }
        else
        {
            $scope.detailedView = true;
        }
    };
    
    $scope.next = function ()
    {
        $scope.currentRoi = $scope.currentRoi + 1;
        if ($scope.currentRoi >= $scope.totalRois) {
            $scope.currentRoi = $scope.currentRoi - 1;
        }
        else
        {
            $scope.roi = $scope.rois[$scope.currentRoi];
            $scope.currentDuration = $scope.roi.dur;
            $scope.currentlow = $scope.roi.y1;
            $scope.currenthigh = $scope.roi.y2;
            $scope.currentId = $scope.roi.id;
            $scope.currentUri = $scope.roi.uri;
        }
    };
    
    $scope.prev = function ()
    {
        $scope.currentRoi = $scope.currentRoi- 1;
        if ($scope.currentRoi  < 0) {
            $scope.currentRoi = 0;
        }
        else
        {
            $scope.roi = $scope.rois[$scope.currentRoi];
            $scope.currentDuration = $scope.roi.dur;
            $scope.currentlow = $scope.roi.y1;
            $scope.currenthigh = $scope.roi.y2;
            $scope.currentId = $scope.roi.id;
            $scope.currentUri = $scope.roi.uri;
        }
    };
    
    $scope.nextPage = function ()
    {
        $scope.currentPage = $scope.currentPage + 1;
        if ($scope.currentPage*$scope.roisPerpage >= $scope.totalRois) {
            $scope.currentPage= $scope.currentPage - 1;
        }
        else
        {
            $scope.currentrois = $scope.rois.slice(($scope.currentPage ) * $scope.roisPerpage, ($scope.currentPage+1) * $scope.roisPerpage)
        }
    };
    
    $scope.prevPage = function ()
    {
        $scope.currentPage = $scope.currentPage- 1;
        if ($scope.currentPage*$scope.roisPerpage  < 0) {
            $scope.currentPage = 0;
        }
        else
        {
            $scope.currentrois = $scope.rois.slice(($scope.currentPage ) * $scope.roisPerpage, ($scope.currentPage+1) * $scope.roisPerpage)
        }
    };
    
    $scope.removeRoi = function(id)
    {
        a2TrainingSets.removeRoi(id,$scope.selectedSet,function(data){
            if (data.affectedRows) 
            {
                for(var i = 0 ; i < $scope.rois.length ; i++)
                {
                    if ($scope.rois[i].id == id){
                        $scope.rois.splice(i,1)
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
                    $scope.currentUri = $scope.roi.uri;
                    $scope.totalpages = Math.ceil( $scope.totalRois/$scope.roisPerpage)
                    if($scope.currentPage>($scope.totalpages-1)){
                        $scope.currentPage = $scope.totalpages-1;
                    }
                    $scope.currentrois =  $scope.rois.slice(($scope.currentPage ) * $scope.roisPerpage, ($scope.currentPage+1) * $scope.roisPerpage)
                }else {$scope.rois = [];$scope.norois = true;}
            }
        });
    };
 
    Project.getInfo(function(info) {
        $scope.projecturl = info.url;
    });
 
 
    $scope.add_new_tset = function(){
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
    }
    
    $scope.displaySetData = function($index) {
        $scope.norois = false;
        $scope.selectedSet = $scope.sets[$index];
        $scope.selectedName = $scope.sets[$index].name;
        $scope.species  = null;
        $scope.songtype = null;
        $scope.detailedView    = undefined;
        $scope.totalRois       = undefined;
        $scope.currentPage     = undefined;
        $scope.totalpages      = undefined;
        $scope.roi             = undefined;
        $scope.currentDuration = undefined;
        $scope.currentRoi      = undefined;
        $scope.currentUrl      = undefined;
        $scope.currentUri      = undefined;
        $scope.currentlow      = undefined;
        $scope.currenthigh     = undefined;
        $scope.currentId       = undefined;
        $scope.currentrois     = undefined;
        $scope.rois            = undefined;
        a2TrainingSets.getSpecies($scope.sets[$index].name, function(speciesData){
            $scope.species = speciesData[0].species;
            $scope.songtype = speciesData[0].songtype
            a2TrainingSets.getRois($scope.sets[$index].name, function(data){
                $scope.detailedView = false;
                $scope.totalRois = data.length;
                $scope.currentPage = 0;
                $scope.totalpages = Math.ceil( $scope.totalRois/$scope.roisPerpage)
                if ($scope.totalRois>0) {
                    $scope.roi = data[0];
                    $scope.currentDuration = $scope.roi.dur;
                    $scope.currentRoi = 0;
                    $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/"+$scope.roi.recording;
                    $scope.currentUri = $scope.roi.uri;
                    $scope.currentlow = $scope.roi.y1;
                    $scope.currenthigh = $scope.roi.y2;
                    $scope.currentId = $scope.roi.id;
                    $scope.currentrois = data.slice(($scope.currentPage ) * $scope.roisPerpage, ($scope.currentPage+1) * $scope.roisPerpage)
                    $scope.rois = data;
                } else { 
                    $scope.rois = []; 
                    $scope.norois = true;
                }
            });
        });
    };
});

      
