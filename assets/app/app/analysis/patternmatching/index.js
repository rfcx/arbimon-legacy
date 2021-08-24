angular.module('a2.analysis.patternmatching', [
    'ui.bootstrap',
    'a2.directive.audio-bar',
    'a2.srv.patternmatching',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.disabled-patternmatching', {
        url: '/disabled/patternmatching',
        templateUrl: '/app/analysis/patternmatching/disabled.html'
    });
    $stateProvider.state('analysis.patternmatching', {
        url: '/patternmatching',
        controller: 'PatternMatchingCtrl',
        templateUrl: '/app/analysis/patternmatching/list.html'
    });
    $stateProvider.state('analysis.patternmatching-details', {
        url: '/patternmatching/:patternMatchingId',
        controller: 'PatternMatchingCtrl',
        templateUrl: '/app/analysis/patternmatching/list.html'
    });
})
.controller('PatternMatchingCtrl' , function($scope, $modal, $filter, Project, JobsData, a2Playlists, $location, notify, $q, a2PatternMatching, a2UserPermit, $state, $stateParams) {
    $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;
    $scope.loading = {rows: false};

    $scope.getTemplateVisualizerUrl = function(template){
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
        return template ? "/project/"+template.source_project_uri+"/visualizer/rec/"+template.recording+"?a="+box : '';
    },

    $scope.selectItem = function(patternmatchingId){
        $scope.selectedPatternMatchingId = patternmatchingId;
            if (!patternmatchingId){
            $state.go('analysis.patternmatching', {});
        } else {
            $state.go('analysis.patternmatching-details', {
                patternMatchingId: patternmatchingId
            });
        }
    }


    $scope.loadPatternMatchings = function() {
        $scope.loading.rows = true;
        $scope.showInfo = true;
        $scope.splitAllSites = false;

        return a2PatternMatching.list({completed: true}).then(function(data) {
            $scope.patternmatchingsOriginal = data;
            $scope.patternmatchingsData = data;
            $scope.showInfo = false;
            $scope.loading.rows = false;
            $scope.infopanedata = "";

            if(data && !data.length) {
                $scope.infopanedata = "No pattern matchings found.";
            }
        });
    };

    $scope.createNewPatternMatching = function () {
        if(!a2UserPermit.can('manage pattern matchings')) {
            notify.log('You do not have permission to create pattern matchings');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/patternmatching/createnewpatternmatching.html',
            controller: 'CreateNewPatternMatchingInstanceCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.ok) {
                JobsData.updateJobs();
                notify.log("Your new pattern matching is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };

    $scope.deletePatternMatching = function(patternMatching, $event) {
        $event.stopPropagation();

        if(!a2UserPermit.can('manage pattern matchings')) {
            notify.log('You do not have permission to delete pattern matchings');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/patternmatching/deletepatternmatching.html',
            controller: 'DeletePatternMatchingInstanceCtrl as controller',
            resolve: {
                patternMatching: function() {
                    return patternMatching;
                },
            }
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error("Error: "+ret.err);
            } else {
                var index = -1;
                var modArr = angular.copy($scope.patternmatchingsOriginal);
                for (var i = 0; i < modArr.length; i++) {
                    if (modArr[i].id === id) {
                        index = i;
                        break;
                    }
                }
                if (index > -1) {
                    $scope.patternmatchingsOriginal.splice(index, 1);
                    notify.log("PatternMatching deleted successfully");
                }
            }
        });
    };

    if (!$scope.selectedPatternMatchingId) {
        $scope.loadPatternMatchings();
    }
})
.directive('a2PatternMatchingDetails', function(){
    return {
        restrict : 'E',
        replace: true,
        scope : {
            patternMatchingId: '=',
            onGoBack: '&',
        },
        controller : 'PatternMatchingDetailsCtrl',
        controllerAs: 'controller',
        templateUrl: '/app/analysis/patternmatching/details.html'
    };
})
.controller('PatternMatchingDetailsCtrl' , function($scope, $q, a2PatternMatching, a2Templates, a2UserPermit, Project, a2AudioBarService, notify, $anchorScroll, $window) {
    Object.assign(this, {
    id: null,
    initialize: function(patternMatchingId){
        this.id = patternMatchingId;
        this.offset = 0;
        this.limit = 100;
        this.selected = { roi_index: 0, roi: null, page: 1 };
        this.sitesList = [];
        this.sitesListBatchSize = 20;
        this.sitesBatches = [];
        this.total = {rois:0, pages:0};
        this.paginationTotal = 0;
        this.loading = {details: false, rois: true};
        this.validation = this.lists.validation[2];
        this.thumbnailClass = this.lists.thumbnails[0].value;
        this.search = this.lists.search[6];
        this.projecturl = Project.getUrl();
        this.fetchDetails()
            .then(function() {
                return this.loadSitesList();
            }.bind(this))
            .then(function() {
                return this.loadData(1);
            }.bind(this));
    },

    lists: {
        thumbnails: [
            { class:'fa fa-th-large', value:''},
            { class:'fa fa-th', value:'is-small'},
        ],
        search: [
            {value:'all', text:'All', description: 'Show all matched Region of Interest.'},
            {value:'present', text:'Present', description: 'Show all Region of Interest marked as present.'},
            {value:'not_present', text:'Not Present', description: 'Show all Region of Interest marked as not present.'},
            {value:'unvalidated', text:'Unvalidated', description: 'Show all Region of Interest without validation.'},
            {value:'best_per_site', text:'Best per Site', description: 'Show the best scored roi per site.'},
            {value:'best_per_site_day', text:'Best per Site, Day', description: 'Show the best scored roi per site and day.'},
            {value:'by_score', text:'Score', description: 'Show all Region of Interest ranked by score.'},
            {value:'by_score_per_site', text:'Score per Site', description: 'Show all Region of Interest ranked by score per site.'},
            {value:'top_200_per_site', text:'200 Top Scores per Site', description: 'Show Top 200 Region of Interest ranked by score per each site.'}
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
    },

    fetchDetails: function(){
        this.loading.details = true;
        return a2PatternMatching.getDetailsFor(this.id).then((function(patternMatching){
            this.loading.details = false;
            this.patternMatching = patternMatching;
            this.patternMatching.templateParameters = {
                'Threshold': this.patternMatching.parameters.threshold,
                'Matches/Recording': this.patternMatching.parameters.N,
                'Matches/Site': this.patternMatching.parameters.persite || 'no limit'
            };
            this.setupExportUrl();
            this.total = {
                rois: patternMatching.matches,
                pages: Math.ceil(patternMatching.matches / this.limit)
            }
        }).bind(this)).catch((function(err){
            this.loading.details = false;
            return notify.serverError(err);
        }).bind(this));
    },

    onSearchChanged: function(){
        this.selected.page = 1;
        this.recalculateSiteListBatch();
        this.loadData(1);
    },

    setupExportUrl: function(){
        this.patternMatchingExportUrl = a2PatternMatching.getExportUrl({
            patternMatching: this.patternMatching.id,
            jobName: this.patternMatching.name,
        });
    },

    onScroll: function($event, $controller){
        this.scrollElement = $controller.scrollElement;
        var scrollPos = $controller.scrollElement.scrollY;
        var headerTop = $controller.anchors.header.offset().top;

        this.headerTop = headerTop | 0;
        this.scrolledPastHeader = scrollPos >= headerTop;
    },

    onSelect: function($item){
        this.select($item.value);
    },

    loadSitesList: function() {
        return a2PatternMatching.getSitesListFor(this.id)
            .then(function (list) {
                this.sitesList = list;
                this.sitesTotal = this.sitesBatches.length
                this.splitSitesListIntoBatches();
            }.bind(this))
    },

    splitSitesListIntoBatches: function () {
        var batches = [];
        for (var i = 0; i< this.sitesList.length; i += this.sitesListBatchSize) {
            batches.push(this.sitesList.slice(i, i + this.sitesListBatchSize));
        }
        this.sitesBatches = batches
    },

    recalculateTotalItems: function () {
        var search = this.search && this.search.value ? this.search.value : undefined;
        switch (search) {
            case 'present':
                this.paginationTotal = this.patternMatching.present;
                break;
            case 'not_present':
                this.paginationTotal = this.patternMatching.absent;
                break;
            case 'by_score':
                this.paginationTotal = this.patternMatching.matches;
                break;
            default:
                this.paginationTotal = 0
        }
    },

    recalculateSiteListBatch: function () {
        var search = this.search && this.search.value ? this.search.value : undefined;
        var shouldRecalculate = false
        if (['all', 'unvalidated', 'top_200_per_site', 'by_score_per_site'].includes(search)) {
            if (this.sitesListBatchSize !== 1) {
                shouldRecalculate = true
            }
            this.sitesListBatchSize = 1;
        } else if (['best_per_site', 'best_per_site_day'].includes(search)) {
            if (this.sitesListBatchSize !== 20) {
                shouldRecalculate = true
            }
            this.sitesListBatchSize = 20;
        }
        if (shouldRecalculate) {
            this.splitSitesListIntoBatches();
        }
    },

    setSiteBookmark: function(site) {
        if (this.shouldGetPerSite()) {
            this.selected.page = this.getSiteBatchIndexBySiteId(site.site_id) + 1
            return this.loadData();
        }
        var bookmark = 'site-' + site.site_id;
        $anchorScroll.yOffset = $('.a2-page-header').height() + 60;
        $anchorScroll(bookmark)
    },

    shouldGetPerSite: function() {
        return this.search && ['all', 'unvalidated', 'top_200_per_site', 'best_per_site', 'best_per_site_day', 'by_score_per_site'].includes(this.search.value);
    },

    getSiteBatchIndexBySiteId: function (siteId) {
        if (!this.sitesBatches || !this.sitesBatches.length) {
            return undefined
        }
        return this.sitesBatches.findIndex(function (batch) {
            return !!batch.find(function (site) {
                return site.site_id === siteId
            })
        })
    },

    getSiteBatchBySiteId: function (siteId) {
        const batchIndex = this.getSiteBatchIndexBySiteId(siteId);
        if (batchIndex === undefined) {
            return undefined
        }
        return this.sitesBatches[batchIndex]
    },

    getSiteBatchByPageNumber: function (page) {
        if (!this.sitesBatches || !this.sitesBatches.length) {
            return undefined
        }
        return this.sitesBatches[page - 1]
    },

    combOpts: function (data) {
        var search = this.search && this.search.value ? this.search.value : undefined
        var opts = { search: search };
        if (data.site) {
            opts.site = data.site;
        }
        if (data.sites) {
            opts.sites = data.sites
        }
        var limit, offset;
        switch (search) {
            case 'top_200_per_site':
                limit = 200;
                offset = 0
                break;
            case 'best_per_site':
                limit = 1;
                offset = 0
                break;
            case 'all':
            case 'unvalidated':
            case 'by_score_per_site':
                limit = 100000000;
                offset = 0;
                break;
            default:
                limit = this.limit
                offset = (data.pageNumber - 1) * this.limit
        }
        return {
            limit: limit,
            offset: offset,
            opts: opts
        }
    },

    parseRoisResult: function (rois) {
        var search = this.search && this.search.value ? this.search.value : undefined
        this.splitAllSites = search === 'by_score';
        if (this.splitAllSites) {
            return [{ list: rois }]
        }
        else {
            return  rois.reduce(function(_, roi){
                var site_id = roi.site_id;
                var sitename = roi.site;

                if(!_.idx[sitename]){
                    _.idx[sitename] = {list:[], idx:{}, name:sitename, id:site_id};
                    _.list.push(_.idx[sitename]);
                }

                var site = _.idx[sitename];
                site.list.push(roi);

                return _;
            }, { list:[], idx:{} }).list;
        }
    },

    loadData: function (page) {
        var params;
        if (this.shouldGetPerSite()) {
            page = page || this.selected.page
            var siteBatch = this.getSiteBatchByPageNumber(page)
            var siteIds = siteBatch.map(function(s) {
                return s.site_id;
            })
            params = this.combOpts({ sites: siteIds });
        } else {
            params = this.combOpts({ pageNumber: this.selected.page });
        }
        this.rois = [];
        this.loading.rois = true;
        return a2PatternMatching.getRoisFor(this.id, params.limit, params.offset, params.opts)
            .then(function (rois) {
                this.loading.rois = false;
                this.rois = this.parseRoisResult(rois);
                this.selected.roi = Math.min();
                this.recalculateTotalItems();
            }.bind(this))
            .catch((function(err){
                this.loading.rois = false;
                return notify.serverError(err);
            }).bind(this));
    },

    playRoiAudio: function(roi, $event){
        if($event){
            $event.preventDefault();
            $event.stopPropagation();
        }
        a2AudioBarService.loadUrl(a2PatternMatching.getAudioUrlFor(roi), true);
    },

    playTemplateAudio: function(){
        a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(this.patternMatching.template), true);
    },

    getRoiVisualizerUrl: function(roi){
        var box = ['box', roi.x1, roi.y1, roi.x2, roi.y2].join(',')
        return roi ? "/project/"+this.projecturl+"/visualizer/rec/"+roi.recording_id+"?a="+box : '';
    },

    getTemplateVisualizerUrl: function(template){
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
        return template ? "/project/"+template.source_project_uri+"/visualizer/rec/"+template.recording+"?a="+box : '';
    },

    setRoi: function(roi_index){
        if(this.total.rois <= 0){
            this.selected.roi_index = 0;
            this.selected.roi = null;
        } else {
            this.selected.roi_index = Math.max(0, Math.min(roi_index | 0, this.total.rois - 1));
            this.selected.roi = this.rois[this.selected.roi_index];
        }
        return this.selected.roi;
    },

    setPage: function(page, force){
        if(this.total.rois <= 0){
            this.selected.page = 1;
            this.rois = [];
            return $q.resolve(this.rois);
        } else {
            if(page != this.selected.page || force){
                this.selected.page = page;
                return this.loadData(page);
            }
        }

        return $q.resolve();
    },

    select: function(option){
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

        this.forEachRoi(selectFn);
    },

    forEachRoi: function(fn){
        (this.rois || []).forEach(function(site){
            site.list.forEach(fn);
        });
    },

    validate: function(validation, rois){
        if(!a2UserPermit.can('validate pattern matchings')) {
            notify.log('You do not have permission to validate the matched rois.');
            return;
        }

        if (validation === undefined){
            validation = (this.validation || {value:null}).value;
        }

        if (rois === undefined){
            rois = []
            this.forEachRoi(function (roi){
                if(roi.selected){
                    rois.push(roi);
                }
            });
        }
        var roiIds = rois.map(function(roi){ return roi.id; })
        var val_delta = {0:0, 1:0, null:0};
        return a2PatternMatching.validateRois(this.id, roiIds, validation).then((function(){
            rois.forEach(function(roi){
                val_delta[roi.validated] -= 1;
                val_delta[validation] += 1;

                roi.validated = validation;
                roi.selected = false;
            });
            this.patternMatching.absent += val_delta[0];
            this.patternMatching.present += val_delta[1];
        }).bind(this));
    }

}); this.initialize($scope.patternMatchingId);
})
.controller('DeletePatternMatchingInstanceCtrl',
    function($scope, $modalInstance, a2PatternMatching, patternMatching) {
        this.patternMatching = patternMatching;
        $scope.deletingloader = false;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2PatternMatching.delete(patternMatching.id).then(function(data) {
                $modalInstance.close(data);
            });
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    }
)
.controller('CreateNewPatternMatchingInstanceCtrl', function($scope, $modalInstance, a2PatternMatching, a2Templates, a2Playlists, notify) {
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
                params: { N: 1, threshold: 0.1 },
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
