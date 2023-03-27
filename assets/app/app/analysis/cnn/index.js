angular.module('a2.analysis.cnn', [
    'ui.bootstrap',
    'a2.directive.audio-bar',
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
    console.log("CNN Version 1.0");
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
                    initTable(1,10,"-timestamp",{},data.length);
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
        if(!a2UserPermit.can('manage cnns')) {
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

    $scope.deleteCNN = function(cnn, $event) {
        $event.stopPropagation();

        if(!a2UserPermit.can('manage cnns')) {
            notify.log('You do not have permission to delete cnns.');
            return;
        }


        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/cnn/deletecnn.html',
            controller: 'DeleteCNNInstanceCtrl as controller',
            resolve: {
                cnn: function() {
                    return cnn;
                },
            }
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error("Error: "+ret.err);
            } else {
                notify.log("CNN: (" + cnn.name + ") deleted successfully");
                $scope.loadCNNs();
                /*
                var index = -1;
                var modArr = angular.copy($scope.cnnOriginal);
                for (var i = 0; i < modArr.length; i++) {
                    if (modArr[i].job_id === cnn.job_id) {
                        index = i;
                        break;
                    }
                }
                if (index > -1) {
                    $scope.cnnOriginal.splice(index, 1);
                    notify.log("CNN deleted successfully");
                }
                */
            }
        });
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
.controller('DeleteCNNInstanceCtrl',
    function($scope, $modalInstance, a2CNN, cnn, Project) {
        this.cnn = cnn;
        $scope.project_name = Project.getUrl();
        $scope.deletingloader = false;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2CNN.delete(cnn.job_id).then(function(data) {
                $modalInstance.close(data);
            });
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    }
)
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
                console.error("a2CNN.create error: " + error);
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
.controller('CNNDetailsCtrl' , function($scope, $state, ngTableParams, a2AudioPlayer, $filter, a2CNN, a2UserPermit, Project, a2AudioBarService, notify) {

    var projecturl = Project.getUrl();

    $scope.lists = {
        thumbnails: [
            { class:'fa fa-th-large', value:''},
            { class:'fa fa-th', value:'is-small'},
        ],
        search: [
            {value:'all', text:'All', description: 'Show all matched rois.'},
            {value:'present', text:'Present', description: 'Show all rois marked as present.'},
            {value:'not_present', text:'Not Present', description: 'Show all rois marked as not present.'},
            {value:'unvalidated', text:'Unvalidated', description: 'Show all rois without validation.'},
            {value:'by_score', text:'Score per Species', description: 'Show rois ranked by score per species.'},
            {value:'by_score_per_site', text:'Score per Site', description: 'Show rois ranked by score per site.'}
        ],
        selection: [
            {value:'all', text:'All'},
            {value:'none', text:'None'},
            {value:'not-validated', text:'Not Validated'},
        ],
        validation: [
            { class:"fa val-1", text: "Present", value: 1},
            { class:"fa val-0", text: "Not Present", value: 0 },
            { class:"fa val-null", text: "Clear", value: null },
        ],
        current: {
            thumbnailClass: 'is-small'
        }
    };

    $scope.total = {rois:0, pages:0};
    $scope.selected = {roi_index:0, roi:null, page:0, search: $scope.lists.search[4]};
    $scope.validation = {current: $scope.lists.validation[2]};
    $scope.offset = 0;
    $scope.limit = 100;
    //$scope.viewType = "species";

    var setupExportUrl = function() {
        $scope.CNNExportUrl = a2CNN.getExportUrl({
            cnnId: $scope.cnnId
        });
    }

    $scope.exportCnnReport = function($event) {
        $event.stopPropagation();
        if (a2UserPermit.isSuper()) return setupExportUrl()
        if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
            return notify.log('You do not have permission to export CNN data');
        } else return setupExportUrl()
    }

    var audio_player = new a2AudioPlayer($scope);

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

    $scope.onSelect = function(item) {
        $scope.select(item.value);
    };

    $scope.select = function(option) {
        var selectFn = null;
        if(option === "all"){
            selectFn = function(roi){roi.selected = true;};
        } else if(option === "none"){
            selectFn = function(roi){roi.selected = false;};
        } else if(option === "not-validated"){
            selectFn = function(roi){roi.selected = roi.validated === null;};
        } else {
            selectFn = function(roi){roi.selected = roi.id === option;};
        }
        ($scope.resultsROIs || []).forEach(selectFn);
    };

    var refreshDetails = function() {
        a2CNN.getDetailsFor($scope.cnnId).then(function(data) {
            $scope.job_details = data;
        });
    };
    refreshDetails();

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

    var byROIs = function(dataIn, thresh) {
        if (!thresh) {
            thresh = 0.9;
        }
        var dataOut = [];
        dataIn.forEach(function(element) {
            element.over_thresh = element.score >= thresh;
            element.present = element.over_thresh;
            dataOut.push(element);
        });
        dataOut.sort(function(a, b) {
            return (a.score < b.score) ? 1 : -1;
        });
        return dataOut;
    }

    var byROIsbySpecies = function(dataIn, bySite) {
        dataOut = {};
        dataIn.forEach(function(element) {
            var s = bySite? element.site : (element.species_id + '_' + element.songtype_id);
            if (!(s in dataOut)) {
                dataOut[s] = {count: 0,
                              species_id: element.species_id,
                              songtype_id: element.songtype_id,
                              scientific_name: element.scientific_name,
                              songtype: element.songtype,
                              rois: []};
                if (bySite) dataOut[s].site = element.site;
            }
            dataOut[s].rois.push(element);
            dataOut[s].count++;
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
        speciesName = 'All'; //fix this... ugh
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

    $scope.getRoiVisualizerUrl = function(roi){
        var box = ['box', roi.x1, roi.y1, roi.x2, roi.y2].join(',')
        return roi ? "/project/"+projecturl+"/#/visualizer/rec/"+roi.recording_id+"?a="+box : '';
    };

    $scope.getTemplateVisualizerUrl = function(template){
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
        return template ? "/project/"+projecturl+"/visualizer/rec/"+template.recording+"?a="+box : '';
    };

    $scope.playRoiAudio = function(roi, $event){
        if($event){
            $event.preventDefault();
            $event.stopPropagation();
        }
        a2AudioBarService.loadUrl(a2CNN.getAudioUrlFor(roi), true);
    };


    $scope.setPage = function(page, force){
        page = Math.max(0, Math.min(page, ($scope.total.rois / $scope.limit) | 0));
        if(page != $scope.selected.page || force){
            $scope.selected.page = page;
            $scope.offset = page * $scope.limit;
            loadROIPage();
        }

    };
    $scope.moveROIPage = function(n){
        var nextPage = $scope.selected.page + n;
        if (nextPage > $scope.total.pages - 1){
            $scope.setPage(0);
        }else if (nextPage < 0){
            $scope.setPage($scope.total.pages - 1);
        }else {
            $scope.setPage(nextPage);
        }
    };

    $scope.setSpecies = function(species) {
        $scope.selected.species = species;
        $scope.selected.page = 0;
        $scope.offset = 0;

        var site_name  = "site_" + $scope.selected.site.site_id + "_" + $scope.selected.site.name;
        if ($scope.selected.site.site_id==0) {
            site_name = 0;
        }
        $scope.counts.roi_species_counts = getSpeciesCounts(site_name, $scope.roi_species_sites_counts);
        $scope.counts.roi_sites_counts = getSitesCounts($scope.selected.species.species_id, $scope.roi_species_sites_counts);
        var count_all_species = $scope.counts.roi_species_counts.reduce(function(count, current){
            return count = count + current.N;
        }, 0);
        all_species = {species_id: 0, N: count_all_species, scientific_name: "All Species"};
        $scope.counts.roi_species_counts.unshift(all_species);
        var count_all_sites = $scope.counts.roi_sites_counts.reduce(function(count, current){
            return count = count + current.N;
        }, 0);
        var all_site = {site_id: 0, N: count_all_sites, name: "All Sites"};
        $scope.counts.roi_sites_counts.unshift(all_site);
        $scope.selected.site = $scope.counts.roi_sites_counts.find(function(element) {
            return element.site_id == $scope.selected.site.site_id;
        });
        $scope.selected.species = $scope.counts.roi_species_counts.find(function(element) {
            return element.species_id == $scope.selected.species.species_id;
        });
        //$scope.counts.roi_sites_counts.unshift($scope.selected.site);
        //$scope.selected.site = all_site;
        $scope.total = {
            rois: species.N,
            pages: Math.ceil(species.N / $scope.limit)
        };
        loadROIPage();
    };

    $scope.counts = {};
    $scope.setSite = function(site) {
        $scope.selected.site = site;
        $scope.selected.page = 0;
        $scope.offset = 0;
        var site_name  = "site_" + $scope.selected.site.site_id + "_" + $scope.selected.site.name;
        if ($scope.selected.site.site_id==0) {
            site_name = 0;
        }
        $scope.counts.roi_species_counts = getSpeciesCounts(site_name, $scope.roi_species_sites_counts);
        $scope.counts.roi_sites_counts = getSitesCounts($scope.selected.species.species_id, $scope.roi_species_sites_counts);
        var count_all_species = $scope.counts.roi_species_counts.reduce(function(count, current){
            return count = count + current.N;
        }, 0);
        all_species = {species_id: 0, N: count_all_species, scientific_name: "All Species"};
        $scope.counts.roi_species_counts.unshift(all_species);
        //$scope.counts.roi_species_counts.unshift($scope.selected.species);
        var count_all_sites = $scope.counts.roi_sites_counts.reduce(function(count, current){
            return count = count + current.N;
        }, 0);
        var all_site = {site_id: 0, N: count_all_sites, name: "All Sites"};
        $scope.counts.roi_sites_counts.unshift(all_site);

        $scope.selected.species = $scope.counts.roi_species_counts.find(function(element) {
            return element.species_id == $scope.selected.species.species_id;
        });
        $scope.selected.site = $scope.counts.roi_sites_counts.find(function(element) {
            return element.site_id == $scope.selected.site.site_id;
        });

        $scope.total = {
            rois: site.N,
            pages: Math.ceil(site.N / $scope.limit)
        };
        loadROIPage();
    };

    var loadROIPage = function() {
        $scope.loading = true;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;

        a2CNN.listROIs($scope.cnnId, $scope.limit, $scope.offset, $scope.selected.species.species_id, $scope.selected.site.site_id, $scope.selected.search.value).then(function(data) {

            $scope.resultsROIs = data;
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
            $scope.infopanedata = "";
            $scope.rois = byROIs($scope.resultsROIs);
            $scope.rois_species = byROIsbySpecies($scope.rois, $scope.selected.search.value === 'by_score_per_site');
        });
    };

    $scope.validate = function(){
        if(!a2UserPermit.can('validate cnn rois')) {
            notify.log('You do not have permission to validate the cnn rois.');
            return;
        }

        var validation = ($scope.validation.current || {value:null}).value;

        var rois = []
        for (var species in $scope.rois_species) {
            $scope.rois_species[species].rois.forEach(function (roi){
                if(roi.selected){
                    rois.push(roi);
                }
            });
        }

        var roiIds = rois.map(function(roi){ return roi.cnn_result_roi_id; })

        try {
            a2CNN.validateRois($scope.cnnId, roiIds, validation).then(function(response){
                rois.forEach(function(roi){
                    roi.validated = validation;
                    roi.selected = false;
                });
                //loadROIPage();
            });
        } catch(error) {
            console.error("TCL: $scope.validate -> error", error)
        }
        refreshDetails();
    };

    //$scope.calcWidth = function(roi) {

    //};

    $scope.onScroll = function($event, $controller){
        this.scrollElement = $controller.scrollElement;
        var scrollPos = $controller.scrollElement.scrollY;
        var headerTop = $controller.anchors.header.offset().top;

        this.headerTop = headerTop | 0;
        this.scrolledPastHeader = scrollPos >= headerTop;
    }

    var getSpeciesCounts = function(site, species_sites_matrix) {
        if (site==0) {
            site = 'total'
        }
        var roi_species_counts = [];
        species_sites_matrix.forEach(function(species) {
            roi_species_counts.push({species_id: species.species_id, N: species[site], scientific_name: species.scientific_name})
        })
        return roi_species_counts;
    };

    var getSitesCounts = function(species, species_sites_matrix) {
        if (species==0) {
            species = 'total'
        }
        var roi_site_counts = [];
        species_sites_matrix.forEach(function(s) {
            if (species=='total' | s.species_id == species) {
                for (key in s) {
                    split = key.split("_");
                    site_id = split[1];
                    name = split.slice(2).join("_");

                    if (split[0] == "site") {
                        row = {};
                        row.site_id = site_id;
                        row.N = s[key];
                        row.name = name;
                        roi_site_counts.push(row);
                    }
                }
            }
        })
        if (species=='total') {
            roi_site_counts_dict = roi_site_counts.reduce(function(sitesAcc, site) {

                if (!(site.site_id in sitesAcc)) {
                    sitesAcc[site.site_id] = {site_id: site.site_id, N: 0, name: site.name};
                }
                sitesAcc[site.site_id].N += site.N;
                return sitesAcc;
            }, {})
            roi_site_counts = Object.values(roi_site_counts_dict);
        }
        return roi_site_counts;
    };

    $scope.onSearchChanged = function(){
        $scope.switchView("rois");
    }
    $scope.switchView = function(viewType, specie) {
        if (specie) {
            window.scrollTo(0,0);
        }
        var sortBy = "-cnn_presence_id";
        var loadSwitch = function(){
            if (viewType=="species") {
                $scope.species = bySpecies($scope.results);
                $scope.viewType = "species";
                sortBy = "-scientific_name";
                $scope.showHist(specie ? specie : "all");
                $scope.cnnOriginal = Object.values($scope.species);
            } else if (viewType=="recordings") {
                $scope.recordings = byRecordings($scope.results);
                $scope.counts.recordings = Object.keys($scope.recordings).length;
                $scope.viewType = "recordings";
                sortBy = "-recording_id";
                $scope.cnnOriginal = Object.values($scope.recordings);
            } else {
                $scope.viewType = "all";
                $scope.mainResults = $scope.results;
                $scope.cnnOriginal = Object.values($scope.results);
            }

            if($scope.cnnOriginal.length > 0) {
                initTable(1,10,sortBy,{},$scope.cnnOriginal.length);
            } else {
                $scope.infopanedata = "No cnn results found.";
            }
        };
        if (viewType=="rois") {

            a2CNN.countROIsBySpeciesSites($scope.cnnId, {search: $scope.selected.search.value}).then(function(response) {
                var data = response.data;
                $scope.roi_species_sites_counts = data;

                $scope.counts.roi_species_counts = getSpeciesCounts($scope.selected.site ? $scope.selected.site.site_id : 0, $scope.roi_species_sites_counts);
                $scope.counts.roi_sites_counts = getSitesCounts($scope.selected.species ? $scope.selected.species.species_id : 0, $scope.roi_species_sites_counts);

                var count_all = $scope.counts.roi_species_counts.reduce(function(count, current){
                    return count = count + current.N;
                }, 0);

                var all_species = {species_id: 0, N: count_all, scientific_name: "All Species"};
                $scope.counts.roi_species_counts.unshift(all_species);
                if (!$scope.selected.species){
                    $scope.selected.species = all_species;
                } else{
                    $scope.selected.species = $scope.counts.roi_species_counts.find(function (element){
                        return (element.species_id == $scope.selected.species.species_id);
                    }) || all_species;
                }

                var all_sites = {site_id: 0, N: count_all, name: "All Sites"};
                $scope.counts.roi_sites_counts.unshift(all_sites);
                if (!$scope.selected.site){
                    $scope.selected.site = all_sites;
                } else{
                    $scope.selected.site = $scope.counts.roi_sites_counts.find(function (element){
                        return (element.site_id == $scope.selected.site.site_id);
                    }) || all_sites;
                }
                $scope.total = {
                    rois: count_all,
                    pages: Math.ceil(count_all / $scope.limit)
                };
                $scope.viewType = "rois";
                loadROIPage();
            });
            //$scope.viewType = "rois";
            //if (!$scope.resultsROIs) {
            //    loadROIPage();
            //} else {
            //    $scope.rois = byROIs($scope.resultsROIs);
            //    $scope.rois_species = byROIsbySpecies($scope.rois);
            //}
        } else if (!$scope.results){
            $scope.loading = true;
            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;
            a2CNN.listResults($scope.cnnId).then(function(data) {
                $scope.results = data;
                $scope.infoInfo = "";
                $scope.showInfo = false;
                $scope.loading = false;
                $scope.infopanedata = "";
                $scope.switchView('rois');
                //loadSwitch();
            });
        } else {
            loadSwitch();
        }
    };
    $scope.switchView($state.params.detailType ? $state.params.detailType : 'all');
});
