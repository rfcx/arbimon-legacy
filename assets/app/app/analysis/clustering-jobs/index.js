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
//------------------- Clustering List page ---------------
.controller('ClusteringJobsModelCtrl' , function($scope, $state, $stateParams, a2ClusteringJobs, JobsData, notify, $location, $modal, a2UserPermit, $localStorage, Project) {
    $scope.selectedClusteringJobId = $stateParams.clusteringJobId;
    $scope.showViewGridPage = false;
    $scope.getProjectData = function () {
        Project.getInfo(function(info){
            $scope.isProjectDisabled = info.disabled === 1;
        })
    },

    $scope.getProjectData()
    $scope.loadClusteringJobs = function() {
        $scope.loading = true;
        $scope.showRefreshBtn = false;
        return a2ClusteringJobs.list({completed: true}).then(function(data) {
            $scope.clusteringJobsOriginal = data;
            $scope.clusteringJobsData = data;
            $scope.loading = false;
            if (data && data.length) {
                $scope.showRefreshBtn = true;
            }
        });
    };

    if (!$scope.selectedClusteringJobId) {
        $scope.loadClusteringJobs();
    }

    // Parse grid view data if it exists
    const gridContext = JSON.parse($localStorage.getItem('analysis.gridContext'));
    if ($stateParams.gridContext || (gridContext && $state.current.name === 'analysis.grid-view')) {
        $scope.showViewGridPage = true;
        $scope.gridContext = $stateParams.gridContext? $stateParams.gridContext : gridContext;
    } else {
        $localStorage.setItem('analysis.gridContext', null);
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
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.error('You do not have permission to create Clustering job');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/clustering-jobs/new-clustering-job.html',
            controller: 'CreateNewClusteringJobCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.create) {
                JobsData.updateJobs();
                $scope.showRefreshBtn = true;
                notify.log("Your new clustering job is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };

    $scope.deleteClusteringJob = function(clusteringJob, $event) {
        $event.stopPropagation();
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.log('You do not have permission to delete Clustering job');
            return;
        }

        const modalInstance = $modal.open({
            templateUrl: '/app/analysis/clustering-jobs/delete-clustering-job.html',
            controller: 'DeleteClusteringJobCtrl as controller',
            resolve: {
                clusteringJob: function() {
                    return clusteringJob;
                },
            }
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error('Error: ' + ret.err);
            } else {
                const modArr = angular.copy($scope.clusteringJobsOriginal);
                const indx = modArr.findIndex(item => item.clustering_job_id === clusteringJob.clustering_job_id);
                if (indx > -1) {
                    $scope.clusteringJobsOriginal.splice(indx, 1);
                    notify.log('Clustering Job deleted successfully');
                }
            }
        });
    };
})

.controller('DeleteClusteringJobCtrl',
    function($scope, $modalInstance, a2ClusteringJobs, clusteringJob) {
        this.clusteringJob = clusteringJob;
        $scope.deletingloader = false;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2ClusteringJobs.delete(clusteringJob.clustering_job_id).then(function(data) {
                $modalInstance.close(data);
            });
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    }
)

