angular.module('a2.analysis.cnn', [
    'ui.bootstrap',
    'a2.srv.cnn',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    
    $stateProvider.state('analysis.disabled-cnn', {
        url: '/disabled/cnn',
        templateUrl: '/app/analysis/cnn/disabled.html'
    })
    .state('analysis.cnn', {
        url: '/cnn/',
        controller: 'CNNCtrl',
        templateUrl: '/app/analysis/cnn/list.html'
    })
    .state('analysis.cnn-details', {
        url: '/cnn/:cnnId',///:detailType/',
        controller: 'CNNCtrl',
        templateUrl: '/app/analysis/cnn/list.html'
    });
})
.controller('CNNCtrl' , function($scope, $modal, $filter, $location, Project, ngTableParams, JobsData, a2CNN, a2Playlists, notify, $q, a2UserPermit, $state, $stateParams) {
    // this debug line for sanity between servers... Will remove TODO
    console.log("CNN Version 0.5");
    $scope.selectedCNNId = $stateParams.cnnId;

    var initTable = function(p, c, s, f, t) {
        var sortBy = {};
        var acsDesc = 'desc';
        if (s[0]=='+') {
            acsDesc = 'asc';
        }
        sortBy[s.substring(1)] = acsDesc;
        var tableConfig = {
            page: p,
            count: c,
            sorting: sortBy,
            filter:f
        };

        $scope.tableParams = new ngTableParams(tableConfig, {
            total: t,
            getData: function ($defer, params) {
                $scope.infopanedata = "";
                var filteredData = params.filter() ? $filter('filter')($scope.cnnOriginal , params.filter()) : $scope.cnnOriginal;

                var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.cnnOriginal;

                params.total(orderedData.length);

                $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

                if (orderedData.length < 1) {
                    $scope.infopanedata = "No cnn searches found.";
                }

                $scope.cnnsData  = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
            }
        });
    };

    $scope.loadCNNs = function() {
        $scope.loading = true;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;

        return a2CNN.list().then(function(data) {
            $scope.cnnOriginal = data;
            $scope.cnnsData = data;
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
            $scope.infopanedata = "";

            if(data.length > 0) {
                if(!$scope.tableParams) {
                    initTable(1,10,"+cname",{},data.length);
                } else {
                    $scope.tableParams.reload();
                }
            } else {
                $scope.infopanedata = "No cnns found.";
            }
        });
    };

    if (!$scope.selectedCNNId) {
        $scope.loadCNNs();
    }

    $scope.createNewCNN = function () {
        // TODO: add in real cnn permissions
        if(!a2UserPermit.can('manage pattern matchings')) {
            notify.log('You do not have permission to create cnn jobs.');
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

    $scope.deleteCNN = function(cnn){
        notify.log('Delete not implemented yet. Would be deleting: ' + cnn.name)
    };

    $scope.selectItem = function(cnnId){
        if (!cnnId){
            $state.go('analysis.cnn', {});
        } else {
            $state.go('analysis.cnn-details', {
                cnnId: cnnId,
                //detailType: 'all'
            });
        }
    };

    $scope.setDetailedView = function(detailedView){
        $scope.detailedView = detailedView;
        $state.transitionTo($state.current.name, {
            patternMatchingId:$scope.selectedPatternMatchingId,
            show:detailedView?"detail":"gallery"
        }, {notify:false});
    };
})
.controller('CreateNewCNNInstanceCtrl', function($scope, $modalInstance, a2PatternMatching, a2Templates, a2Playlists, a2CNN, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                playlists: false,
                models: false,
            };

            var list = this.list = {};
            list.lambdas = [{'name': 'call_id_testing:1 - create fake data', 'key': "new_cnn_job_test1"},
                            {'name': 'function_id_driver - test real function', 'key': "new_cnn_job_v1"}];

            this.data = {
                name: null,
                playlist: null,
                model: null,
                lambda: list.lambdas[0],
                params: { },
            };

            this.loading.models = true;
            a2CNN.listModels().then((function(models){
                this.loading.models = false;
                list.models = models;
            }).bind(this));

            this.loading.playlists = true;
            a2Playlists.getList().then((function(playlists){
                this.loading.playlists = false;
                list.playlists = playlists;
            }).bind(this));
        },
        ok: function () {
            try {
                return a2CNN.create({
                    playlist_id: this.data.playlist.id,
                    cnn_id: this.data.model.id,
                    name: this.data.name,
                    lambda: this.data.lambda.key,
                    params: this.data.params
                }).then(function(cnn) {
                    $modalInstance.close({ok:true, cnn: cnn});
                }).catch(notify.serverError);
            } catch(error) {
                console.log("a2CNN.create error: " + error);
            }
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
        templateUrl: '/app/analysis/cnn/details.html'
    };
})
.controller('CNNDetailsCtrl' , function($scope, $state, ngTableParams, $filter, a2CNN, a2PatternMatching, a2UserPermit, Project, notify) {
    var initTable = function(p, c, s, f, t) {
        var sortBy = {};
        var acsDesc = 'desc';
        if (s[0]=='+') {
            acsDesc = 'asc';
        }
        sortBy[s.substring(1)] = acsDesc;
        var tableConfig = {
            page: p,
            count: c,
            sorting: sortBy,
            filter:f
        };

        $scope.tableParams = new ngTableParams(tableConfig, {
            total: t,
            getData: function ($defer, params) {
                $scope.infopanedata = "";
                var filteredData = params.filter() ? $filter('filter')($scope.cnnOriginal , params.filter()) : $scope.cnnOriginal;
                var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.cnnOriginal;

                params.total(orderedData.length);
                $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                if (orderedData.length < 1) {
                    $scope.infopanedata = "No cnn searches found.";
                }

                cnnsData  = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                if ($scope.viewType == "species"){
                    $scope.species = cnnsData;
                } else if ($scope.viewType == "recordings"){
                    $scope.recordings = cnnsData;
                } else {
                    $scope.mainResults = cnnsData;
                }
            }
        });
    };

    //$scope.viewType = "all";
    $scope.counts = {recordings: null};

    a2CNN.getDetailsFor($scope.cnnId).then(function(data) {
        $scope.job_details = data;
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
        return dataOut;
    }

    var byRecordings = function(dataIn) {
        var dataOut = {total: 0};
        dataIn.forEach(function(element) {
            var r = element.recording_id;
            var s = element.species_id;
            if (!(r in dataOut)) {
                dataOut[r] = {recording_id: r,
                              thumbnail: element.thumbnail,
                              species: {},
                              total: 0,
                              species_list: ''}
            }
            if (!(s in dataOut[r].species)) {
                dataOut[r].species[s] = {species_id: s,
                                         scientific_name: element.scientific_name,
                                         count: 0};
            }
            if (element.present == 1) {
                if (dataOut[r].species[s].count==0){
                    dataOut[r].species_list = dataOut[r].species_list + ' ' + element.scientific_name;
                }
                dataOut[r].species[s].count++;
                dataOut[r].total++;
            }
        });
        return dataOut;
    }

    var bySpeciesHist = function (dataIn, species_id){
        speciesTimes = [];
        count = 0;
        dataIn.forEach(function(element) {
            if (species_id == 'all' | element.species_id == species_id) {
                if (species_id == 'all') {
                    speciesName = 'All';
                } else {
                    speciesName = element.scientific_name;
                }
                if (element.present == 1) {
                    var d = new Date(element.datetime);
                    var minutes = d.getHours()*60 + d.getMinutes();
                    speciesTimes.push(new Date(3000, 0, 1, d.getHours(), d.getMinutes()));
                    count++;
                }
            }
        });
        return {times: speciesTimes,
                count: count,
                name: speciesName};
    };

    var plotShown = false;
    $scope.showHist = function(species_id){
        $scope.speciesInfo = bySpeciesHist($scope.results, species_id);
        var trace = {
            x: $scope.speciesInfo.times,
            type: 'histogram',
            //xbins: {size: new Date(3000, 0, 2, 2).getTime() - new Date(3000, 0, 2, 0).getTime()}
            //magic numbers for full day/2 hour bins
            xbins: {start: 32503698000000, end: 32503791600000, size: 7200000}
        };
        var layout = {
            title: $scope.speciesInfo.name + ' by time of day.',
            xaxis: {
                tickformat: '%X', // For more time formatting types, see: https://github.com/d3/d3-time-format/blob/master/README.md
                range: [
                    new Date(3000, 0, 1).getTime(),
                    new Date(3000, 0, 2).getTime()]
            }
        };
        var data = [trace];
        if (!plotShown){
            Plotly.newPlot('speciesHist', data, layout);
            plotShown = true;
        } else {
            Plotly.newPlot('speciesHist', data, layout);
        }
    };

    $scope.getRecordingVisualizerUrl = function(recording_id) {
        return "/project/"+Project.getUrl()+"/visualizer/rec/"+recording_id;
    };

    $scope.getTemplateVisualizerUrl = function(template){
        var projecturl = Project.getUrl();
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
        return template ? "/project/"+projecturl+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
    };

    $scope.switchView = function(viewType, specie) {
        if (specie) {
            window.scrollTo(0,0);
        }
        var loadSwitch = function(){
            $scope.loading = true;
            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
            $scope.infopanedata = "";

            if (viewType=="species") {
                $scope.species = bySpecies($scope.results);
                $scope.viewType = "species";
                $scope.showHist(specie ? specie : "all");
                $scope.cnnOriginal = Object.values($scope.species);
            } else if (viewType=="recordings") {
                $scope.recordings = byRecordings($scope.results);
                $scope.counts.recordings = Object.keys($scope.recordings).length;
                $scope.viewType = "recordings";
                $scope.cnnOriginal = Object.values($scope.recordings);
            } else {
                $scope.viewType = "all";
                $scope.mainResults = $scope.results;
                $scope.cnnOriginal = Object.values($scope.results);
            }
            //console.log('starting state change......');
            //$state.go('analysis.cnn-details', {detailType: $scope.viewType});
            //console.log('ending state change......');
            if($scope.cnnOriginal.length > 0) {
                //if(!$scope.tableParams) {
                    initTable(1,10,"+cname",{},$scope.cnnOriginal.length);
                //} else {
                //    $scope.tableParams.reload();
                //}
            } else {
                $scope.infopanedata = "No cnn results found.";
            }
        };
        if (!$scope.results){
            a2CNN.listResults($scope.cnnId).then(function(data) {
                $scope.results = data;
                loadSwitch();
            });
        } else{
            loadSwitch();
        }
    };


/* might need this function to watch for internal state changes, probably not but leaving it in for reference for now
    $scope.$watchCollection(function(){
        return $state.params;
    }, function(){
        console.log("State params have been updated", $state.params);
        //$scope.switchView($state.params.detailType ? $state.params.detailType : 'all');
    });
*/

    //console.log("TCL: $state.params", $state.params)
    $scope.switchView($state.params.detailType ? $state.params.detailType : 'all');
});