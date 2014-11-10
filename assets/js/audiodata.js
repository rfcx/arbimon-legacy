angular.module('audiodata', ['a2services', 'a2directives', 'ui.bootstrap', 'angularFileUpload'])
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
.controller('RecsCtrl', function($scope, Project, $http, $modal) {
    $scope.loading = true;
    
    var searchRecs = function(output) {
        
        var params = {
            project_id: $scope.project.project_id,
            limit: $scope.limitPerPage,
            offset: ($scope.currentPage-1) * $scope.limitPerPage,
            sortBy: $scope.sortKey,
            sortRev: $scope.reverse,
            output: output
        };
        
        if($scope.params.range && $scope.params.range.from && $scope.params.range.to) {
            params.range = $scope.params.range;
            
            params.range.to.setHours(23);
            params.range.to.setMinutes(59);
        };
        
        if($scope.params.sites)
            params.sites = $scope.params.sites.map(function(site){ return site.name; });
        
        if($scope.params.hours) 
            params.hours = $scope.params.hours.map(function(h) { return h.value; });
        
        if($scope.params.months)
            params.months = $scope.params.months.map(function(m) { return m.value; });
        
        if($scope.params.years)
            params.years = $scope.params.years;
            
        if($scope.params.days)
            params.days = $scope.params.days;
            
            
        Project.getRecs(params, function(data) {
            if(!output || output === 'list') {
                $scope.recs = data;
            
                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            else if(output === 'count'){
                $scope.totalRecs = data[0].count;
            }
            else if(output === 'date_range') {
                $scope.minDate = new Date(data[0].min_date);
                $scope.maxDate = new Date(data[0].max_date);
                $scope.years = d3.range($scope.minDate.getFullYear(), ($scope.maxDate.getFullYear() + 1) );
            }
        });
    };
    
    $scope.params = {};
    $scope.sites = [];
    $scope.years = [];
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;
    $scope.days = d3.range(1,32);
    $scope.months =  d3.range(12).map(function(month) {
        return { value: month, string: moment().month(month).format('MMM') };
    });
    $scope.hours = d3.range(24).map(function(hour) {
        return { value: hour, string: moment().hour(hour).minute(0).format('HH:mm') };
    });
    
    Project.getSites(function(data){
        $scope.sites = data;
    });
    
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
        searchRecs('count');
        
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

        searchRecs('date_range');
    });
    
    
    $scope.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        searchRecs();
    };
    $scope.applyFilters = function() {
        $scope.currentPage  = 1;
        searchRecs('count');
        searchRecs();
    };
    $scope.resetFilters = function() {
        $scope.currentPage  = 1;
        $scope.params = {};
        searchRecs('count');
        searchRecs();
    };
    // $scope.edit = function() {
    //     if(!$scope.checked || !$scope.checked.length)
    //         return;
    //         
    //     // var recorders = $scope.checked.map(function(rec) {
    //     //     return rec.recorders
    //     // })
    //     
    //     
    //     
    //     var modalInstance = $modal.open({
    //         templateUrl: '/partials/audiodata/edit-recs.html',
    //         controller: 'RecsEditorCtrl',
    //         size: 'lg',
    //         resolve: {
    //             data: function() {
    //                 return data;
    //             }
    //         }
    //     });
    // }
})
.controller('RecsEditorCtrl', function($scope, Project, $modalInstance, recs) {
    $scope.recs = recs;
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
.controller('TrainingSetsCtrl', function($scope, a2TrainingSets) {
    $scope.fields = [
        { name: 'Name', key: 'name' },
        { name: 'Set type', key: 'type' },
        { name: 'Date created', key: 'date_created' },
    ];
    
    a2TrainingSets.getList(function(data){
        $scope.sets = data.map(function(d) {
            d.date_created = new Date(d.date_created);
            return d;
        });
    });
    
    $scope.displaySet = function($index) {
        
    };
})
.directive('dataTrainingSet', function($compile) {
    return {
        restrict: 'E',
        
    }
})
;
      
