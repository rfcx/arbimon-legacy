angular.module('a2.analysis.audio-event-detections-clustering', [
  'ui.bootstrap',
  'a2.srv.audio-event-detections-clustering',
  'a2.services',
  'a2.permissions',
  'humane',
])
.config(function($stateProvider) {
    $stateProvider
        .state('analysis.audio-event-detections-clustering', {
            url: '/audio-event-detections-clustering',
            controller: 'AudioEventDetectionsClusteringModelCtrl',
            templateUrl: '/app/analysis/audio-event-detections-clustering/list.html'
        })
})
.controller('AudioEventDetectionsClusteringModelCtrl' , function($scope, $modal, $location, JobsData, notify, a2AudioEventDetectionsClustering, Project, $localStorage, $window, a2UserPermit) {
    $scope.loadAudioEventDetections = function() {
        $scope.loading = true;
        $scope.projectUrl = Project.getUrl();

        return a2AudioEventDetectionsClustering.list({ user: true, dataExtended: true, completed: true }).then(function(data) {
            $scope.audioEventDetectionsOriginal = data;
            $scope.audioEventDetectionsData = data;
            $scope.loading = false;
            $scope.infopanedata = "";

            if(data && !data.length) {
                $scope.infopanedata = "No audio event detections found.";
            }
        });
    };

    $scope.loadAudioEventDetections();

    $scope.onSelectedJob = function(playlist_id, job_id) {
        $localStorage.setItem('analysis.audioEventJob',  job_id);
        $window.location.href = '/project/'+Project.getUrl()+'/visualizer/playlist/'+playlist_id;
    }

    $scope.createNewClusteringModel = function () {
        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/audio-event-detections-clustering/new-audio-event-detection-clustering.html',
            controller: 'CreateNewAudioEventDetectionClusteringCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.create) {
                JobsData.updateJobs();
                notify.log("Your new Audio Event Detection Clustering model is waiting to start processing.<br> Check it's status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };

    $scope.deleteAedJob = function(aedJob, $event) {
        $event.stopPropagation();
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.log('You do not have permission to delete Clustering job');
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
.controller('CreateNewAudioEventDetectionClusteringCtrl', function($modalInstance, a2AudioEventDetectionsClustering, a2Playlists, notify) {
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
                    bandwidthThreshold: 0.4,
                    filterSize: 10,
                    minFrequency: 0,
                    maxFrequency: 24
                }
            };

            this.loading.playlists = true;
            a2Playlists.getList({filterPlaylistLimit: true}).then((function(playlists){
                this.loading.playlists = false;
                list.playlists = playlists;
            }).bind(this));
        },

        toggleDetails: function() {
            this.details.show = !this.details.show
        },

        create: function () {
            if (this.data.params.maxFrequency <= this.data.params.minFrequency) {
                return notify.log('Note: The maximum frequency must be greater than the minimum frequency.');
            }
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

        cancel: function (url) {
            $modalInstance.close({ cancel: true, url: url });
        },

        isJobValid: function () {
            return this.data && this.data.name &&
                this.data.name.length > 3 &&
                this.data.playlist;
        }
    });
    this.initialize();
})
