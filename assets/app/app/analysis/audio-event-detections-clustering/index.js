angular.module('a2.analysis.audio-event-detections-clustering', [
  'ui.bootstrap',
  'a2.srv.audio-event-detections-clustering',
  'a2.services',
  'a2.permissions',
  'humane',
  'a2.directive.error-message'
])
.config(function($stateProvider) {
    $stateProvider
        .state('analysis.audio-event-detections-clustering', {
            url: '/audio-event-detections-clustering?newJob',
            controller: 'AudioEventDetectionsClusteringModelCtrl',
            templateUrl: '/app/analysis/audio-event-detections-clustering/list.html'
        })
})
.controller('AudioEventDetectionsClusteringModelCtrl' , function($scope, $modal, $location, JobsData, notify, a2AudioEventDetectionsClustering, Project, $localStorage, $window, a2UserPermit, $state) {

    var p = $state.params;
    var isNewJob = p && p.newJob !== undefined;

    $scope.loadAudioEventDetections = function() {
        $scope.loading = true;
        $scope.showRefreshBtn = false;
        $scope.projectUrl = Project.getUrl();

        return a2AudioEventDetectionsClustering.list({
            user: true,
            dataExtended: true,
            completed: true,
            aedCount: true
        }).then(function(data) {
            $scope.audioEventDetectionsOriginal = data;
            $scope.audioEventDetectionsData = data;
            $scope.loading = false;
            if (data && data.length) {
                $scope.showRefreshBtn = true;
            }
        });
    };

    $scope.loadAudioEventDetections();

    $scope.onSelectedJob = function(playlist_id, job_id, first_playlist_recording) {
        $localStorage.setItem('analysis.audioEventJob',  job_id);
        $window.location.href = '/project/' + Project.getUrl() + '/visualizer/playlist/' + playlist_id + '/' + first_playlist_recording;
    }

    $scope.createNewClusteringModel = function () {
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.error('You do not have permission to create <br> Audio Event Detection job');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/audio-event-detections-clustering/new-audio-event-detection-clustering.html',
            controller: 'CreateNewAudioEventDetectionClusteringCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.create) {
                JobsData.updateJobs();
                $scope.showRefreshBtn = true
                notify.log("Your new Audio Event Detection Clustering model is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };

    if (isNewJob) {
        $scope.createNewClusteringModel()
    }

    $scope.deleteAedJob = function(aedJob, $event) {
        $event.stopPropagation();
        // Prevent delete job for the user/expert roles.
        if(!a2UserPermit.can('manage AED and Clustering job') || (a2UserPermit.can('manage AED and Clustering job') && !a2UserPermit.can('export report'))) {
            notify.error('You do not have permission to delete <br> Audio Event Detection job');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/audio-event-detections-clustering/delete-audio-event-detection-clustering-job.html',
            controller: 'DeleteAedJobCtrl as controller',
            resolve: {
                aedJob: function() {
                    return aedJob;
                },
            }
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error('Error: ' + ret.err);
            } else {
                const modArr = angular.copy($scope.audioEventDetectionsOriginal);
                const indx = modArr.findIndex(item => item.job_id === aedJob.job_id);
                if (indx > -1) {
                    $scope.audioEventDetectionsOriginal.splice(indx, 1);
                    notify.log('Audio Event Detection Job deleted successfully');
                }
            }
        });
    };
})

.controller('DeleteAedJobCtrl',
    function($scope, $modalInstance, a2AudioEventDetectionsClustering, aedJob) {
        this.aedJob = aedJob;
        $scope.deletingloader = false;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2AudioEventDetectionsClustering.delete(aedJob.job_id).then(function(data) {
                $modalInstance.close(data);
            });
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    }
)
.controller('CreateNewAudioEventDetectionClusteringCtrl', function($modalInstance, a2AudioEventDetectionsClustering, a2Playlists, a2UserPermit, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                playlists: false
            };

            this.details = { show: false }

            var list = this.list = {};

            this.data = {
                name: null,
                playlist: null,
                params: {
                    areaThreshold: 1,
                    amplitudeThreshold: 1,
                    durationThreshold: 0.2,
                    bandwidthThreshold: 0.5,
                    filterSize: 10,
                    minFrequency: 0,
                    maxFrequency: 24
                }
            };

            this.isRfcxUser = a2UserPermit.isRfcx();
            this.isSuper = a2UserPermit.isSuper();
            this.errorJobLimit = false;

            this.loading.playlists = true;
            a2Playlists.getList().then((function(playlists){
                this.loading.playlists = false;
                list.playlists = playlists;
            }).bind(this));
        },

        isRfcx: function () {
            return this.isRfcxUser || this.isSuper
        },

        checkLimit: function(count) {
            return count > 10000 && !this.isRfcx()
        },

        toggleDetails: function() {
            this.details.show = !this.details.show
        },

        newJob: function () {
            try {
                return a2AudioEventDetectionsClustering.create({
                    playlist_id: this.data.playlist.id,
                    name: this.data.name,
                    params: this.data.params
                }).then(function(clusteringModel) {
                    $modalInstance.close({ create: true, clusteringModel: clusteringModel })
                }).catch(notify.serverError);
            } catch(error) {
                console.error('a2AudioEventDetectionsClustering.create error: ' + error);
            }
        },

        create: function () {
            this.errorJobLimit = false
            if (this.isRfcx()) return this.newJob()
            return a2AudioEventDetectionsClustering.count().then(data => {
                if (this.checkLimit(data.totalRecordings)) {
                    this.errorJobLimit = true
                    return
                } else this.newJob()
            })
        },

        cancel: function (url) {
            $modalInstance.close({ cancel: true, url: url });
        },

        isJobValid: function () {
            return this.data && this.data.name && this.data.name.length > 3 && this.data.playlist &&
                !this.isNotDefined(this.data.params.maxFrequency) && !this.isNotDefined(this.data.params.minFrequency);
        },

        showNameWarning: function () {
            return this.data && this.data.name && this.data.name.length > 1 && this.data.name.length < 4
        },

        showPlaylistLimitWarning: function () {
            if (!this.data && !this.data.playlist) return
            return this.data && this.data.playlist && this.data.playlist.count > 2000 && !this.isRfcx()
        },

        showFrequencyWarning: function () {
            return this.data.params.maxFrequency <= this.data.params.minFrequency
        },

        isNotDefined: function (item) {
            return item === undefined || item === null
        }
    });
    this.initialize();
})
