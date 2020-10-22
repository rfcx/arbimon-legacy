angular.module('a2.analysis.clustering-model', [
  'ui.bootstrap',
  'a2.srv.clustering-model',
  'a2.services',
  'a2.permissions',
  'humane',
])
.config(function($stateProvider) {
  $stateProvider.state('analysis.clustering-model', {
    url: '/clustering-model/',
    controller: 'ClusteringModelCtrl',
    templateUrl: '/app/analysis/clustering-model/list.html'
})
})
.controller('ClusteringModelCtrl' , function($scope, $modal, $filter, Project, JobsData, notify, $q, a2UserPermit, $state, $stateParams) {
    $scope.createNewClusteringModel = function () {
      var modalInstance = $modal.open({
          templateUrl: '/app/analysis/clustering-model/new-clustering-model.html',
          controller: 'CreateNewClusteringModelCtrl as controller',
      });

      modalInstance.result.then(function (result) {
          data = result;
          if (data.create) {
              JobsData.updateJobs();
              notify.log("Your new clustering model is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
          } else if (data.error) {
              notify.error("Error: "+data.error);
          } else if (data.url) {
              $location.path(data.url);
          }
      });
  };
})
.controller('CreateNewClusteringModelCtrl', function($scope, $modalInstance, a2ClusteringModel, a2Playlists, notify) {
  Object.assign(this, {
      initialize: function(){
          this.loading = {
              playlists: false
          };

          var list = this.list = {};

          this.data = {
              name: null,
              playlist: null,
              params: { },
          };

          this.loading.playlists = true;
          a2Playlists.getList().then((function(playlists){
              this.loading.playlists = false;
              list.playlists = playlists;
          }).bind(this));
      },
      create: function () {
          try {
              return a2ClusteringModel.create({
                  playlist_id: this.data.playlist.id,
                  name: this.data.name,
                  params: this.data.params
              }).then(function(clusteringModel) {
                  $modalInstance.close({create:true, clusteringModel: clusteringModel});
              }).catch(notify.serverError);
          } catch(error) {
              console.error("a2ClusteringModel.create error: " + error);
          }
      },
      cancel: function (url) {
           $modalInstance.close({ cancel: true, url: url });
      },
  });
  this.initialize();
})
