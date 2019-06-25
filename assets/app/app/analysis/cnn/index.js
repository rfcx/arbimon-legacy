angular.module('a2.analysis.cnn', [
    'ui.bootstrap',
//    'a2.srv.patternmatching',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.cnn', {
        url: '/cnn/:cNN??show',
        controller: 'CNN',
        templateUrl: '/app/analysis/cnn/list.html'
    });
})
.controller('CNN' , function($scope, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, notify, $q, a2UserPermit, $state, $stateParams) {
    $scope.createNewCNN = function () {
        if(!a2UserPermit.can('manage pattern matchings')) {
            notify.log('You do not have permission to create pattern matchings');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/cnn/createnewcnn.html',
            controller: 'CreateNewCNNInstanceCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.ok) {
                JobsData.updateJobs();
                notify.log("Your new cnn is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };
})
.controller('CreateNewCNNInstanceCtrl', function($scope, $modalInstance, a2PatternMatching, a2Templates, a2Playlists, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                playlists: false,
                templates: false,
                createPatternMatching: false,
            };

            this.data = {
                name: null,
                playlist: null,
                template: null,
                params: { N: 100, threshold: 0.7 },
            };

            var list = this.list = {};

            this.loading.templates = true;
            a2Templates.getList().then((function(templates){
                this.loading.templates = false;
                list.templates = templates;
            }).bind(this));

            this.loading.playlists = true;
            a2Playlists.getList().then((function(playlists){
                this.loading.playlists = false;
                list.playlists = playlists;
            }).bind(this));
        },
        ok: function () {
            return a2PatternMatching.create({
                name: this.data.name,
                playlist: this.data.playlist.id,
                template: this.data.template.id,
                params: this.data.params,
            }).then(function(patternMatching) {
                $modalInstance.close({ok:true, patternMatching: patternMatching});
            }).catch(notify.serverError);
        },
        cancel: function (url) {
             $modalInstance.close({ cancel: true, url: url });
        },
    });
    this.initialize();

});