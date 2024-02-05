angular.module('a2.audiodata.uploads.upload', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'angularFileUpload',
    'a2.srv.app-listings',
    'a2.filter.caps',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('audiodata.uploads.upload', {
        url: '/',
        controller: 'A2AudioDataUploadsUploadCtrl as controller',
        templateUrl: '/app/audiodata/uploads/upload.html'
    });
})
.filter('prettyBytes', function(){
    return function(bytes) {

        var labels = ['B', 'kB', 'MB', 'GB'];

        var newBytes;
        var p;

        for(p=1; bytes/Math.pow(1024, p) > 1; p++) {
            newBytes = bytes/Math.pow(1024, p);
        }

        newBytes = Math.round(newBytes*100)/100;

        return String(newBytes) + ' ' + labels[p-1];
    };
})
.controller('A2AudioDataUploadsUploadCtrl', function(
    $scope,
    uploads, Project,
    AppListingsService,
    a2UserPermit,
    notify,
    $interval,
    a2UploadsService
) {

    $scope.verifyAndUpload = function() {
        if(!a2UserPermit.can('manage project recordings')) {
            notify.error("You do not have permission to upload recordings");
            return;
        }

        var index = 0;
        $scope.uploading = true;

        var _verifyAndUpload = function() {

            var item = $scope.uploader.queue[index];

            if (item && item.file && !item.file.size) {
                item.isError = true
                item.errorMsg = "Error of the file size"
                return
            }

            var next = function() {
                index++;
                _verifyAndUpload();
            };

            if(!item || !$scope.uploading){
                $scope.uploading = false;
                return;
            }

            if(item.isSuccess) // file uploaded on current batch
                return next();

            Project.recExists($scope.info.site.id, item.file.name, function(exists) {
                if(exists) {
                    console.log('duplicated');
                    item.isDuplicate = true;
                    return next();
                }

                item.url = '/legacy-api/uploads/audio?project=' + $scope.project.project_id+
                            '&site=' + $scope.info.site.id +
                            '&nameformat=' + $scope.info.format.name +
                            '&timezone=' + $scope.info.timezone.format;
                item.upload();
                item.onSuccess = next;
                item.onError = next;
            });
        };

        _verifyAndUpload();
    };

    $scope.isCheckingStatus = false

    $scope.queueJobToCheckStatus = function() {
        if ($scope.isCheckingStatus) return
        $scope.isCheckingStatus = true
        a2UploadsService.getProcessingList({site: $scope.info.site.id}).then(function (files) {
            const uploadingFiles = $scope.getUploadingFiles()
            if (!uploadingFiles.length) {
                $scope.cancelTimer()
                $scope.isCheckingStatus = false
                return
            }
            const userFiles = uploadingFiles.map(fileObj => { return fileObj.file.name })
            if (files && files.length) {
                const filesToCheck = files.filter(file => { return userFiles.includes(file.name) })
                const items = filesToCheck.slice(0, 5).map(item => {
                    return {
                        uploadUrl: item.uploadUrl,
                        uploadId: item.id,
                        filename: item.name
                    }
                })
                a2UploadsService.checkStatus({ items: items }).then(function (data) {
                    if (data) {
                        data.forEach(item => {
                            const userFile = uploadingFiles.find(fileObj => { return fileObj.file.name === item.filename })
                            if (userFile && item.status === 'uploaded') {
                                $scope.makeSuccessItem(userFile)
                            }
                        })
                        $scope.isCheckingStatus = false
                    }
                })
            }
        })
    }

    $scope.getUploadingFiles = function() {
        const uploadingFiles = $scope.uploader.queue.filter(function(file) {
            return file.isSuccess === true && file.isUploaded === false;
        });
        return uploadingFiles && uploadingFiles.length ? uploadingFiles : []
    }

    $scope.checkUploadingFiles = function() {
        if ($scope.getUploadingFiles().length) {
            $scope.startTimer()
        }
    }

    $scope.startTimer = function() {
        $scope.cancelTimer()
        $scope.checkStatusInterval = $interval(function() {
            $scope.queueJobToCheckStatus()
        }, 10000)
    }

    $scope.cancelTimer = function() {
        if ($scope.checkStatusInterval) {
            $interval.cancel($scope.checkStatusInterval);
        }
    }

    $scope.$on('$destroy', function() {
        $scope.cancelTimer()
    });

    AppListingsService.getFor('arbimon2-desktop-uploader').then((function(uploaderAppListing){
        this.uploaderAppListing = uploaderAppListing;
    }).bind(this));

    $scope.stopQueue = function() {
        $scope.uploading = false;
        angular.forEach($scope.uploader.queue, function(item) {
            item.cancel();
        });
    };

    $scope.uploader = uploads.getUploader();

    $scope.info = {}

    $scope.formats = [
        { name: "Arbimon", format: "(*-YYYY-MM-DD_HH-MM)" },
        { name: "AudioMoth", format: "(*YYYYMMDD_HHMMSS)" },
        { name: "AudioMoth legacy", format: "(Unix Time code in Hex)" },
        { name: "Cornell" , format: "(*_YYYYMMDD_HHMMSSZ)" },
        { name: "Song Meter", format: "(*_YYYYMMDD_HHMMSS)" },
        { name: "Wildlife", format: "(YYYYMMDD_HHMMSS)" }
    ];

    $scope.fileTimezone = [
        { name: "UTC", format: "utc" },
        { name: "Site timezone", format: "local" }
    ];

    Project.getSites({ utcDiff: true }, function(sites) {
        $scope.sites = sites.sort(function(a, b) { return new Date(b.updated_at) - new Date(a.updated_at)});
    });

    $scope.selectSite = function() {
        const local = $scope.info && $scope.info.site && $scope.info.site.utcOffset ? $scope.info.site.utcOffset + ' (local)' : 'Site timezone'
        $scope.fileTimezone[1].name = local
        $scope.info.timezone = $scope.fileTimezone[1]
    }

    $scope.isStartUploadDisabled = function() {
        return !$scope.uploader.queue.length || $scope.isLimitExceeded() || !$scope.info.site || !$scope.info.format || $scope.uploading
    }

    $scope.isLimitExceeded = function() {
        return $scope.uploader.queue.length > 1000
    }

    const randomString = Math.round(Math.random() * 100000000)

    this.uploaderApps = {
        mac: 'https://rf.cx/ingest-app-latest-mac?r=' + randomString,
        windows: 'https://rf.cx/ingest-app-latest-win?r=' + randomString,
    };

    Project.getInfo(function(info) {
        $scope.project = info;
    });

    $scope.uploader.filters.push({
        name: 'supportedFormats',
        fn: function(item) {
            var name = item.name.split('.');
            var extension = name[name.length-1].toLowerCase();

            var validFormats = /mp3|flac|wav|opus/i;

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
        if(response.error) {
            item.errorMsg = response.error;
        }
        else if( status >= 500) {
            item.errorMsg = "Server error";
            return;
        }
        else {
            item.errorMsg = "An error ocurred";
        }
    };

    $scope.uploader.onSuccessItem = function(item, response, status, headers) {
        item.isUploaded = false
        console.info('count of uploading files', $scope.getUploadingFiles().length)
        $scope.checkUploadingFiles()
    };

    $scope.makeSuccessItem = function(item) {
        item.status = 'uploaded'
        item.isUploading = false
        item.isSuccess = false
        item.isUploaded = true
        item.progress = 100
    }

    $scope.getProgress = function(item) {
        if ( item.isUploading && item.progress === 100) return 90
        else if ( item.isSuccess && !item.isUploaded) return 90
        else return item.progress
    }

    $scope.removeCompleted = function() {
        if(!$scope.uploader.queue.length) return;

        $scope.uploader.queue = $scope.uploader.queue.filter(function(file) {
            return !file.isSuccess;
        });
    };

    $scope.getCountOfUploaded = function() {
        if (!$scope.uploader || !$scope.uploader.queue || !$scope.uploader.queue.length) return 0;

        $scope.uploaded = $scope.uploader.queue.filter(function(file) {
            return !!file.isUploaded && !file.isError;
        }).length
        return $scope.uploaded
    };

    $scope.clearQueue = function() {
        $scope.uploader.progress = 0;
        $scope.uploaded = 0
    };

    $scope.uploaded = 0;
    $scope.uploader.onProgressAll = function() {};

})

.factory('uploads', function(FileUploader){

    var u = new FileUploader();

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
        }
    };
});
