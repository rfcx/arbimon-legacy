angular.module('audiodata.uploads', [
    'a2services', 
    'a2directives', 
    'ui.bootstrap', 
    'angularFileUpload',
    'humane'
])
.controller('UploadCtrl', function($scope, uploads, Project, $modal, $window) { 
    
    $scope.prettyBytes = function(bytes) {
        
        var labels = ['B', 'kB', 'MB', 'GB'];
        
        var newBytes;
        var p;
        
        for(p=1; bytes/Math.pow(1024, p) > 1; p++) {
            newBytes = bytes/Math.pow(1024, p);
        }
        
        newBytes = Math.round(newBytes*100)/100;
        
        return String(newBytes) + ' ' + labels[p-1];
    }; 
    
    $scope.verifyAndUpload = function() {
        
        angular.forEach($scope.uploader.queue, function(item) {
            
            Project.recExists($scope.info.site.id, item.file.name.split('.')[0], function(exists) {
                if(item.isSuccess) // file uploaded on current batch
                    return;
                
                if(exists) {
                    console.log('duplicated');
                    item.isDuplicate = true;
                    return;
                }
                
                item.formData.push({ 
                    info: JSON.stringify({
                        recorder: $scope.info.recorder,
                        mic: $scope.info.mic,
                        sver: $scope.info.sver
                    })
                });
                
                item.url = '/uploads/audio?project=' + $scope.project.project_id+
                            '&site=' + $scope.info.site.id +
                            '&nameformat=' + $scope.info.format.name;
                
                item.upload();
            });

        });

    };
      
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
    
    $scope.uploader = uploads.getUploader();
    $scope.info = uploads.getBatchInfo();
    
    
    Project.getInfo(function(info) {
        $scope.project = info;
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
    
    $scope.uploader.onErrorItem = function(item, response, status, headers) {
        if( status >= 500) {
            item.errorMsg = "Server Error";
            return;
        }
        item.errorMsg = response.error;
    };
    
    $scope.removeCompleted = function() {
        if(!$scope.uploader.queue.length) return;
        
        $scope.uploader.queue = $scope.uploader.queue.filter(function(file) {
            return !file.isSuccess;
        });
    };
    
    $scope.uploaded = 0;
    $scope.uploader.onProgressAll = function() {
        $scope.uploaded = Math.floor($scope.uploader.progress/100 * $scope.uploader.queue.length);
    };
    
    
    $scope.displayHelp = function() {
        $modal.open({
            templateUrl: '/partials/audiodata/uploader-help.html',
            size: 'lg'
        });
    };
    
    if($window.localStorage.getItem('data.uploads.help.viewed') === null) {
        $scope.displayHelp();
        $window.localStorage.setItem('data.uploads.help.viewed', true);
    }
    
    
})
.controller('BatchInfoCtrl', function($scope, Project, info, $modalInstance, notify) {
    
    if(info) {
        $scope.info = angular.copy(info);
    }
    else {
        $scope.info = {};
    }
    
    $scope.formats = [
        { name: "Arbimon", format: "(YYYY-MM-DD_HH-MM)" },
        { name: "Wildlife", format: "(YYYYMMDD_HHMMSS)" },
    ];
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
    });
    
    
    $scope.close = function(){
        if($scope.uploadInfo.$valid && $scope.info.site) {
            return $modalInstance.close($scope.info);
        }
        
        notify.error('all fields are required');
    };
})
.factory('uploads', function(FileUploader){
    
    var u = new FileUploader();
    
    var uploadInfo = null;

    window.addEventListener("beforeunload", function(e) {
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
});