//------------------- Clustering Details page ---------------

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
    $modal,
    a2UserPermit
) {
    var d3 = $window.d3
    $scope.loading = true;
    $scope.toggleMenu = false;
    $scope.selectedCluster = null;
    var timeout;
    $scope.frequencyFilter = {
      min: null, max: null, currentMin: null, currentMax: null
    }

    $scope.decrementClusters = function() {
        if ($scope.selectedCluster === 1) return
        $scope.selectedCluster -= 1;
        $scope.selectCluster();
    };
    $scope.incrementClusters = function() {
        if ($scope.selectedCluster === $scope.layout.shapes.length) return
        $scope.selectedCluster += 1;
        $scope.selectCluster();
    };
    // Select one cluster
    $scope.selectCluster = function() {
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
        var selectedAedList = Object.values(clusters)[$scope.selectedCluster - 1].aed
        if (selectedAedList && selectedAedList.length) {
          selectedAedList.forEach((item, ind) => { arr.push(ind) } )
        }
        return arr
    }

    var getClusteringDetails = function() {
        $scope.infopanedata = '';
        a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
            if (data) $scope.job_details = data;
        }).catch(err => {
            console.log(err);
        });
        // Get json file which is included aed_id, clusters names, x, y points.
        a2ClusteringJobs.getClusteringDetails({job_id: $scope.clusteringJobId}).then(function(res) {
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

    $scope.isEmpty = function() {
        return $scope.countAudioEventDetected !== undefined && $scope.countAudioEventDetected === 0 && !$scope.loading
    }

    $scope.aedsDetected = function() {
        if ($scope.countAudioEventDetected === undefined && $scope.loading) return ''
        if ($scope.countAudioEventDetected === undefined && !$scope.loading) return 'no data'
        return $scope.countAudioEventDetected
    }

    $scope.clustersDetected = function() {
        if ($scope.countClustersDetected === undefined && $scope.loading) return ''
        if ($scope.countClustersDetected === undefined && !$scope.loading) return 'no data'
        return $scope.countClustersDetected
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
            dragmode: 'lasso',
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
                color: 'white',
                title: 'Component 2',
                side: 'top'
            },
            yaxis: {
                color: 'white',
                title: 'Component 1',
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
            dragLayer = document.getElementsByClassName('nsewdrag')[0]
            $scope.xAxisRangeStart = $scope.layout.xaxis.range[0]
            // Hover on plotly
            el.on('plotly_hover', function(data){
                if ($scope.layout.dragmode === 'lasso') {
                    dragLayer.classList.add('lasso-cursor');
                }
            })
            // Zoom on plotly
            el.on('plotly_unhover', function(data){
                dragLayer.classList.remove('lasso-cursor');
            });
            el.on('plotly_relayouting', function(data){
                if (data['xaxis.range[0]'] > $scope.xAxisRangeStart) {
                    dragLayer.classList.remove('zoom-out-cursor');
                    dragLayer.classList.add('zoom-in-cursor');
                    $scope.xAxisRangeStart = data['xaxis.range[0]']
                }
                if (data['xaxis.range[0]'] < $scope.xAxisRangeStart) {
                    dragLayer.classList.remove('zoom-in-cursor');
                    dragLayer.classList.add('zoom-out-cursor');
                    $scope.xAxisRangeStart = data['xaxis.range[0]']
                }
            });
            el.on('plotly_relayout', function(data){
                dragLayer.classList.remove('zoom-out-cursor');
                dragLayer.classList.remove('zoom-in-cursor');
            });
            // Click on a point
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
                tempPlaylistData = {};
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
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.error('You do not have permission to manage AED and Clustering job');
            return;
        }
        a2Playlists.create(opts,
        function(data) {
            if (data && data.playlist_id) {
                $window.location.href = '/project/'+Project.getUrl()+'/visualizer/playlist/' + data.playlist_id + '?clusters';
            }
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
                    minPoints: 3,
                    distanceThreshold: 0.1,
                    maxClusterSize: 100
                }
            };

            this.timeout;

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
                    $modalInstance.close({create:true, clusteringModel: clusteringModel});
                }).bind(this));
            } catch(error) {
                this.loading.saving = false;
                console.error(error);
            }
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.loading.saving = false;
            }, 2000);

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

//------------------- Gid View page ---------------

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

.controller('ExportReportModalCtrl', function($scope, $modalInstance, a2ClusteringJobs, data) {
    $scope.userEmail = data.userEmail
    $scope.accessExportReport = function(email) {
        data.userEmail = email
        $scope.isExporting = true
        $scope.errMess = ''
        a2ClusteringJobs.exportClusteringROIs(data).then(data => {
            $scope.isExporting = false
            if (data.error) {
                $scope.errMess = data.error;
            }
            else {
                $modalInstance.close();
            }
        })
    }
    $scope.changedUserEmail = function() {
        $scope.errMess = null;
    }
})

