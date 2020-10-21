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
    $modal, $window, a2UserPermit,
    notify
) {

    $scope.verifyAndUpload = function() {
        if(!a2UserPermit.can('manage project recordings')) {
            notify.log("You do not have permission to upload recordings");
            return;
        }

        var index = 0;
        $scope.uploading = true;


        var _verifyAndUpload = function() {
            var item = $scope.uploader.queue[index];

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

            Project.recExists($scope.info.site.id, item.file.name.split('.')[0], function(exists) {

                if(exists) {
                    console.log('duplicated');
                    item.isDuplicate = true;
                    return next();
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
                item.onSuccess = next;
                item.onError = next;
            });
        };

        _verifyAndUpload();
    };

    AppListingsService.getFor('arbimon2-desktop-uploader').then((function(uploaderAppListing){
        this.uploaderAppListing = uploaderAppListing;
    }).bind(this));

    $scope.stopQueue = function() {
        $scope.uploading = false;
        angular.forEach($scope.uploader.queue, function(item) {
            item.cancel();
        });
    };

    $scope.batchInfo = function() {

        if(!a2UserPermit.can('manage project recordings')) {
            notify.log("You do not have permission to upload recordings");
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/audiodata/batch-info.html',
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
    var randomString = Math.round(Math.random() * 100000000)
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


    this.displayHelp = function() {
        $modal.open({
            templateUrl: '/app/audiodata/uploader-help.html',
            controller: 'UploaderHelpDisplayCtrl as controller',
            resolve: {
                uploaderAppListing: (function(){
                    return this.uploaderAppListing;
                }).bind(this)
            },
            size: 'lg'
        });
    };

    if($window.localStorage.getItem('data.uploads.help.viewed') === null) {
        this.displayHelp();

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
		{ name: "Arbimon", format: "(*-YYYY-MM-DD_HH-MM)" },
		{ name: "AudioMoth", format: "(YYYYMMDD_HHMMSS)" },
		{ name: "AudioMoth legacy", format: "(Unix Time code in Hex)" },
		{ name: "Cornell" , format: "(*_YYYYMMDD_HHMMSSZ)" },
		{ name: "Wildlife", format: "(YYYYMMDD_HHMMSS)" }
    ];

    Project.getSites(function(sites) {
        $scope.sites = sites;
    });

    $scope.projectUrl = Project.getUrl();

    $scope.close = function(){
        if($scope.uploadInfo.$valid && $scope.info.site) {
            return $modalInstance.close($scope.info);
        }
        else if(!$scope.info.site) {
            return notify.error('You need to create a site first');
        }

        notify.error('all fields are required');
    };
})
.controller('UploaderHelpDisplayCtrl', function(uploaderAppListing) {
    this.a="q";
    this.uploaderAppListing = uploaderAppListing;
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
