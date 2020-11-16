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
            url: '/audio-event-detections-clustering/',
            controller: 'AudioEventDetectionsClusteringModelCtrl',
            templateUrl: '/app/analysis/audio-event-detections-clustering/list.html'
        })
})
.controller('AudioEventDetectionsClusteringModelCtrl' , function($scope, $modal, $location, JobsData, notify, a2AudioEventDetectionsClustering, Project) {
    $scope.loadAudioEventDetections = function() {
        $scope.loading = true;
        $scope.projectUrl = Project.getUrl();

        return a2AudioEventDetectionsClustering.list().then(function(data) {
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

    $scope.createNewClusteringModel = function () {
      var modalInstance = $modal.open({
          templateUrl: '/app/analysis/audio-event-detections-clustering/new-audio-event-detection-clustering.html',
          controller: 'CreateNewAudioEventDetectionClusteringCtrl as controller',
      });

      modalInstance.result.then(function (result) {
          data = result;
          if (data.create) {
              JobsData.updateJobs();
              notify.log("Your new audio event detection clustering model is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
          } else if (data.error) {
              notify.error("Error: "+data.error);
          } else if (data.url) {
              $location.path(data.url);
          }
      });
  };
})
.controller('CreateNewAudioEventDetectionClusteringCtrl', function($modalInstance, a2AudioEventDetectionsClustering, a2Playlists, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                playlists: false
            };

            var list = this.list = {};

            this.data = {
                name: null,
                playlist: null,
                params: {
                    amplitudeThreshold: 1,
                    sizeThreshold: 0.2,
                    filterSize: 10
                }
            };

            this.loading.playlists = true;
            a2Playlists.getList().then((function(playlists){
                this.loading.playlists = false;
                list.playlists = playlists;
            }).bind(this));
        },
        create: function () {
            try {
                return a2AudioEventDetectionsClustering.create({
                    playlist_id: this.data.playlist.id,
                    name: this.data.name,
                    params: this.data.params
                }).then(function(clusteringModel) {
                    $modalInstance.close({create:true, clusteringModel: clusteringModel});
                }).catch(notify.serverError);
            } catch(error) {
                console.error("a2AudioEventDetectionsClustering.create error: " + error);
            }
        },
        cancel: function (url) {
            $modalInstance.close({ cancel: true, url: url });
        },
        isJobValid: function () {
            return this.data && this.data.name && this.data.name.length > 3 && this.data.playlist;
        }
    });
    this.initialize();
})
