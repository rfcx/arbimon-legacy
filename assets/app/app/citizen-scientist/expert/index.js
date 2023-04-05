angular.module('a2.citizen-scientist.expert', [
    'ui.bootstrap',
    'a2.srv.patternmatching',
    'a2.srv.citizen-scientist',
    'a2.srv.citizen-scientist-expert',
    'a2.visualizer.audio-player',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.expert', {
        url: '/expert/:patternMatchingId?',
        controller: 'CitizenScientistExpertCtrl',
        templateUrl: '/app/citizen-scientist/expert/list.html'
    });
})
.controller('CitizenScientistExpertCtrl' , function($scope, $filter, Project, ngTableParams, a2Playlists, notify, $q, a2CitizenScientistService, a2CitizenScientistExpertService, a2PatternMatching, a2UserPermit, $state, $stateParams) {
    $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;

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
                var filteredData = params.filter() ? $filter('filter')($scope.patternmatchingsOriginal , params.filter()) : $scope.patternmatchingsOriginal;

                var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.patternmatchingsOriginal;

                params.total(orderedData.length);

                $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

                if (orderedData.length < 1) {
                    $scope.infopanedata = "No Pattern matchings searches found.";
                }

                $scope.patternmatchingsData  = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
            }
        });
    };

    $scope.getTemplateVisualizerUrl = function(template){
        var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
        return template ? "/project/"+template.source_project_uri+"/visualizer/rec/"+template.recording+"?a="+box : '';
    },

    $scope.selectItem = function(patternmatchingId){
        $state.go('citizen-scientist.expert', {
            patternMatchingId: patternmatchingId ? patternmatchingId : undefined
        });
    }

    $scope.loadPatternMatchings = function() {
        $scope.loading = true;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;

        return a2CitizenScientistExpertService.getPatternMatchings().then(function(data) {
            $scope.patternmatchingsOriginal = data;
            $scope.patternmatchingsData = data;
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
                $scope.infopanedata = "No pattern matchings found.";
            }
        });
    };

    if (!$scope.selectedPatternMatchingId) {
        $scope.loadPatternMatchings();
    }
})
.directive('a2CitizenScientistExpertDetails', function(){
    return {
        restrict : 'E',
        replace: true,
        scope : {
            patternMatchingId: '=',
            onGoBack: '&',
        },
        controller : 'CitizenScientistExpertDetailsCtrl',
        controllerAs: 'controller',
        templateUrl: '/app/citizen-scientist/expert/details.html'
    };
})
.filter('pmValidation', function(){
    return function(validation, cp, cnp){
        if (validation == 1) {
            return 'present';
        } else if (validation == 0) {
            return 'not present';
        } else if (validation === null || validation === undefined) {
            if (cp > 0 && cnp > 0) {
                return 'conflicted';
            } else {
                return '---';
            }
        }
    }
})
.controller('CitizenScientistExpertDetailsCtrl' , function($scope, a2PatternMatching, a2Templates, a2CitizenScientistExpertService, a2UserPermit, Project, a2AudioBarService, notify) {
    Object.assign(this, {
    id: null,
    initialize: function(patternMatchingId){
        this.id = patternMatchingId;
        this.offset = 0;
        this.limit = 100;
        this.selected = {roi_index:0, roi:null, page:0};
        this.total = {rois:0, pages:0};
        this.loading = {details: false, rois:false};
        this.validation = this.lists.validation[2];
        this.thumbnailClass = this.lists.thumbnails[0].value;
        this.expertSearch = this.lists.search[0];
        this.projecturl = Project.getUrl();
        this.fetchDetails().then((function(){
            this.loadPage(this.selected.page);
        }).bind(this));
    },
    compositeValidation: function(roi){
        var expert_val = roi.expert_validated;
        var consensus_val = roi.consensus_validated;
        var cp = roi.cs_val_present;
        var cnp = roi.cs_val_not_present;

        return [expert_val, consensus_val, (cp > 0 && cnp > 0) ? -1 : null].reduce(function(_, arg){
            return _ === null ? arg : _;
        }, null);
    },
    lists: {
        thumbnails: [
            { class:'fa fa-th-large', value:''},
            { class:'fa fa-th', value:'is-small'},
        ],
        search: [
            {value:'all', text:'All', description: 'Show all matched rois.'},
            {value:'consensus', text:'Consensus', description: 'Show only rois where there is a consensus.'},
            {value:'pending', text:'Pending', description: 'Show only rois that have not reached a consensus yet.'},
            {value:'conflicted', text:'Conflicted', description: 'Show only rois where there is a conflict.'},
            {value:'expert', text:'Expert', description: 'Show only rois that have been decided by an expert.'},
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
        return a2CitizenScientistExpertService.getPatternMatchingDetailsFor(this.id).then((function(patternMatching){
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

    onExpertSearchChanged: function(){
        this.selected.page = 0;
        this.loadPage(0);
    },

    setupExportUrl: function(){
        this.patternMatchingExportUrl = a2CitizenScientistExpertService.getCSExportUrl({
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

    loadPage: function(pageNumber){
        this.loading.rois = true;
        return a2CitizenScientistExpertService.getPatternMatchingRoisFor(
            this.id,
            this.limit,
            pageNumber * this.limit,
            { search: this.expertSearch && this.expertSearch.value }
        ).then((function(rois){
            this.loading.rois = false;
            this.rois = rois.reduce(function(_, roi){
                var sitename = roi.site;
                var recname = roi.recording;

                if(!_.idx[sitename]){
                    _.idx[sitename] = {list:[], idx:{}, name:sitename};
                    _.list.push(_.idx[sitename]);
                }

                var site = _.idx[sitename];
                site.list.push(roi);

                return _;
            }, {list:[], idx:{}}).list;
            this.selected.roi = Math.min()

            if(this.scrollElement){
                this.scrollElement.scrollTo(0, 0);
            }

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
            this.selected.page = 0;
            this.rois = [];
            return this.rois;
        } else {
            page = Math.max(0, Math.min(page, (this.total.rois / this.limit) | 0));
            if(page != this.selected.page || force){
                this.selected.page = page;
                return this.loadPage(page);
            }
        }
    },

    select: function(option){
        var selectFn = null;
        if(option === "all"){
            selectFn = function(roi){roi.selected = true;};
        } else if(option === "none"){
            selectFn = function(roi){roi.selected = false;};
        } else if(option === "not-validated"){
            selectFn = function(roi){roi.selected = roi.cs_validated === null;};
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
        var val_delta = {conflict_unresolved:0, conflict_resolved:0, null:0, 0:0, 1:0};
        return a2CitizenScientistExpertService.validatePatternMatchingRois(this.id, roiIds, validation).then((function(){
            rois.forEach(function(roi){
                var oldtag, newtag;
                if(roi.cs_val_present > 0 && roi.cs_val_not_present > 0){
                    oldtag = roi.expert_validated !== null ? 'conflict_resolved' : 'conflict_unresolved';
                    newtag = validation !== null ? 'conflict_resolved' : 'conflict_unresolved';
                }

                val_delta[oldtag] -= 1;
                val_delta[newtag] += 1;

                val_delta[roi.expert_validated] -= 1;
                val_delta[validation] += 1;

                roi.expert_validated = validation;
                roi.selected = false;
            });
            this.patternMatching.cs_conflict_resolved += val_delta.conflict_resolved;
            this.patternMatching.cs_conflict_unresolved += val_delta.conflict_unresolved;
            this.patternMatching.expert_consensus_absent += val_delta[0];
            this.patternMatching.expert_consensus_present += val_delta[1];
            this.loadPage(this.selected.page);
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
