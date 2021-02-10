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
.controller('ClusteringDetailsCtrl' , function(
    $scope,
    $state,
    a2ClusteringJobs,
    a2AudioEventDetectionsClustering,
    $window,
    Project,
    a2Playlists,
    $localStorage,
    $modal
) {
    $scope.loading = true;
    $scope.toggleMenu = false;
    $scope.infopanedata = '';
    $scope.selectedCluster = null;
    var timeout;
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
    $scope.selectClusters = function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if ($scope.selectedCluster !== null) {
                $("#plotly .select-outline").remove();
                $scope.layout.shapes.forEach((shape) => {
                    shape.line.color = shape.fillcolor;
                    shape.line['stroke-width'] = 1;
                });
                $scope.points = [];
                $scope.layout.shapes.forEach((shape, i) => {
                    if (i === $scope.selectedCluster - 1) {
                        $scope.layout.shapes[i].line.color = '#ffffff';
                        Plotly.relayout(document.getElementById('plotly'), {
                            '$scope.layout.shapes[i].line.color': '#ff0000',
                            '$scope.layout.shapes[i].line.stroke-width': 4
                        });
                        // collect all selected clusters' points indexes in the points array
                        $scope.points.push($scope.clusters[i].aed.map((_,i) => {return i}));
                        $scope.toggleMenu = true;
                        $scope.$apply();
                    }
                });
            }
        }, 2000);
    };
    var getClusteringDetails = function() {
        a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function(data) {
            if (data) $scope.job_details = data;
        }).catch(err => {
            console.log(err);
        });
        // get json file with clusters x, y points
        a2ClusteringJobs.getClusteringDetails($scope.clusteringJobId).then(function(res) {
            $scope.loading = false;
            if (res) {
                $scope.countAudioEventDetected = res.aed_id.length;
                // collect clusters
                $scope.clusters = {};
                res.cluster.forEach((item, i) => {
                    if (!$scope.clusters[item]) {
                        $scope.clusters[item] = {
                            x: [res.x_coord[i]],
                            y: [res.y_coord[i]],
                            aed: [res.aed_id[i]],
                            records: []
                        }
                    }
                    else {
                        $scope.clusters[item].x.push(res.x_coord[i]);
                        $scope.clusters[item].y.push(res.y_coord[i]);
                        $scope.clusters[item].aed.push(res.aed_id[i]);
                    }
                });
                a2AudioEventDetectionsClustering.getClusteredRecords(res.aed_id.length === 1 ?
                    {aed_id: res.aed_id} : {aed_id_in: res.aed_id})
                    .then(function(records) {
                        if (records && records.length) {
                            $scope.clusters.frequency = {
                                freq_low: [],
                                freq_high: []
                            };
                            records.forEach((record) => {
                                $scope.clusters.frequency.freq_low.push(record.freq_min);
                                $scope.clusters.frequency.freq_high.push(record.freq_max);
                                for (var c in $scope.clusters) {
                                    if ($scope.clusters[c] && $scope.clusters[c].aed && $scope.clusters[c].aed.length) {
                                        var item = $scope.clusters[c].aed.find(i => {return i === record.aed_id});
                                        if (item) {
                                            $scope.clusters[c].records.push(record);
                                        }
                                    }
                                }
                            });
                            $scope.frequencyFilter = {
                                min: Math.min.apply(null, $scope.clusters.frequency.freq_low),
                                max: Math.max.apply(null, $scope.clusters.frequency.freq_high)
                            };
                        }
                    }).catch(err => {
                        console.log(err);
                    });
                $scope.countClustersDetected = Object.keys($scope.clusters).length;
                drawClusteringPoints($scope.clusters);
            }
        }).catch(err => {
            console.log(err);
            $scope.loading = false;
            $scope.infopanedata = 'No data for clustering job found.';
        });
    };
    var drawClusteringPoints = function(clusters) {
        var el = document.getElementById('plotly');
        var d3 = Plotly.d3;
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
        $scope.layout = {
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
        $scope.layout.shapes.forEach((shape, i) => {
            var color = random_color();
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
            Plotly.newPlot(el, data, $scope.layout, config);
            // click on a point
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
            // select a group of points
            el.on('plotly_selected', function(data) {
                if (!data) {
                    $("#plotly .select-outline").remove();
                };
                $scope.resetSelect();
                console.log('plotly_selected', data);
                $scope.points = [];
                // collect selected points indexes in the points array
                if (data && data.points && data.points.length) {
                    data.points.forEach(point => {
                        var cluster = point.curveNumber;
                        if (!$scope.points[cluster]) {
                            $scope.points[cluster] = [];
                        };
                        $scope.points[cluster].push(point.pointNumber);
                    });
                    $scope.toggleMenu = true;
                    $scope.$apply();
                }
            });
        }
    };

    $scope.onGridViewSelected = function () {
        $scope.toggleMenu = false;
        $scope.selectedCluster = null;
        $scope.showViewGridPage = true;
        if ($scope.points.length) {
            $scope.gridContext = {};
            $scope.points.forEach((row, i) => {
                $scope.gridContext[i] = {
                    aed: $scope.originalData[i].aed.filter((a, i) => {
                        return row.includes(i);
                    })
                }
            })
        }
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
    $scope.showClustersInVisualizer = function () {
        if ($scope.points.length) {
            $scope.selectedClusters = {
                aed: []
            };
            Object.values($scope.points).forEach((row, i) => {
                $scope.originalData[i].aed.forEach((a, i) => {
                    if (row.includes(i)) {
                        $scope.selectedClusters.aed.push(a);
                    };
                })
            })
        }
        else {
            $scope.selectedClusters = $scope.originalData.find(shape => {
                return shape.x.includes($scope.points.x) && shape.y.includes($scope.points.y);
            });
        }
        // find related records
        if ($scope.selectedClusters && $scope.selectedClusters.aed && $scope.selectedClusters.aed.length) {
            // TO DO: filter recordings from clusters object.
            return a2AudioEventDetectionsClustering.getClusteredRecords($scope.selectedClusters.aed.length === 1 ?
                {aed_id: $scope.selectedClusters.aed} : {aed_id_in: $scope.selectedClusters.aed})
                .then(function(data) {
                    console.log('records', data);
                    if (data && data.length) {
                        // collect selected points to boxes
                        $scope.selectedClusters.boxes = {};
                        data.forEach(rec => {
                            var box = ['box', rec.time_min, rec.freq_min, rec.time_max, rec.freq_max].join(',');
                            if (!$scope.selectedClusters.boxes[rec.rec_id]) {
                                $scope.selectedClusters.boxes[rec.rec_id] = [box];
                            }
                            else {
                                $scope.selectedClusters.boxes[rec.rec_id].push(box);
                            }
                        })
                        // clear local storage
                        $scope.removeFromLocalStorage();
                        var tempPlaylistData = {};
                        tempPlaylistData.aed = $scope.selectedClusters.aed;
                        tempPlaylistData.boxes = $scope.selectedClusters.boxes;
                        console.log('boxes', $scope.selectedClusters.boxes);
                        // add related records to a playlist
                        var recIds = data
                            .map(rec => {
                                return rec.rec_id;
                            })
                            .filter((id, i, a) => a.indexOf(id) === i);
                        tempPlaylistData.playlist = {
                            id: 0,
                            name: 'cluster_' + recIds.join("_"),
                            recordings: recIds.filter((id, i, a) => a.indexOf(id) === i),
                            count: recIds.filter((id, i, a) => a.indexOf(id) === i).length
                        };
                        console.log('tempPlaylistData', tempPlaylistData);
                        $localStorage.setItem('analysis.clusters',  JSON.stringify(tempPlaylistData));
                        $window.location.href = '/project/'+Project.getUrl()+'/visualizer/playlist/0?clusters';
                    }
                }
            );
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
                    recording: $scope.clusters[0].records[0].rec_id,
                    frequency: $scope.frequencyFilter
                }; }
            }
        });

        modalInstance.result.then(function (result) {
            console.log('filter', result);
            if (!result) {
                return
            }
            var clusters = {};
            for (var c in $scope.clusters) {
                if ($scope.clusters[c].records) {
                    clusters[c] = {};
                    clusters[c].y = [];
                    clusters[c].x = [];
                    clusters[c].aed = [];
                    clusters[c].records = [];
                    $scope.clusters[c].records.forEach((rec, i) => {
                        if (rec.freq_min >= result.min && rec.freq_max <= result.max) {
                            clusters[c].y.push($scope.clusters[c].y[i]);
                            clusters[c].x.push($scope.clusters[c].x[i]);
                            clusters[c].aed.push($scope.clusters[c].aed[i]);
                            clusters[c].records.push($scope.clusters[c].records[i]);
                        }
                    });
                }
            }
            console.log('filtered clusters', clusters);
            $scope.countClustersDetected = Object.keys(clusters).length;
            $scope.countAudioEventDetected = Object.values(clusters)
                .map((cluster => {return cluster.aed.length}))
                .reduce(function(sum, current) {
                return sum + current;
            }, 0);
            drawClusteringPoints(clusters);
        });
    };
    getClusteringDetails();
})
.controller('a2ClusterFrequencyFilterModalController', function($scope, $modalInstance, data, Project) {
    console.log('a2ClusterFrequencyFilterModalController', data);
    $scope.filterData = {};
    $scope.filterData.max_freq = data.frequency.max;
    $scope.filterData.src="/api/project/"+Project.getUrl()+"/recordings/tiles/"+data.recording+"/0/0";

    $scope.has_previous_filter = true;
    $scope.frequency = data.frequency ? angular.copy(data.frequency) : {min:0, max: $scope.filterData.max_freq};

    $scope.remove_filter = function(){
        $modalInstance.close();
    };
    $scope.apply_filter = function(){
        $modalInstance.close($scope.frequency);
    };
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
.controller('GridViewCtrl' , function($scope, a2ClusteringJobs, a2AudioBarService, Project, a2Playlists, notify, $window) {
    $scope.loading = true;
    $scope.infopanedata = '';

    $scope.lists = {
        search: [
            {value:'all', text:'All', description: 'Show all matched rois.'},
            {value:'per_site', text:'Sort per Site', description: 'Show all rois ranked per Site.'},
            {value:'per_date', text:'Sort per Date', description: 'Show all rois sorted per Date.'}
        ]
    };
    $scope.search = $scope.lists.search[0];
    $scope.playlistData = {};
    $scope.aedData = {
        count: 0,
        id: []
    };
    if ($scope.gridContext && $scope.gridContext.aed) {
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

    $scope.onSearchChanged = function(value) {
        $scope.search.value = value;
        $scope.getRoisDetails();
    }

    $scope.getRoisDetails = function() {
        return a2ClusteringJobs.getRoisDetails({
            jobId: $scope.clusteringJobId,
            aed: $scope.aedData.id,
            search: $scope.search.value
        }).then(function(data) {
            $scope.loading = false;
            if (data && $scope.search.value === 'per_site') {
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
            }
            else {
                if ($scope.search.value === 'per_date') {
                    data.sort(function(a, b) {
                        return (a.date_created < b.date_created) ? 1 : -1;
                    });
                }
                $scope.rows = [];
                $scope.rows.push({
                    rois: data
                });
            }
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

    $scope.openRoiVisualizer = function(roi){
        var projecturl = Project.getUrl();
        var box = ['box', roi.time_min, roi.frequency_min, roi.time_max, roi.frequency_max].join(',');
        $window.location.href = roi ? '/visualizer/' + projecturl + '/visualizer/rec/' + roi.recording_id + '?a=' + box : '';
    };

    $scope.togglePopup = function() {
        $scope.isPopupOpened = !$scope.isPopupOpened;
        // collect seleted aed
        if ($scope.rows && $scope.rows.length) {
            $scope.selectedRois = {};
            $scope.rows.forEach(row => {
                row.rois.forEach(roi => {
                    if (roi.selected) {
                        if (!$scope.selectedRois[roi.recording_id]) {
                            $scope.selectedRois[roi.recording_id] = {
                                aed: [roi.aed_id]
                            }
                        }
                        else {
                            $scope.selectedRois[roi.recording_id].aed.push(roi.aed_id);
                        }
                    }
                })
            })
        }
    }

    $scope.isPlaylistDataValid = function() {
        return $scope.selectedRois && Object.keys($scope.selectedRois).length && $scope.playlistData.playlistName && $scope.playlistData.playlistName.trim().length > 0;
    }

    $scope.closePopup = function() {
        $scope.isPopupOpened = false;
    }

    $scope.savePlaylist = function() {
        if (Object.keys($scope.selectedRois).length) {
            $scope.isSavingPlaylist = true;
            var aeds = [];
            Object.values($scope.selectedRois).forEach(obj => {
                obj.aed.forEach(el=>{ aeds.push(el) })
            })
            // create playlist
            a2Playlists.create({
                playlist_name: $scope.playlistData.playlistName,
                params: Object.keys($scope.selectedRois),
                isManuallyCreated: true
            },
            function(data) {
                console.log('data', data);
                $scope.isSavingPlaylist = false;
                $scope.closePopup();
                 // attach aed to playlist
                if (data && data.playlist_id) {
                    a2Playlists.attachAedToPlaylist({
                        playlist_id: data.playlist_id,
                        aed: aeds
                    },
                    function(data) {
                        $scope.playlistData = {};
                        notify.log('Audio event detections are saved in the playlist.');
                    });
                }
            });
        }
    };
})
