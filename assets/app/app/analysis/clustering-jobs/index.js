angular.module('a2.analysis.clustering-jobs', [
    'ui.bootstrap',
    'a2.srv.clustering-jobs',
    'a2.services',
    'a2.permissions',
    'a2.directive.audio-bar',
    'humane',
])
.config(function($stateProvider) {
    $stateProvider.state('analysis.clustering-jobs', {
        url: '/clustering-jobs',
        controller: 'ClusteringJobsModelCtrl',
        templateUrl: '/app/analysis/clustering-jobs/list.html'
    })
    .state('analysis.clustering-jobs-details', {
        url: '/clustering-jobs/:clusteringJobId',
        controller: 'ClusteringJobsModelCtrl',
        templateUrl: '/app/analysis/clustering-jobs/list.html'
    })
    .state('analysis.grid-view', {
        url: '/clustering-jobs/:clusteringJobId/grid-view',
        controller: 'ClusteringJobsModelCtrl',
        params: { gridContext: null },
        templateUrl: '/app/analysis/clustering-jobs/list.html'
    });
})
.controller('ClusteringJobsModelCtrl' , function($scope, $state, $stateParams, a2ClusteringJobs, JobsData, notify, $location, $modal) {
    $scope.selectedClusteringJobId = $stateParams.clusteringJobId;
    $scope.showViewGridPage = false;
    $scope.loadClusteringJobs = function() {
        $scope.loading = true;
        return a2ClusteringJobs.list().then(function(data) {
            $scope.clusteringJobsOriginal = data;
            $scope.clusteringJobsData = data;
            $scope.loading = false;
            $scope.infopanedata = '';
            if (data && !data.length) {
                $scope.infopanedata = 'No clustering jobs found.';
            }
        });
    };

    if (!$scope.selectedClusteringJobId) {
        $scope.loadClusteringJobs();
    }
    if ($stateParams.gridContext) {
        $scope.showViewGridPage = true;
        $scope.gridContext = $stateParams.gridContext;
    }

    $scope.selectItem = function(clusteringJob) {
        if (!clusteringJob){
            $state.go('analysis.clustering-jobs', {});
        }
        else {
            $state.go('analysis.clustering-jobs-details', {
                clusteringJobId: clusteringJob.clustering_job_id
            });
        }
    }

    $scope.createNewClusteringJob = function () {
        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/clustering-jobs/new-clustering-job.html',
            controller: 'CreateNewClusteringJobCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.create) {
                JobsData.updateJobs();
                notify.log("Your new clustering job is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };
})
.directive('a2ClusteringDetails', function(){
    return {
        restrict : 'E',
        replace: true,
        scope : {
            clusteringJobId: '=',
            detailedView: '=',
            onSetDetailedView: '&',
            onGoBack: '&',
        },
        controller : 'ClusteringDetailsCtrl',
        controllerAs: 'controller',
        templateUrl: '/app/analysis/clustering-jobs/details.html'
    };
})
.controller('ClusteringDetailsCtrl' , function($scope, $state, a2ClusteringJobs) {
    $scope.loading = true;
    $scope.shapeSelected = false;
    $scope.infopanedata = '';
    var refreshDetails = function() {
        a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
            if (data) $scope.job_details = data;
        }).catch(err => {
            console.log(err);
        });
        a2ClusteringJobs.getClusteringDetails($scope.clusteringJobId).then(function(res) {
            $scope.loading = false;
            if (res) {
                $scope.countAudioEventDetected = res.aed_id.length;
                $scope.countClustersDetected = res.cluster.length;
                var el = document.getElementById('plotly');
                var d3 = Plotly.d3;
                var clusters = {};
                res.cluster.forEach((item, i) => {
                    if (!clusters[item]) {
                        clusters[item] = {
                            x: [res.x_coord[i]],
                            y: [res.y_coord[i]],
                            aed: [res.aed_id[i]]
                        }
                    }
                    else {
                        clusters[item].x.push(res.x_coord[i]);
                        clusters[item].y.push(res.y_coord[i]);
                        clusters[item].aed.push(res.aed_id[i]);
                    }
                })
                var data = [];
                var shapes = [];
                $scope.originalData = [];
                for (var c in clusters) {
                    // collect data for points
                    data.push({
                        x: clusters[c].x,
                        y: clusters[c].y,
                        mode: 'markers',
                        name: c
                    });
                    // collect data for shapes
                    shapes.push({
                        type: 'circle',
                        xref: 'x',
                        yref: 'y',
                        x0: d3.min(clusters[c].x),
                        y0: d3.min(clusters[c].y),
                        x1: d3.max(clusters[c].x),
                        y1: d3.max(clusters[c].y),
                        opacity: 0.2,
                    });
                    // collect data for grid view page
                    $scope.originalData.push({
                        x: clusters[c].x,
                        y: clusters[c].y,
                        cluster: c,
                        aed: clusters[c].aed
                    });
                }
                // shapes layout
                var layout = {
                    shapes: shapes,
                    height: 400,
                    width: el ? el.offsetWidth : 1390,
                    showlegend: true,
                    legend: {
                        orientation: 'h',
                        itemclick: 'toggleothers',
                        font: {
                            color: 'white'
                        }
                    },
                    paper_bgcolor: '#232436',
                    plot_bgcolor: '#232436',
                    xaxis: {
                        color: 'white'
                    },
                    yaxis: {
                        color: 'white'
                    }
                }
                // function to get random color
                var random_color = function() {
                    var letters = '0123456789ABCDEF';
                    var color = '#';
                    for (var i = 0; i < 6; i++) {
                        color += letters[Math.floor(Math.random() * 16)];
                    }
                    return color;
                }
                // make random color for shapes and points
                layout.shapes.forEach((shape, i) => {
                    var color = random_color();
                    data[i].line = {};
                    data[i].line.color = color
                    shape.fillcolor = color
                    shape.line = {};
                    shape.line.color = color;
                })

                if (el) {
                    var config = {
                        scrollZoom: true,
                        displayModeBar: true,
                        displaylogo: false,
                        hoverdistance: 5
                    }
                    Plotly.newPlot(el, data, layout, config);
                    el.on('plotly_click', function(data) {
                        $scope.point = {
                            x: data.points[0].x,
                            y: data.points[0].y
                        };
                        layout.shapes.forEach((shape, i) => {
                            if (($scope.point.x >= shape.x0) && ($scope.point.x <= shape.x1) &&
                                ($scope.point.y >= shape.y0) && ($scope.point.y <= shape.y1)) {
                                layout.shapes[i].line.color = '#ffffff';
                                Plotly.relayout(el, {
                                    'layout.shapes[i].line.color': '#ff0000',
                                    'layout.shapes[i].line.stroke-width': 4
                                });
                                $scope.shapeSelected = true;
                                $scope.$apply();
                            }
                        })
                    });
                }
            }
        }).catch(err => {
            console.log(err);
            $scope.loading = false;
            $scope.infopanedata = 'No data for clustering job found.';
        });
    };
    $scope.onGridViewSelected = function () {
        $scope.shapeSelected = false;
        $scope.showViewGridPage = true;
        $scope.gridContext = $scope.originalData.find(shape => {
            return shape.x.includes($scope.point.x) && shape.y.includes($scope.point.y);
        })
        $state.go('analysis.grid-view', {
            clusteringJobId: $scope.clusteringJobId,
            gridContext: $scope.gridContext
        });
    };
    $scope.showDetailsPage = function () {
        return !$scope.loading && !$scope.infopanedata && !$scope.gridViewSelected;
    }
    refreshDetails();
})
.controller('CreateNewClusteringJobCtrl', function($modalInstance, a2ClusteringJobs, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                jobs: false
            };

            var list = this.list = {};

            this.data = {
                name: null,
                aed_job: {},
                params: {
                    minPoints: 2,
                    distanceThreshold: 10
                }
            };

            this.loading.jobs = true;
            a2ClusteringJobs.audioEventDetections().then((function(jobs){
                this.loading.jobs = false;
                list.jobs = jobs.map(job => {
                    return {
                        name: job.name,
                        jobId: job.job_id
                    }
                });
            }).bind(this));
        },
        create: function () {
            try {
                return a2ClusteringJobs.create({
                    name: this.data.name,
                    aed_job: this.data.aed_job,
                    params: this.data.params
                }).then(function(clusteringModel) {
                    $modalInstance.close({create:true, clusteringModel: clusteringModel});
                }).catch(notify.serverError);
            } catch(error) {
                console.error("a2ClusteringJobs.create error: " + error);
            }
        },
        cancel: function (url) {
            $modalInstance.close({ cancel: true, url: url });
        },
        isJobValid: function () {
            return this.data && this.data.name && this.data.name.length > 3 && this.data.aed_job;
        }
    });
    this.initialize();
})
.directive('a2GridView', function() {
    return {
        restrict : 'E',
        scope : {
            clusteringJobId: '=',
            gridContext: '=',
            onGoBack: '&',
        },
        controller : 'GridViewCtrl',
        controllerAs: 'controller',
        templateUrl: '/app/analysis/clustering-jobs/grid-view.html'
    };
})
.controller('GridViewCtrl' , function($scope, a2ClusteringJobs, a2AudioBarService, Project) {
    $scope.loading = true;
    $scope.infopanedata = '';

    $scope.lists = {
        search: [
            {value:'all', text:'All', description: 'Show all matched rois.'},
            {value:'by_site', text:'Sort per Site', description: 'Show all rois ranked per Site.'},
            {value:'by_date', text:'Sort per Date', description: 'Show all rois sorted per Date.'}
        ]
    };
    $scope.search = $scope.lists.search[0];

    a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
        if (data) $scope.job_details = data;
    }).catch(err => {
        console.log(err);
    });

    $scope.onSearchChanged = function(value) {
        $scope.search.value = value;
        $scope.getRoisDetails();
    }

    $scope.getRoisDetails = function() {
        return a2ClusteringJobs.getRoisDetails({
            jobId: $scope.clusteringJobId,
            aed: $scope.gridContext.aed,
            search: $scope.search.value
        }).then(function(data) {
            $scope.loading = false;
            if (data) $scope.rois = data;
        }).catch(err => {
            console.log(err);
            $scope.loading = false;
            $scope.infopanedata = 'No data for clustering job found.';
        });
    }

    $scope.getRoisDetails();

    $scope.playRoiAudio = function(recId, $event) {
        if ($event) {
            $event.preventDefault();
            $event.stopPropagation();
        }
        a2AudioBarService.loadUrl(a2ClusteringJobs.getAudioUrlFor(recId), true);
    };

    $scope.getRoiVisualizerUrl = function(roi){
        var projecturl = Project.getUrl();
        var box = ['box', roi.time_min, roi.frequency_min, roi.time_max, roi.frequency_max].join(',');
        return roi ? '/visualizer/' + projecturl + '/#/visualizer/rec/' + roi.recording_id + '?a=' + box : '';
    };
})
