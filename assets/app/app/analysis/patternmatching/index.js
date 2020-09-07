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
        url: '/patternmatching/:patternMatchingId??show',
        controller: 'PatternMatchingCtrl',
        templateUrl: '/app/analysis/patternmatching/list.html'
    });
})
.controller('PatternMatchingCtrl' , function($scope, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, notify, $q, a2PatternMatching, a2UserPermit, $state, $stateParams) {
    $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;

    $scope.getTemplateVisualizerUrl = function(template){
        var projecturl = Project.getUrl();
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
        return template ? "/project/"+projecturl+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
    },

    $scope.selectItem = function(patternmatchingId){
        $state.go('analysis.patternmatching', {
            patternMatchingId: patternmatchingId ? patternmatchingId : undefined
        });
    }

    $scope.loadPatternMatchings = function() {
        $scope.loading = true;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;

        return a2PatternMatching.list().then(function(data) {
            $scope.patternmatchingsOriginal = data;
            $scope.patternmatchingsData = data;
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
            $scope.infopanedata = "";

            if(data.length > 0) {
            } else {
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
.controller('PatternMatchingDetailsCtrl' , function($scope, $q, a2PatternMatching, a2Templates, a2UserPermit, Project, a2AudioBarService, notify, $anchorScroll, $document) {
    Object.assign(this, {
    id: null,
    initialize: function(patternMatchingId){
        this.id = patternMatchingId;
        this.offset = 0;
        this.limit = 100;
        this.selected = {roi_index:0, roi:null, page:0};
        this.siteIndex = [];
        this.total = {rois:0, pages:0};
        this.loading = {details: false, rois:false};
        this.validation = this.lists.validation[2];
        this.thumbnailClass = this.lists.thumbnails[0].value;
        this.search = this.lists.search[0];
        this.projecturl = Project.getUrl();
        this.fetchDetails().then((function(){
            this.loadSiteIndex();
            this.loadPage(this.selected.page);
        }).bind(this));
    },

    lists: {
        thumbnails: [
            { class:'fa fa-th-large', value:''},
            { class:'fa fa-th', value:'is-small'},
        ],
        search: [
            {value:'all', text:'All', description: 'Show all matched rois.'},
            {value:'present', text:'Present', description: 'Show all rois marked as present.'},
            {value:'not_present', text:'Not Present', description: 'Show all rois marked as not present.'},
            {value:'unvalidated', text:'Unvalidated', description: 'Show all rois without validation.'},
            {value:'best_per_site', text:'Best per Site', description: 'Show the best scored roi per site.'},
            {value:'best_per_site_day', text:'Best per Site, Day', description: 'Show the best scored roi per site and day.'},
            {value:'all_by_score', text:'All Sites, by Score', description: 'Show all sites, ordered by score.'},
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
        this.selected.page = 0;
        this.loadPage(0);
        this.loadSiteIndex();
    },

    setupExportUrl: function(){
        this.patternMatchingExportUrl = a2PatternMatching.getExportUrl({
            patternMatching: this.patternMatching.id,
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

    loadSiteIndex: function(){
        return a2PatternMatching.getSiteIndexFor(this.id, { search: this.search && this.search.value }).then((function(siteIndex){
            this.siteIndex = siteIndex;
        }).bind(this));
    },

    setSiteBookmark: function(site){
        var bookmark = 'site-' + site.site_id;
        var sitePage = (site.offset / this.limit) | 0;

        console.log({
            site:site,
            bookmark:bookmark,
            sitePage:sitePage,
        })
        this.setPage(sitePage).then(function(){
            $anchorScroll.yOffset = $('.a2-page-header').height() + 60;
            $anchorScroll(bookmark)
        });
    },

    loadPage: function(pageNumber){
        this.loading.rois = true;
        return a2PatternMatching.getRoisFor(
            this.id,
            this.limit,
            pageNumber * this.limit,
            { search: this.search && this.search.value }
        ).then((function(rois){
            this.loading.rois = false;
            this.rois = rois.reduce(function(_, roi){
                var site_id = roi.site_id;
                var sitename = roi.site;
                var recname = roi.recording;

                if(!_.idx[sitename]){
                    _.idx[sitename] = {list:[], idx:{}, name:sitename, id:site_id};
                    _.list.push(_.idx[sitename]);
                }

                var site = _.idx[sitename];
                site.list.push(roi);

                return _;
            }, {list:[], idx:{}}).list;
            this.selected.roi = Math.min()
            return rois;
        }).bind(this)).catch((function(err){
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
        return roi ? "/project/"+this.projecturl+"/#/visualizer/rec/"+roi.recording_id+"?a="+box : '';
    },

    getTemplateVisualizerUrl: function(template){
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
        return template ? "/project/"+this.projecturl+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
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
            this.selected.page = 0;
            this.rois = [];
            return $q.resolve(this.rois);
        } else {
            page = Math.max(0, Math.min(page, (this.total.rois / this.limit) | 0));
            if(page != this.selected.page || force){
                this.selected.page = page;
                return this.loadPage(page);
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
    },

    nextMatch: function(step) {
        return this.setRoi(this.selected.roi_index + (step || 1));
    },

    prevMatch: function (step) {
        return this.setRoi(this.selected.roi_index - (step || 1));
    },

    nextPage: function(step) {
        return this.setPage(this.selected.page + (step || 1));
    },

    prevPage: function(step) {
        return this.setPage(this.selected.page - (step || 1));
    },

    next: function(step) {
        if(!step){step = 1;}
        this.nextPage(step);
    },

    prev: function(step) {
        if(!step){step = 1;}
        return this.next(-step);
    },

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
                params: { N: 1, threshold: 0.7 },
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