.controller('GridViewCtrl' , function($scope, $http, a2UserPermit, a2ClusteringJobs, a2AudioBarService, a2AudioEventDetectionsClustering, Project, Songtypes, a2Playlists, notify, $modal, $localStorage) {
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
            {value:'per_date', text:'Sort per Date', description: 'Show all rois sorted per Date.'},
            {value:'per_species', text:'Sort per Species', description: 'Show all rois sorted per Species.'}
        ],
        validation: [
            { class:"fa val-1", text: 'Present', value: 1},
            { class:"fa val-0", text: 'Not Present', value: 0 },
            { class:"fa val-null", text: 'Clear', value: -1 },
        ],
    };
    $scope.validation = { status: $scope.lists.validation[2] };

    $scope.selectedFilterData = $scope.lists.search[1];
    
    $scope.playlistData = {};
    
    $scope.aedData = {
        count: 0,
        id: []
    };

    $scope.speciesLoading = false;
    $scope.selected = { species: null, songtype: null };
    var timeout;
    var isShiftKeyHolding = false;

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

    $localStorage.setItem('analysis.gridContext',  JSON.stringify($scope.gridContext));

    a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
        if (data) $scope.job_details = data;
    }).catch(err => {
        console.log(err);
    });

    $scope.onSearchChanged = function(item) {
        $scope.selectedFilterData = item;
        $scope.getRoisDetails(true).then(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                $scope.markBoxesAsSelected()
                $scope.updateInputState()
            }, 100)
        })
    }

    $scope.setCurrentPage = function() {
        this.paginationSettings.offset = $scope.paginationSettings.page - 1;
        $scope.getRoisDetails();
    };

    $scope.showPagination = function () {
        if ($scope.selectedFilterData.value === 'per_cluster') {
            return $scope.paginationSettings.totalItems && ($scope.gridData.length && $scope.gridData.length > 1)
        } else {
            return $scope.paginationSettings.totalItems && ($scope.paginationSettings.totalItems > $scope.paginationSettings.limit)
        }
    }

    $scope.getRoisDetails = function(isFilterChanged) {
        if (!$scope.aedData.id.length) {
            return $scope.getStatusForEmptyData();
        }
        $scope.rows = [];
        var aedData
        $scope.isRoisLoading = true;
        if (isFilterChanged) {
            $scope.paginationSettings.page = 1;
            $scope.paginationSettings.offset = 0;
        }
        if ($scope.selectedFilterData.value === 'per_cluster') {
            aedData = $scope.gridData[$scope.paginationSettings.page-1].aed;
            $scope.paginationSettings.totalItems = $scope.gridData.length;
            $scope.paginationSettings.limit = 1;
        } else {
            $scope.paginationSettings.limit = 100;
            $scope.paginationSettings.totalItems = $scope.aedData.id.length;
            aedData = $scope.aedData.id.filter((id, i, a) => {
                return (i >= ($scope.paginationSettings.offset * $scope.paginationSettings.limit)) && (i < ($scope.paginationSettings.page * $scope.paginationSettings.limit))
            })
        }
        return a2ClusteringJobs.getRoisDetails({
            jobId: $scope.clusteringJobId,
            aed: aedData,
            search: $scope.selectedFilterData.value
        }).then(function(data) {
            const groupedData = []
            Object.values($scope.gridData).forEach(cluster => {
                Object.entries(cluster).forEach(entry => {
                    if(entry[0] == "aed") {
                        entry[1].forEach(id => {
                            const matched = data.find(aed => aed.aed_id === id)
                            if (matched) {
                                matched.cluster = cluster.name
                                groupedData.push(matched)
                            }
                        })
                    }
                })
            })
            if ($scope.selectedFilterData.value === 'per_cluster') {
                $scope.paginationSettings.totalPages = $scope.gridData.length;
                $scope.paginationSettings.limit = 1;
            } else {
                $scope.paginationSettings.totalPages = Math.ceil($scope.paginationSettings.totalItems / $scope.paginationSettings.limit);
                $scope.paginationSettings.limit = 100;
            }
            $scope.loading = false;
            $scope.allRois = groupedData
            $scope.isRoisLoading = false;
            $scope.getRoisDetailsSegment();
            $scope.combineRoisPerCluster();
        }).catch(err => {
            console.log(err);
            $scope.getStatusForEmptyData();
        });
    }

    $scope.getRoisDetails();

    $scope.combineRoisPerCluster = function() {
        $scope.roisPerCluster = {};
        $scope.gridData.forEach((cluster) => {
            $scope.roisPerCluster[cluster.name] = cluster.aed;
        })
    }


    $scope.exportReport = function() {
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.error('You do not have permission to download Clustering details');
            return;
        }
        var params = {
            jobId: $scope.clusteringJobId,
            aed: $scope.aedData.id,
            cluster: $scope.roisPerCluster,
            search: $scope.selectedFilterData.value,
            userEmail: a2UserPermit.getUserEmail() || ''
        }
        if ($scope.selectedFilterData.value == 'per_site')  {
            params.perSite = true;
        }
        else if ($scope.selectedFilterData.value == 'per_date') {
            params.perDate = true;
        }
        else params.all = true;
        $scope.openExportPopup(params)
    }

    $scope.openExportPopup = function(listParams) {
        const modalInstance = $modal.open({
            controller: 'ExportReportModalCtrl',
            templateUrl: '/app/analysis/clustering-jobs/export-report.html',
            resolve: {
                data: function() {
                    return listParams
                }
            },
            backdrop: false
        });
        modalInstance.result.then(function() {
            notify.log('Your report export request is processing <br> and will be sent by email.');
        });
    };

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
                        species: [item]
                    }
                }
                else {
                    sites[item.site_id].species.push(item);
                }
            })
            const rows = Object.values(sites).map(site => {
                return { id: site.id, site: site.site, species: $scope.groupRoisBySpecies(site.species) }
            });
            $scope.rows = rows
        } else if (data && $scope.selectedFilterData.value === 'per_cluster') {
            $scope.ids = {};
            if($scope.aedData.count > 1) {
                var grids = []
                $scope.gridData.forEach((row) => { grids.push([row]) })
                grids.forEach((row, index) => {
                    $scope.ids[index] = {
                        id: row[0].cluster || row[0].name,
                        cluster: row[0].cluster || row[0].name,
                        species: $scope.groupRoisBySpecies(data, row[0].aed)
                    }
                })
            } else {
                $scope.ids[0] = {
                    id: $scope.gridData[0].cluster || $scope.gridData[0].name,
                    cluster: $scope.gridData[0].cluster || $scope.gridData[0].name,
                    species: $scope.groupRoisBySpecies(data)
                }
            }
            $scope.rows = Object.values($scope.ids);
        } else if (data && $scope.selectedFilterData.value === 'per_species') {
            var speciesObj = {};
            data.forEach((roi) => {
                if (!speciesObj[roi.species_id]) {
                    speciesObj[roi.species_id] = {
                        id: roi.species_id,
                        speciesName: roi.scientific_name,
                        species: [roi]
                    }
                }
                else {
                    speciesObj[roi.species_id].species.push(roi);
                }
            })
            const rows = Object.values(speciesObj).map(row => {
                return { id: row.id, speciesName: row.speciesName || 'Unvalidated ROIs', species: $scope.groupRoisBySpecies(row.species) }
            });
            $scope.rows = rows
        } else {
            if ($scope.selectedFilterData.value === 'per_date') {
                data.sort(function(a, b) {
                    return (a.date_created < b.date_created) ? 1 : -1;
                });
            }
            $scope.rows = [];
            $scope.rows.push({
                species: [{ rois: data }]
            });
        }
    }

    $scope.groupRoisBySpecies = function(data, aeds) {
        const rois = aeds ? data.filter((a, i) => {return aeds.includes(a.aed_id)}) : data
        var species = {};
        rois.forEach((item) => {
            const key = item.scientific_name ? item.scientific_name + '-' + item.songtype : 'Unvalidated ROIs'
            if (!species[key]) {
                species[key] = {
                    key: key,
                    rois: [item]
                }
            }
            else {
                species[key].rois.push(item);
            }
        })
        return Object.values(species);
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

    $scope.isValidationAccessible = function() {
        return a2UserPermit.can('manage AED and Clustering job')
    }

    $scope.setValidation = function() {
        if (!a2UserPermit.can('manage AED and Clustering job')) {
            notify.error('You do not have permission to manage AED and Clustering job');
            return;
        }
        if ($scope.validation.status.value === 1 && (!$scope.selected.species || !$scope.selected.songtype)) {
            notify.error('Please select Species and Song type <br> to validate ROIs with the Present validation');
            return;
        }
        if ($scope.validation.status.value === 0 && (!$scope.selected.species || !$scope.selected.songtype)) {
            notify.error('Please select Species and Song type <br> to validate ROIs with the Absent validation');
            return;
        }
        $scope.speciesLoading = true;
        var opts = {
            aed: $scope.selectedRois,
            validated: $scope.validation.status.value,
        }
        const isClearValidation = $scope.validation.status.value === -1
        opts.species_name = isClearValidation ? null : $scope.selected.species.scientific_name
        opts.songtype_name = isClearValidation ? null : $scope.selected.songtype.name
        opts.species_id = isClearValidation ? null : $scope.selected.species.id
        opts.songtype_id = isClearValidation ? null : $scope.selected.songtype.id
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            a2AudioEventDetectionsClustering.validate(opts).then(data => {
                console.info('Validation result', data)
                // Unselect and mark boxes with current validation without reloading the page
                $scope.markBoxesWithCurrentValidation()
                $scope.unselectBoxes()
                $scope.selectedRois = []
                if ($scope.validation.status.value === 1) {
                    notify.log('Audio event detections are validated as ' + $scope.selected.species.scientific_name + ' ' + $scope.selected.songtype.name);
                }
                $scope.selected = { species: null, songtype: null };
                $scope.updateInputState();
                $scope.getRoisDetails();
            }).finally(() => {
                $scope.speciesLoading = false;
            })
        }, 500)
    }

    $scope.markBoxesWithCurrentValidation = function() {
        $scope.rows.forEach(row => {
            row.species.forEach(cluster => {
                cluster.rois.forEach(roi => {
                    if ($scope.selectedRois.includes(roi.aed_id)) {
                        roi.validated = $scope.validation.status.value
                    }
                })
            })
        })
    }

    $scope.unselectBoxes = function() {
        $scope.rows.forEach(row => {
            row.species.forEach(cluster => {
                cluster.rois.forEach(roi => {
                    if (roi.selected) {
                        roi.selected = false
                    }
                })
            })
        })
    }

    $scope.markBoxesAsSelected = function() {
        $scope.rows.forEach(row => {
            row.species.forEach(cluster => {
                cluster.rois.forEach(roi => {
                    if ($scope.selectedRois.includes(roi.aed_id)) {
                        roi.selected = true
                    }
                })
            })
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

    var getSelectedDetectionIds = function () {
        $scope.rows.forEach(row => {
            row.species.forEach(cluster => {
                cluster.rois.forEach(roi => {
                    if (roi.selected === true && !$scope.selectedRois.includes(roi.aed_id)) {
                        $scope.selectedRois.push(roi.aed_id)
                    }
                    if (roi.selected === false && $scope.selectedRois.includes(roi.aed_id)) {
                        const index = $scope.selectedRois.findIndex(item => item === roi.aed_id)
                        $scope.selectedRois.splice(index, 1)
                    }
                })
            })
        })
        return $scope.selectedRois
    }

    $scope.selectCluster = function (cluster) {
        const isSelected = cluster.selected
        cluster.rois = cluster.rois.map(roi => {
            roi.selected = isSelected === true ? true : false
            return roi
        })
        $scope.selectedRois = getSelectedDetectionIds()
        $scope.updateInputState()
    }

    var getCombinedDetections = function () {
        var combinedDetections = []
        $scope.rows.forEach(row => {
            row.species.forEach(cluster => {
                combinedDetections = combinedDetections.concat(cluster.rois)
            })
        })
        return combinedDetections
    }

    // Selection with a shift key
    $scope.toggleDetection = function (event) {
        isShiftKeyHolding = event.shiftKey
        if (isShiftKeyHolding) {
            const combinedDetections = getCombinedDetections()
            const selectedDetectionIds = getSelectedDetectionIds()
            const firstInx = combinedDetections.findIndex(d => d.aed_id === selectedDetectionIds[0])
            const secondInx = combinedDetections.findIndex(det => det.aed_id === selectedDetectionIds[selectedDetectionIds.length-1])
            const arrayOfIndx = [firstInx, secondInx].sort((a, b) => a - b)
            const filteredDetections = combinedDetections.filter((_det, index) => index >= arrayOfIndx[0] && index <= arrayOfIndx[1])
            const ids = filteredDetections.map(det => det.aed_id)
            $scope.rows.forEach(row => {
                row.species.forEach(cluster => {
                    cluster.rois.forEach(roi => {
                        if (ids.includes(roi.aed_id)) {
                            roi.selected = true
                        }
                    })
                })
            })
        }
        $scope.selectedRois = getSelectedDetectionIds()
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            $scope.updateInputState()
        }, 100)
    }

    // Set cluster's input state
    $scope.updateInputState = function () {
        const inputs = document.querySelectorAll("[id^='inputCluster_']");
        if (!inputs.length) return
        var index = 0
        $scope.rows.forEach(row => {
            row.species.forEach(cluster => {
                const selectedRois = cluster.rois.filter(roi => roi.selected)
                if (!selectedRois.length) {
                    inputs[index].checked = false
                    inputs[index].indeterminate = false
                }
                else if (selectedRois.length === cluster.rois.length) {
                    inputs[index].indeterminate = false
                    inputs[index].checked = true
                }
                else {
                    inputs[index].checked = false
                    inputs[index].indeterminate = true
                }
                index++
            })
        })
    }
})
