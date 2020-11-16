angular.module('a2.analysis.clustering-jobs', [
  'ui.bootstrap',
  'a2.srv.clustering-jobs',
  'a2.services',
  'a2.permissions',
  'humane',
])
.config(function($stateProvider) {
    $stateProvider.state('analysis.clustering-jobs', {
        url: '/clustering-jobs/',
        controller: 'ClusteringJobsModelCtrl',
        templateUrl: '/app/analysis/clustering-jobs/list.html'
    })
    .state('analysis.clustering-jobs-details', {
        url: '/clustering-jobs/:clusteringJobId',
        controller: 'ClusteringJobsModelCtrl',
        templateUrl: '/app/analysis/clustering-jobs/list.html'
    });
})
.controller('ClusteringJobsModelCtrl' , function($scope, $state, $stateParams, a2ClusteringJobs, JobsData, notify, $location, $modal) {
    $scope.selectedClusteringJobId = $stateParams.clusteringJobId;
    $scope.loadClusteringJobs = function() {
        $scope.loading = true;

        return a2ClusteringJobs.list().then(function(data) {
            $scope.clusteringJobsOriginal = data;
            $scope.clusteringJobsData = data;
            $scope.loading = false;
            $scope.infopanedata = '';

            if(data && !data.length) {
                $scope.infopanedata = 'No clustering jobs found.';
            }
        });
    };

    if (!$scope.selectedClusteringJobId) {
        $scope.loadClusteringJobs();
    }

    $scope.selectItem = function(clusteringJob) {
        if (!clusteringJob){
            $state.go('analysis.clustering-jobs', {});
        } else {
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
.controller('ClusteringDetailsCtrl' , function($scope, a2ClusteringJobs, notify) {
    $scope.loading = true;
    $scope.shapeSelected = false;
    $scope.infopanedata = '';
    var refreshDetails = function() {
        a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
            $scope.loading = false;
            if (data && !data.name) {
                $scope.infopanedata = 'No data for clustering job found.';
            }
            else $scope.job_details = data;
        });
        a2ClusteringJobs.getClusteringDetails($scope.clusteringJobId).then(function(res) {
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
                            y: [res.y_coord[i]]
                        }
                    }
                    else {
                        clusters[item].x.push(res.x_coord[i]);
                        clusters[item].y.push(res.y_coord[i]);
                    }
                })
                var data = [];
                var shapes = [];
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
                        var point = {
                            x: data.points[0].x,
                            y: data.points[0].y
                        };
                        console.log('plotly_click', data, point);
                        layout.shapes.forEach((shape, i) => {
                            if ((point.x >= shape.x0) && (point.x <= shape.x1) &&
                                (point.y >= shape.y0) && (point.y <= shape.y1)) {
                                layout.shapes[i].line.color = '#ffffff';
                                Plotly.relayout(el, {
                                    'layout.shapes[i].line.color': '#ff0000',
                                    'layout.shapes[i].line.stroke-width': 4
                                });
                                $scope.shapeSelected = true;
                                $scope.$apply()
                            }
                        })
                    });
                }
            }
        })
    };

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
