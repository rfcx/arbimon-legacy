angular.module('a2.analysis.patternmatching', [
    'ui.bootstrap',
    'a2.srv.patternmatching',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.patternmatching', {
        url: '/patternmatching/:patternMatchingId??show',
        controller: 'PatternMatchingCtrl',
        templateUrl: '/app/analysis/patternmatching/list.html'
    });
})
.controller('PatternMatchingCtrl' , function($scope, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, notify, $q, a2PatternMatching, a2UserPermit, $state, $stateParams) {
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

        $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;
        $scope.detailedView = $stateParams.show == 'detail';

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
                a2PatternMatching.saveState({
                    'data':$scope.patternmatchingsOriginal,
                    'filtered': $scope.patternmatchingsData,
                    'f':params.filter(),
                    'o':params.orderBy(),
                    'p':params.page(),
                    'c':params.count(),
                    't':orderedData.length
                });
            }
        });
    };

    $scope.setDetailedView = function(detailedView){
        $scope.detailedView = detailedView;
        $state.transitionTo($state.current.name, {
            patternMatchingId:$scope.selectedPatternMatchingId,
            show:detailedView?"detail":"gallery"
        }, {notify:false});
    };


    $scope.selectItem = function(patternmatchingId){
        if($scope.selectedPatternMatchingId == patternmatchingId){
            $state.go('analysis.patternmatching', {
                patternMatchingId: undefined
            });
        } else {
            $state.go('analysis.patternmatching', {
                patternMatchingId: patternmatchingId
            });
        }
    }

    $scope.updateFlags = function() {
        $scope.successInfo = "";
        $scope.showSuccess = false;
        $scope.errorInfo = "";
        $scope.showError = false;
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
    };

    $scope.loadPatternMatchings = function() {
        return a2PatternMatching.list().then(function(data) {
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

    $scope.showPatternMatchingDetails = function (patternmatching) {
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.loading = true;

        var data = {
            id: patternmatching.job_id,
            name: patternmatching.cname,
            modelId: patternmatching.model_id,
            playlist: {
                name: patternmatching.playlist_name,
                id: patternmatching.playlist_id
            }
        };

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/patternmatching/patternmatchinginfo.html',
            controller: 'PatternMatchingDetailsInstanceCtrl',
            windowClass: 'details-modal-window',
            backdrop: 'static',
            resolve: {
                PatternMatchingInfo: function () {
                    return {
                        data: data,
                        project: $scope.projectData,
                    };
                },
            }
        });

        modalInstance.opened.then(function() {
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
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

    $scope.deletePatternMatching = function(id,name) {
        if(!a2UserPermit.can('manage pattern matchings')) {
            notify.log('You do not have permission to delete pattern matchings');
            return;
        }

        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.loading = true;

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/patternmatching/deletepatternmatching.html',
            controller: 'DeletePatternMatchingInstanceCtrl',
            resolve: {
                name: function() {
                    return name;
                },
                id: function() {
                    return id;
                },
                projectData: function() {
                    return $scope.projectData;
                }
            }
        });

        modalInstance.opened.then(function() {
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error("Error: "+ret.err);
            } else {
                var index = -1;
                var modArr = angular.copy($scope.patternmatchingsOriginal);
                for (var i = 0; i < modArr.length; i++) {
                    if (modArr[i].job_id === id) {
                        index = i;
                        break;
                    }
                }
                if (index > -1) {
                    $scope.patternmatchingsOriginal.splice(index, 1);
                    $scope.tableParams.reload();
                    notify.log("PatternMatching deleted successfully");
                }
            }
        });
    };

    $scope.loading = true;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;

    Project.getInfo(function(data) {
        $scope.projectData = data;
    });

    var stateData = a2PatternMatching.getState();

    if (stateData === null) {
        $scope.loadPatternMatchings();
    } else {
        if (stateData.data.length > 0) {
            $scope.patternmatchingsData = stateData.filtered;
            $scope.patternmatchingsOriginal = stateData.data;
            initTable(stateData.p,stateData.c,stateData.o[0],stateData.f,stateData.filtered.length);
        } else {
            $scope.infopanedata = "No models found.";
        }
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
    }
})
.directive('a2PatternMatchingDetails', function(){
    return {
        restrict : 'E',
        replace: true,
        scope : {
            patternMatchingId: '=',
            detailedView: '=',
            onSetDetailedView: '&',
            onGoBack: '&',
        },
        controller : 'PatternMatchingDetailsCtrl',
        controllerAs: 'controller',
        templateUrl: '/app/analysis/patternmatching/details.html'
    };
})
.controller('PatternMatchingDetailsCtrl' , function($scope, a2PatternMatching, Project, notify) {
    Object.assign(this, {
    id: null,
    initialize: function(patternMatchingId){
        this.id = patternMatchingId;
        this.offset = 0;
        this.limit = 100;
        this.selected = {roi_index:0, roi:null, page:0};
        this.total = {rois:0, pages:0};
        this.loading = {details: false, rois:false};
        this.projecturl = Project.getUrl();
        this.fetchDetails().then((function(){
            this.loadPage(this.selected.page);
        }).bind(this));
    },

    fetchDetails: function(){
        this.loading.details = true;
        return a2PatternMatching.getDetailsFor(this.id).then((function(patternMatching){
            this.loading.details = false;
            this.patternMatching = patternMatching;
            this.total = {
                rois: patternMatching.rois,
                pages: Math.ceil(patternMatching.rois / this.limit)
            }
        }).bind(this)).catch((function(err){
            this.loading.details = false;
            return notify.serverError(err);
        }).bind(this));
    },

    loadPage: function(pageNumber){
        this.loading.rois = true;
        console.log("", "q");
        return a2PatternMatching.getRoisFor(this.id, this.limit, pageNumber * this.limit).then((function(rois){
            this.loading.rois = false;
            this.rois = rois;
            this.selected.roi = Math.min()
            return rois;
        }).bind(this)).catch((function(err){
            this.loading.rois = false;
            return notify.serverError(err);
        }).bind(this));
    },

    getRoiVisualizerUrl: function(roi){
        return roi ? "/project/"+this.projecturl+"/#/visualizer/rec/"+roi.recording_id : '';
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

    setPage: function(page){
        if(this.total.rois <= 0){
            this.selected.page = 0;
            this.rois = [];
            return this.rois;
        } else {
            page = Math.max(0, Math.min(page, (this.total.rois / this.limit) | 0));
            if(page != this.selected.page){
                this.selected.page = page;
                return this.loadPage(page);
            }
        }
    },

    select: function(option){
        console.log('this.rois', this.rois);
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

        (this.rois || []).forEach(selectFn);
    },

    validate: function(validation, rois){
        if(!a2UserPermit.can('validate pattern matchings')) {
            notify.log('You do not have permission to validate the matched rois.');
            return;
        }

        if (rois === undefined){
            rois = (this.rois || []).filter(function(roi){ return roi.selected; });
        }
        var roiIds = rois.map(function(roi){ return roi.id; })
        return a2PatternMatching.validateRois(this.id, roiIds, validation).then((function(){
            rois.forEach(function(roi){
                roi.validated = validation;
                roi.selected = false;
            });
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
        if(this.detailedView) {
            this.nextMatch(step);
        } else {
            this.nextPage(step);
        }
    },

    prev: function(step) {
        if(!step){step = 1;}
        return this.next(-step);
    },

    setDetailedView: function(detailedView){
        if ($scope.onSetDetailedView) {
            $scope.onSetDetailedView({value: detailedView})
        }
    },

}); this.initialize($scope.patternMatchingId);
})
.controller('DeletePatternMatchingInstanceCtrl',
    function($scope, $modalInstance, a2PatternMatching, name, id, projectData) {
        $scope.name = name;
        $scope.id = id;
        $scope.deletingloader = false;
        $scope.projectData = projectData;
        var url = $scope.projectData.url;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2PatternMatching.delete(id, function(data) {
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
                params: { N: 100, threshold: 0.7 },
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
                $modalInstance.close({patternMatching: patternMatching});
            }).catch(notify.serverError);
        },
        cancel: function (url) {
             $modalInstance.close({ cancel: true, url: url });
        },
    });
    this.initialize();
});
