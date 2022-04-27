angular.module('a2.analysis.clustering-jobs', [
    'ui.bootstrap',
    'a2.srv.clustering-jobs',
    'a2.srv.playlists',
    'a2.services',
    'a2.permissions',
    'a2.directive.audio-bar',
    'humane',
    'a2.filter.round',
    'a2.directive.frequency_filter_range_control'
])
.config(function($stateProvider) {
    $stateProvider
      .state('analysis.clustering-jobs', {
          url: '/clustering-jobs',
          controller: 'ClusteringJobsModelCtrl',
          templateUrl: '/app/analysis/clustering-jobs/list.html',
      })
      .state('analysis.clustering-jobs-details', {
          url: '/clustering-jobs/:clusteringJobId?freqMin&freqMax',
          controller: 'ClusteringJobsModelCtrl',
          params: {
            freqMin: null,
            freqMax: null
          },
          templateUrl: '/app/analysis/clustering-jobs/list.html',
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
        return a2ClusteringJobs.list({completed: true}).then(function(data) {
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
.controller('ClusteringDetailsCtrl' , function(
    $scope,
    $state,
    $location,
    a2ClusteringJobs,
    $window,
    Project,
    a2Playlists,
    $localStorage,
    $modal
) {
    var d3 = $window.d3
    $scope.loading = true;
    $scope.toggleMenu = false;
    $scope.selectedCluster = null;
    var timeout;
    $scope.lists = {
        types: [
            { value: 'lda', text: 'LDA' },
            { value: 'umap', text: 'UMAP' },
        ]
    };
    $scope.frequencyFilter = {
      min: null, max: null, currentMin: null, currentMax: null
    }

    $scope.selectedType = $scope.lists.types[0];
    $scope.onTypeSelect = function(type) {
        getClusteringDetails(type.value);
    }
    $scope.decrementClusters = function() {
        if ($scope.selectedCluster === 1) return
        $scope.selectedCluster -= 1;
        $scope.selectClusters();
    };
    $scope.incrementClusters = function() {
        if ($scope.selectedCluster === $scope.layout.shapes.length) return
        $scope.selectedCluster += 1;
        $scope.selectClusters();
    };
    // Select one cluster
    $scope.selectClusters = function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if ($scope.selectedCluster !== null) {
                $("#plotly .select-outline").remove();
                $scope.layout.shapes.forEach((shape) => {
                    shape.line.color = shape.fillcolor;
                    shape.line['stroke-width'] = 1;
                });
                var selection = $scope.layout.shapes[$scope.selectedCluster - 1]
                selection.line.color = '#ffffff';
                Plotly.relayout(document.getElementById('plotly'), {
                    'selection.line.color': '#ff0000',
                    'selection.line.opacity': 1,
                    'selection.line.stroke-width': 4
                });
                // Example: 3:[0, 1, 2, 3, 4] , where 3 - index of a cluster, array with the index of detections
                $scope.points = []
                $scope.points[$scope.selectedCluster - 1] = []
                $scope.points[$scope.selectedCluster - 1] = $scope.getShapePoints();
                $scope.toggleMenu = true;
                $scope.$apply();
            }
        }, 2000);
    };

    $scope.getShapePoints = function() {
        var arr = []
        var clusters = $scope.isFilteredClusters() ? $scope.sortFilteredData({min: $location.search().freqMin, max: $location.search().freqMax}) : $scope.clusters
        var cluster = Object.values(clusters)[$scope.selectedCluster - 1].aed
        cluster.forEach((item, ind) => { arr.push(ind) } )
        return arr
    }

    var getClusteringDetails = function(type) {
        $scope.infopanedata = '';
        a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
            if (data) $scope.job_details = data;
        }).catch(err => {
            console.log(err);
        });
        // Get json file which is included aed_id, clusters names, x, y points.
        a2ClusteringJobs.getClusteringDetails({job_id: $scope.clusteringJobId, type: type}).then(function(res) {
            $scope.loading = false;
            if (res && res.aed_id) {
                $scope.countAudioEventDetected = res.aed_id.length;
                // Collect clusters data.
                $scope.clusters = {};
                res.cluster.forEach((item, i) => {
                    if (!$scope.clusters[item]) {
                        $scope.clusters[item] = {
                            x: [res.x_coord[i]],
                            y: [res.y_coord[i]],
                            aed: [res.aed_id[i]],
                            freq_low: [],
                            freq_high: []
                        }
                    }
                    else {
                        $scope.clusters[item].x.push(res.x_coord[i]);
                        $scope.clusters[item].y.push(res.y_coord[i]);
                        $scope.clusters[item].aed.push(res.aed_id[i]);
                    }
                });
                // Get json file which is included aed_id, recordings, frequency data for the frequency filter.
                a2ClusteringJobs.getClusteringDetails({job_id: $scope.clusteringJobId, aed_info: true})
                    .then(function(data) {
                        if (data !== undefined) {
                            $scope.aedDataInfo = data;
                            // Create frequency object to collect min and max values for the frequency filter.
                            $scope.frequency = {
                                freq_low: [],
                                freq_high: []
                            };
                            // Add frequency min, max values to the clusters array.
                            for (var c in $scope.clusters) {
                                if ($scope.clusters[c] && $scope.clusters[c].aed && $scope.clusters[c].aed.length) {
                                    $scope.clusters[c].aed.forEach((aed) => {
                                        const indx = data.aed_id.findIndex(item => item === aed);
                                        if (indx !== -1) {
                                            // Collect frequency min and max values for the frequency filter.
                                            $scope.frequency.freq_low.push(data.freq_low[indx]);
                                            $scope.frequency.freq_high.push(data.freq_high[indx]);
                                            $scope.clusters[c].freq_low.push(data.freq_low[indx]);
                                            $scope.clusters[c].freq_high.push(data.freq_high[indx]);
                                        }
                                    });
                                }
                            }
                            // Find frequency min and max values for frequency filter.
                            $scope.frequencyFilter.min = Math.min.apply(null, $scope.frequency.freq_low)
                            $scope.frequencyFilter.max = Math.max.apply(null, $scope.frequency.freq_high)
                            if ($scope.isFilteredClusters()) {
                              $scope.useFrequencyFilterData({min: parseInt($location.search().freqMin), max: parseInt($location.search().freqMax)})
                            }
                        }
                    }).catch(err => {
                        console.log(err);
                    });
                $scope.countClustersDetected = Object.keys($scope.clusters).length;
                if (!$scope.isFilteredClusters()) {
                  drawClusteringPoints($scope.clusters);
                }
            }
        }).catch(err => {
            console.log(err);
            $scope.loading = false;
            $scope.infopanedata = 'No data for clustering job found.';
        });
    };

    $scope.isFilteredClusters = function() {
        return $location.search().freqMin && $location.search().freqMax
    }
    
    var drawClusteringPoints = function(clusters) {
        var el = document.getElementById('plotly');
        var data = [];
        var shapes = [];
        $scope.originalData = [];
        for (var c in clusters) {
            // Collect data for points.
            data.push({
                x: clusters[c].x,
                y: clusters[c].y,
                type: 'scatter',
                mode: 'markers',
                hoverinfo: 'none',
                name: c,
                marker: { size: 6 }
            });
            // Collect data for shapes.
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
            // Collect data for grid view page.
            $scope.originalData.push({
                x: clusters[c].x,
                y: clusters[c].y,
                cluster: c,
                aed: clusters[c].aed
            });
        }
        // Shapes layout.
        $scope.layout = {
            shapes: shapes,
            height: el ? el.offsetWidth - el.offsetWidth/3 : 800,
            width: el ? el.offsetWidth : 1390,
            showlegend: true,
            legend: {
                title: { text: 'Clusters names', side: 'top', font: { size: 12 } },
                x: 1,
                xanchor: 'right',
                y: 1,
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

        // Function to get color.
        function getColor(n) {
            const rgb = [0, 0, 0];
            for (var i = 0; i < 24; i++) {
                rgb[i%3] <<= 1;
                rgb[i%3] |= n & 0x01;
                n >>= 1;
            }
            return '#' + rgb.reduce((a, c) => (c > 0x0f ? c.toString(16) : '0' + c.toString(16)) + a, '')
        }

        // Make random color for shapes and points.
        $scope.layout.shapes.forEach((shape, i) => {
            var color = getColor(i+1);
            data[i].marker = {
                color: color
            };
            shape.fillcolor = color
            shape.line = {
                color: color,
                'stroke-width': 1
            };
        })

        $scope.resetSelect = function () {
            $scope.toggleMenu = false;
            $scope.$apply();
            $scope.layout.shapes.forEach((shape) => {
                shape.line.color = shape.fillcolor;
                shape.line['stroke-width'] = 1;
            });
            Plotly.redraw(el);
            $scope.$apply();
        };

        if (el) {
            var config = {
                scrollZoom: true,
                displayModeBar: true,
                displaylogo: false,
                hoverdistance: 5
            }
            // To draw points
            Plotly.newPlot(el, data, $scope.layout, config);
            // Click on a point.
            el.on('plotly_click', function(data) {
                console.log('plotly_click', data);
                $("#plotly .select-outline").remove();
                $scope.resetSelect();
                $scope.points = {
                    x: data.points[0].x,
                    y: data.points[0].y,
                    name: data.points[0].fullData.name
                };
                $scope.layout.shapes.forEach((shape, i) => {
                    if (($scope.points.x >= shape.x0) && ($scope.points.x <= shape.x1) &&
                        ($scope.points.y >= shape.y0) && ($scope.points.y <= shape.y1)) {
                        $scope.layout.shapes[i].line.color = '#ffffff';
                        Plotly.relayout(el, {
                            '$scope.layout.shapes[i].line.color': '#ff0000',
                            '$scope.layout.shapes[i].line.stroke-width': 4
                        });
                        $scope.toggleMenu = true;
                        $scope.$apply();
                    }
                })
            });
            // Select a group of points.
            el.on('plotly_selected', function(data) {
                if (!data) {
                    $("#plotly .select-outline").remove();
                };
                console.log('plotly_selected', data);
                $scope.points = [];
                // Collect selected points indexes in the points array.
                if (data && data.points && data.points.length) {
                    data.points.forEach(point => {
                        var cluster = point.curveNumber;
                        if (!$scope.points[cluster]) {
                            $scope.points[cluster] = [];
                        };
                        // Example: 3:[0, 1, 2, 3, 4] , where 3 - index of a cluster, array with the index of detections
                        $scope.points[cluster].push(point.pointNumber);
                    });
                    $scope.toggleMenu = true;
                    $scope.$apply();
                }
            });
        }
    };
    // Navigates to the Grid View page.
    $scope.onGridViewSelected = function () {
        $scope.toggleMenu = false;
        $scope.selectedCluster = null;
        $scope.showViewGridPage = true;
        // View all clusters
        if (!$scope.points) {
          $scope.gridContext = $scope.originalData
        }
        // Get points in different clusters, when the user selects dots by lasso or with the cluster selector
        else if ($scope.points.length) {
            $scope.gridContext = {};
            $scope.points.forEach((row, i) => {
                $scope.gridContext[i] = {
                    aed: $scope.originalData[i].aed.filter((a, i) => {
                        return row.includes(i);
                    }),
                    name: $scope.originalData[i].cluster
                }
            })
        }
        // Get selected cluster with all points in the shape
        else {
            $scope.gridContext = $scope.originalData.find(shape => {
                return shape.x.includes($scope.points.x) && shape.y.includes($scope.points.y);
            })
        }
        $state.go('analysis.grid-view', {
            clusteringJobId: $scope.clusteringJobId,
            gridContext: $scope.gridContext
        });
    };
    // Navigates to the Visualizer page.
    $scope.showClustersInVisualizer = function () {
        if ($scope.points.length) {
            $scope.selectedClusters = {
                aed: []
            };
            for (var r in $scope.points) {
                $scope.originalData[r].aed.forEach((a, i) => {
                    if ($scope.points[r].includes(i)) {
                        $scope.selectedClusters.aed.push(a);
                    };
                })
            }
        }
        else {
            // User selects any point in one shape. It have to process all points in a shape
            $scope.selectedClusters = $scope.originalData.find(shape => {
                return shape.x.includes($scope.points.x) && shape.y.includes($scope.points.y);
            });
        }
        // Save temporary palylist with selected clusters to the local storage.
        if ($scope.selectedClusters && $scope.selectedClusters.aed && $scope.selectedClusters.aed.length) {
            if ($scope.aedDataInfo !== undefined) {
                $scope.selectedClusters.boxes = {};
                var recIds = [];
                $scope.selectedClusters.aed.forEach(id => {
                    const indx = $scope.aedDataInfo.aed_id.findIndex(item => item === id);
                    recIds.push($scope.aedDataInfo.recording_id[indx])
                    var box = ['box', $scope.aedDataInfo.time_min[indx], $scope.aedDataInfo.freq_low[indx], $scope.aedDataInfo.time_max[indx], $scope.aedDataInfo.freq_high[indx]].join(',');
                    if (!$scope.selectedClusters.boxes[$scope.aedDataInfo.recording_id[indx]]) {
                        $scope.selectedClusters.boxes[$scope.aedDataInfo.recording_id[indx]] = [box];
                    }
                    else {
                        $scope.selectedClusters.boxes[$scope.aedDataInfo.recording_id[indx]].push(box);
                    }
                })
                $scope.removeFromLocalStorage();
                var tempPlaylistData = {};
                tempPlaylistData.aed = $scope.selectedClusters.aed;
                tempPlaylistData.boxes = $scope.selectedClusters.boxes;
                tempPlaylistData.playlist = {
                    id: 0,
                    name: 'cluster_' + recIds.join("_"),
                    recordings: recIds.filter((id, i, a) => a.indexOf(id) === i),
                    count: recIds.filter((id, i, a) => a.indexOf(id) === i).length
                };
                $localStorage.setItem('analysis.clusters',  JSON.stringify(tempPlaylistData));
                $window.location.href = '/project/'+Project.getUrl()+'/visualizer/playlist/0?clusters';
            }
        }
    };

    $scope.removeFromLocalStorage = function () {
        $localStorage.setItem('analysis.clusters', null);
        $localStorage.setItem('analysis.clusters.playlist', null);
        $state.params.clusters = '';
    }

    $scope.savePlaylist = function(opts) {
        a2Playlists.create(opts,
        function(data) {
            $window.location.href = '/project/'+Project.getUrl()+'/visualizer/playlist/' + data.playlist_id + '?clusters';
        }
    )};

    $scope.showDetailsPage = function () {
        return !$scope.loading && !$scope.infopanedata && !$scope.gridViewSelected;
    };

    $scope.openFreqFilterModal = function() {
        var modalInstance = $modal.open({
            templateUrl : '/app/analysis/clustering-jobs/frequency-filter.html',
            controller  : 'a2ClusterFrequencyFilterModalController',
            size        : 'sm',
            resolve     : {
                data : function() { return {
                    frequency: $scope.frequencyFilter
                }; }
            }
        });

        modalInstance.result.then(function (result) {
            if (!result) {
                return
            }
            $scope.useFrequencyFilterData(result)
        });
    };

    $scope.sortFilteredData = function (result) {
        var clusters = {};
        for (var c in $scope.clusters) {
            if ($scope.clusters[c].aed.length) {
                clusters[c] = {};
                clusters[c].y = [];
                clusters[c].x = [];
                clusters[c].aed = [];
                // Find filtered points in each cluster from the user selection.
                $scope.clusters[c].freq_high.forEach((freq_high, i) => {
                    if ($scope.clusters[c].freq_low[i] >= result.min && freq_high <= result.max) {
                        clusters[c].y.push($scope.clusters[c].y[i]);
                        clusters[c].x.push($scope.clusters[c].x[i]);
                        clusters[c].aed.push($scope.clusters[c].aed[i]);
                    }
                });
                if (!clusters[c].aed.length) {
                    delete clusters[c]
                }
            }
        }
        return clusters
    }

    $scope.useFrequencyFilterData = function (result) {
        $scope.frequencyFilter.currentMin = result.min;
        $scope.frequencyFilter.currentMax = result.max;
        $state.params.freqMin = $scope.frequencyFilter.currentMin
        $state.params.freqMax = $scope.frequencyFilter.currentMax
        $location.search('freqMin', $scope.frequencyFilter.currentMin);
        $location.search('freqMax', $scope.frequencyFilter.currentMax);
        var clusters = $scope.sortFilteredData(result)
        $scope.countClustersDetected = Object.keys(clusters).length;
        $scope.countAudioEventDetected = Object.values(clusters)
            .map((cluster => {return cluster.aed.length}))
            .reduce(function(sum, current) {
            return sum + current;
        }, 0);
        // Display filtered points from after selection in the frequency filter.
        drawClusteringPoints(clusters);
    }

    getClusteringDetails();
})
.controller('a2ClusterFrequencyFilterModalController', function($scope, $modalInstance, data, Project) {
    $scope.filterData = {};
    $scope.filterData.max_freq = data.frequency.max;
    $scope.filterData.src="/api/project/"+Project.getUrl()+"/recordings/tiles/3298382/0/0";

    $scope.has_previous_filter = true;
    $scope.frequency = data.frequency && data.frequency.currentMax ? { min: angular.copy(data.frequency.currentMin), max: data.frequency.currentMax } : { min: 0, max: $scope.filterData.max_freq };

    $scope.remove_filter = function(){
        $modalInstance.close({ min: data.frequency.min, max: data.frequency.max });
    };
    $scope.apply_filter = function(){
        $modalInstance.close($scope.frequency);
    };
})
.controller('CreateNewClusteringJobCtrl', function($modalInstance, a2ClusteringJobs, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                jobs: false,
                saving: false
            };

            var list = this.list = {};

            this.data = {
                name: null,
                aed_job: {},
                params: {
                    minPoints: 2,
                    distanceThreshold: 0.1
                }
            };

            this.loading.jobs = true;
            a2ClusteringJobs.audioEventDetections({completed: true}).then((function(jobs){
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
            this.loading.saving = true;
            try {
                return a2ClusteringJobs.create({
                    name: this.data.name,
                    aed_job: this.data.aed_job,
                    params: this.data.params
                }).then((function(clusteringModel) {
                    this.loading.saving = false;
                    $modalInstance.close({create:true, clusteringModel: clusteringModel});
                }).bind(this));
            } catch(error) {
                this.loading.saving = false;
                console.error(error);
            }
        },
        cancel: function (url) {
            this.loading.jobs = false;
            this.loading.saving = false;
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
.controller('GridViewCtrl' , function($scope, $http, a2UserPermit, a2ClusteringJobs, a2AudioBarService, a2AudioEventDetectionsClustering, Project, Songtypes, a2Playlists, notify) {
    $scope.loading = true;
    $scope.isSquareSize = false
    $scope.infopanedata = '';
    $scope.projectUrl = Project.getUrl();
    $scope.allRois = [];
    $scope.selectedRois = [];
    $scope.paginationSettings = {
        page: 1,
        limit: 100,
        offset: 0,
        totalItems: 0,
        totalPages: 0
    }

    $scope.lists = {
        search: [
            {value:'all', text:'All', description: 'Show all matched rois.'},
            {value:'per_cluster', text:'Sort per Cluster', description: 'Show all rois ranked per Cluster.'},
            {value:'per_site', text:'Sort per Site', description: 'Show all rois ranked per Site.'},
            {value:'per_date', text:'Sort per Date', description: 'Show all rois sorted per Date.'}
        ]
    };

    $scope.selectedFilterData = $scope.lists.search[1];

    $scope.playlistData = {};

    $scope.aedData = {
        count: 0,
        id: []
    };

    if ($scope.gridContext && $scope.gridContext.aed) {
        $scope.gridData = []
        $scope.gridData.push($scope.gridContext)
        $scope.aedData.count = 1;
        $scope.gridContext.aed.forEach(i => $scope.aedData.id.push(i));
    }
    else {
        $scope.gridData = Object.values($scope.gridContext);
        $scope.aedData.count = $scope.gridData.length;
        $scope.gridData.forEach((data) => {
            data.aed.forEach(i => $scope.aedData.id.push(i));
        });
    }

    a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
        if (data) $scope.job_details = data;
    }).catch(err => {
        console.log(err);
    });

    $scope.onSearchChanged = function(item) {
        $scope.selectedFilterData = item;
        $scope.getRoisDetails();
    }

    $scope.setCurrentPage = function() {
        this.paginationSettings.offset = $scope.paginationSettings.page - 1;
        $scope.getRoisDetails();
    };

    $scope.getRoisDetails = function() {
        if (!$scope.aedData.id.length) {
            return $scope.getStatusForEmptyData();
        }
        $scope.rows = [];
        $scope.isRoisLoading = true;
        $scope.paginationSettings.totalItems = $scope.aedData.id.length;
        return a2ClusteringJobs.getRoisDetails({
            jobId: $scope.clusteringJobId,
            aed: $scope.aedData.id.filter((id, i, a) => {
                return (i >= ($scope.paginationSettings.offset * $scope.paginationSettings.limit)) && (i < ($scope.paginationSettings.page * $scope.paginationSettings.limit))
            }),
            search: $scope.selectedFilterData.value
        }).then(function(data) {
            const groupedData = []
            Object.values($scope.gridData).forEach(value => {
                Object.entries(value).forEach(entry => {
                    if(entry[0] == "aed") {
                        entry[1].forEach(id => {
                            const matched = data.find(aed => aed.aed_id === id)
                            if (matched) {
                                groupedData.push(matched)
                            }
                        })
                    }
                })
            })
            $scope.paginationSettings.totalPages = Math.ceil($scope.paginationSettings.totalItems / $scope.paginationSettings.limit);
            $scope.loading = false;
            $scope.allRois = groupedData
            $scope.isRoisLoading = false;
            $scope.getRoisDetailsSegment()
        }).catch(err => {
            console.log(err);
            $scope.getStatusForEmptyData();
        });
    }

    $scope.getRoisDetails();

    $scope.getStatusForEmptyData = function() {
        $scope.loading = false;
        $scope.isRoisLoading = false;
        $scope.infopanedata = 'No data for clustering job found.';
    }

    $scope.getRoisDetailsSegment = function() {
        const data = $scope.allRois
        if (data && $scope.selectedFilterData.value === 'per_site') {
            var sites = {};
            data.forEach((item) => {
                if (!sites[item.site_id]) {
                    sites[item.site_id] = {
                        id: item.site_id,
                        site: item.site,
                        rois: [item]
                    }
                }
                else {
                    sites[item.site_id].rois.push(item);
                }
            })
            $scope.rows = Object.values(sites);
        } else if (data && $scope.selectedFilterData.value === 'per_cluster') {
            $scope.ids = {};
            if($scope.aedData.count > 1) {
                var grids = []
                $scope.gridData.forEach((row) => { grids.push([row]) })
                grids.forEach((row, index) => {
                    $scope.ids[index] = {
                        cluster: row[0].cluster || row[0].name,
                        rois: data.filter((a, i) => {return row[0].aed.includes(a.aed_id)})
                    }
                })
            } else {
                $scope.ids[0] = {
                    cluster: $scope.gridData[0].cluster || $scope.gridData[0].name,
                    rois: data
                }
            }
            $scope.rows = Object.values($scope.ids);
        } else {
            if ($scope.selectedFilterData.value === 'per_date') {
                data.sort(function(a, b) {
                    return (a.date_created < b.date_created) ? 1 : -1;
                });
            }
            $scope.rows = [];
            $scope.rows.push({
                rois: data
            });
        }
    }

    $scope.playRoiAudio = function(recId, aedId, $event) {
        if ($event) {
            $event.preventDefault();
            $event.stopPropagation();
        }
        a2AudioBarService.loadUrl(a2ClusteringJobs.getAudioUrlFor(recId, aedId), true);
    };

    $scope.getRoiVisualizerUrl = function(roi){
        var projecturl = Project.getUrl();
        var box = ['box', roi.time_min, roi.frequency_min, roi.time_max, roi.frequency_max].join(',');
        return roi ? '/project/' + projecturl + '/#/visualizer/rec/' + roi.recording_id + '?a=' + box : '';
    };

    // Collect rois data which should be validated or include to the playlist through all pagination pages.
    $scope.getSelectedRois = function(roi) {
        if (!roi.selected) {
            const index = $scope.selectedRois.findIndex(item => item === roi.aed_id);
            $scope.selectedRois.splice(index, 1);
            return;
        }
        if ($scope.selectedRois.includes(roi.aed_id)) return;
        $scope.selectedRois.push(roi.aed_id);
    }

    $scope.togglePopup = function() {
        $scope.isPopupOpened = !$scope.isPopupOpened;
    }

    $scope.toggleBoxSize = function() {
      $scope.isSquareSize = !$scope.isSquareSize;
    }

    $scope.isPlaylistDataValid = function() {
        return $scope.selectedRois && $scope.selectedRois.length && $scope.playlistData.playlistName && $scope.playlistData.playlistName.trim().length > 0;
    }

    $scope.closePopup = function() {
        $scope.isPopupOpened = false;
    }

    $scope.savePlaylist = function() {
        if ($scope.selectedRois.length) {
            $scope.isSavingPlaylist = true;
            // Create a new playlist with aed boxes.
            a2Playlists.create({
                playlist_name: $scope.playlistData.playlistName,
                params: $scope.selectedRois,
                recIdsIncluded: true
            },
            function(data) {
                $scope.isSavingPlaylist = false;
                $scope.closePopup();
                 // Attach aed to the new playlist.
                if (data && data.playlist_id) {
                    a2Playlists.attachAedToPlaylist({
                        playlist_id: data.playlist_id,
                        aed: $scope.selectedRois
                    },
                    function(data) {
                        $scope.playlistData = {};
                        notify.log('Audio event detections are saved in the playlist. <br> Navigates to the Visualizer page to see Audio Event boxes on the spectrogram');
                    });
                }
            });
        }
    };

    $scope.speciesLoading = false;
    $scope.selected = { species: null, songtype: null };
    var timeout;

    $scope.isValidationAccessible = function() {
        // TODO: check permissions: a2UserPermit.can('validate species')
        return true
    }

    $scope.setValidation = function() {
        $scope.speciesLoading = true;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            a2AudioEventDetectionsClustering.validate({
                aed: $scope.selectedRois,
                species_name: $scope.selected.species.scientific_name,
                songtype_name: $scope.selected.songtype.name,
                species_id: $scope.selected.species.id,
                songtype_id: $scope.selected.songtype.id
            }).then(data => {
                // Unselect and mark boxes as validated without reloading the page
                $scope.markBoxesAsValidated()
                $scope.unselectBoxes()
                $scope.selectedRois = []
                notify.log('Audio event detections are validated as ' + $scope.selected.species.scientific_name + ' ' + $scope.selected.songtype.name);
                $scope.selected = { species: null, songtype: null };
            }).finally(() => {
                $scope.speciesLoading = false;
            })
        }, 500)
    }

    $scope.markBoxesAsValidated = function() {
      $scope.rows.forEach(row => {
        var arr = row.rois.filter(roi => $scope.selectedRois.includes(roi.aed_id))
        if (arr.length) {
          arr.forEach(a => a.validated = 1)
        }
      })
    }

    $scope.unselectBoxes = function() {
      $scope.rows.forEach(row => {
        var arr = row.rois.filter(roi => roi.selected)
        if (arr.length) {
          arr.forEach(a => a.selected = false)
        }
      })
    }

    Songtypes.get(function(songs) {
        $scope.songtypes = songs;
    });

    $scope.searchSpecies = function(search) {
        $scope.selected.songtype = null;
        $scope.speciesLoading = true;
        return $http.get('/api/species/search', {
            params: {
                q: search
            }
        }).then(function(result) {
            $scope.speciesLoading = false;
            return result.data;
        })
    };

    $scope.onScroll = function($event, $controller){
      this.scrollElement = $controller.scrollElement;
      var scrollPos = $controller.scrollElement.scrollY;
      var headerTop = $controller.anchors.header.offset().top;

      this.headerTop = headerTop | 0;
      this.scrolledPastHeader = scrollPos > headerTop;
    }

})
