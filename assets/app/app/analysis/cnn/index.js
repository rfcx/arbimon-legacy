angular.module('a2.analysis.cnn', [
    'ui.bootstrap',
    'a2.srv.cnn',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.cnn', {
        url: '/cnn/:cnnId??show',
        controller: 'CNNCtrl',
        templateUrl: '/app/analysis/cnn/list.html'
    });
})
.controller('CNNCtrl' , function($scope, $modal, $filter, Project, ngTableParams, JobsData, a2CNN, a2Playlists, notify, $q, a2UserPermit, $state, $stateParams) {
    $scope.selectedCNNId = $stateParams.cnnId;

    /*
    //for testing...
    $scope.cnnsData = [{'id': 1,
                        'name': 'Cool CNN Run 1',
                        'timestamp': '2019-04-09T21:08:36.000Z',
                        'model': 'Cool Model 1',
                        'playlist_name': 'Cool Playlist 1',
                        'user': 'Joe Fourier'},
                        {'id': 2,
                        'name': 'Cool CNN Run 2',
                        'timestamp': '2019-05-09T21:08:36.000Z',
                        'model': 'Cool Model 1',
                        'playlist_name': 'Cool Playlist 1',
                        'user': 'Joe Fourier'},
                        {'id': 3,
                        'name': 'Cool CNN Run 3',
                        'timestamp': '2019-06-09T21:08:36.000Z',
                        'model': 'Cool Model 1',
                        'playlist_name': 'Cool Playlist 1',
                        'user': 'Joe Fourier'}
                    ]
    */
    a2CNN.list().then(function(data) {
        $scope.cnnsData = data;
        console.log("TCL: cnnsData", $scope.cnnsData)
    });

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

    $scope.selectItem = function(cnnId){
        if($scope.selectedCNNId == cnnId){
            $state.go('analysis.cnn', {
                cnnId: undefined
            });
        } else {
            $state.go('analysis.cnn', {
                cnnId: cnnId
            });
        }
    }
    $scope.setDetailedView = function(detailedView){
        console.log('setting detailed view 72');
        $scope.detailedView = detailedView;
        $state.transitionTo($state.current.name, {
            patternMatchingId:$scope.selectedPatternMatchingId,
            show:detailedView?"detail":"gallery"
        }, {notify:false});
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

})
.directive('a2CnnDetails', function(){
    return {
        restrict : 'E',
        replace: true,
        scope : {
            cnnId: '=',
            detailedView: '=',
            onSetDetailedView: '&',
            onGoBack: '&',
        },
        controller : 'CNNDetailsCtrl',
        controllerAs: 'controller',
        templateUrl: '/app/analysis/cnn/details_species.html'
    };
})
.controller('CNNDetailsCtrl' , function($scope, a2CNN, a2PatternMatching, a2UserPermit, Project, notify) {
    $scope.viewType = "all";

    a2CNN.getDetailsFor($scope.cnnId).then(function(data) {
        $scope.job_details = data;
        console.log("TCL: data findOne", data)
    });

    a2CNN.listResults($scope.cnnId).then(function(data) {
        $scope.results = data;
        // DEBUG ONLY - adding in random to see different results
        /*
        $scope.results = $scope.results.map(function (el){
            el.present = (Math.random() >= 0.5)?1:0;
            return el;
        });
        */
        console.log("TCL: data cnnId", data)
    });

    var bySpecies = function(dataIn) {
        var dataOut = {};
        dataIn.forEach(function(element) {
            var s = element.species_id;
            if (!(s in dataOut)) {
                dataOut[s] = {count: 0,
                              species_id: s,
                              scientific_name: element.scientific_name};
            }
            if (element.present == 1) {
                dataOut[s].count++;
            }
        });
        console.log(dataOut);
        return dataOut;
    }

    var byRecordings = function(dataIn) {
        var dataOut = {total: 0};
        dataIn.forEach(function(element) {
            var r = element.recording_id;
            var s = element.species_id;
            if (!(r in dataOut)) {
                dataOut[r] = {recording_id: r,
                              species: {},
                              total: 0}
            }
            if (!(s in dataOut[r].species)) {
                dataOut[r].species[s] = {species_id: s,
                                         scientific_name: element.scientific_name,
                                         count: 0}
            }
            if (element.present == 1) {
                dataOut[r].species[s].count++;
                dataOut[r].total++;
            }
        });
        console.log(dataOut);
        return dataOut;
    }

    $scope.switchView = function(viewType) {
    console.log("TCL: $scope.switchView -> viewType", viewType)
        if (viewType=="species") {
            $scope.species = bySpecies($scope.results);
            $scope.viewType = "species";
        } else if (viewType=="recordings") {
            $scope.recordings = byRecordings($scope.results);
            $scope.viewType = "recordings";
        } else {
            $scope.viewType = "all";
        }
    };
});