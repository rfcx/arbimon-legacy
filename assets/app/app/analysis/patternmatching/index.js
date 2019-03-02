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
        if(!a2UserPermit.can('manage models and pattern matching')) {
            notify.log('You do not have permission to create pattern matchings');
            return;
        }

        $scope.loading = true;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;


        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/patternmatching/createnewpatternmatching.html',
            controller: 'CreateNewPatternMatchingInstanceCtrl',
            resolve: {
                data: function($q){
                    var d = $q.defer();
                    Project.getModels(function(err, data){
                        if(err){
                            console.error(err);
                        }

                        d.resolve(data || []);

                    });
                    return d.promise;
                },
                playlists:function($q){
                    var d = $q.defer();
                    a2Playlists.getList().then(function(data) {
                        d.resolve(data || []);
                    });
                    return d.promise;
                },
                projectData:function()
                {
                    return $scope.projectData;
                }
            }
        });

        modalInstance.opened.then(function() {
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.ok) {
                JobsData.updateJobs();
                notify.log("Your new pattern matching is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            }

            if (data.error) {
                notify.error("Error: "+data.error);
            }

            if (data.url) {
                $location.path(data.url);
            }
        });
    };

    $scope.deletePatternMatching = function(id,name) {
        if(!a2UserPermit.can('manage models and pattern matching')) {
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
        this.limit = 10;
        this.selected = {match_index:0, match:null, page:0};
        this.total = {matches:0, pages:0};
        this.loading = {details: false, matches:false};
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
                matches: patternMatching.matches,
                pages: Math.ceil(patternMatching.matches / this.limit)
            }
        }).bind(this)).catch((function(err){
            this.loading.details = false;
            return notify.serverError(err);
        }).bind(this));
    },

    loadPage: function(pageNumber){
        this.loading.matches = true;
            this.loading.matches = false;
            return a2PatternMatching.getMatchesFor(this.id, this.limit, pageNumber * this.limit).then((function(matches){
            this.matches = matches;
            this.selected.match = Math.min()
            return matches;
        }).bind(this)).catch((function(err){
            this.loading.matches = false;
            return notify.serverError(err);
        }).bind(this));
    },

    getMatchVisualizerUrl: function(match){
        return match ? "/project/"+this.projecturl+"/#/visualizer/rec/"+match.recording_id : '';
    },

    setMatch: function(match_index){
        if(this.total.matches <= 0){
            this.selected.match_index = 0;
            this.selected.match = null;
        } else {
            this.selected.match_index = Math.max(0, Math.min(match_index | 0, this.total.matches - 1));
            this.selected.match = this.matches[this.selected.match_index];
        }
        return this.selected.match;
    },

    setPage: function(page){
        if(this.total.matches <= 0){
            this.selected.page = 0;
            this.matches = [];
            return this.matches;
        } else {
            page = Math.max(0, Math.min(page, (this.total.matches / this.limit) | 0));
            if(page != this.selected.page){
                this.selected.page = page;
                return this.loadPage(page);
            }
        }
    },

    nextMatch: function(step) {
        return this.setMatch(this.selected.match_index + (step || 1));
    },

    prevMatch: function (step) {
        return this.setMatch(this.selected.match_index - (step || 1));
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
});
/*
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
.controller('PatternMatchingDetailsInstanceCtrl',
    function ($scope, $modalInstance, a2PatternMatching, a2Models, notify, a2UserPermit, PatternMatchingInfo) {
        var loadClassifiedRec = function() {
            a2PatternMatching.getResultDetails($scope.patternMatchingData.id, ($scope.currentPage*$scope.maxPerPage), $scope.maxPerPage, function(dataRec) {

                a2PatternMatching.getRecVector($scope.patternMatchingData.id, dataRec[0].recording_id).success(function(data) {
                    var maxVal = Math.max.apply(null, data.vector);
                    if(typeof $scope.th === 'number') {
                        $scope.htresDeci = ( maxVal < $scope.th )? 'no' : 'yes';
                    }
                    $scope.recVect = data.vector;
                    $scope.recs = dataRec;
                    $scope.minv = dataRec[0].stats.minv;
                    $scope.maxv = dataRec[0].stats.maxv;
                    $scope.maxvRounded = Math.round($scope.maxv*1000)/1000;
                });
            });
        };

        $scope.ok = function () {
            $modalInstance.close( );
        };

        $scope.next = function () {
            $scope.currentPage = $scope.currentPage + 1;

            if($scope.currentPage*$scope.maxPerPage >= $scope.patternMatchingData.total) {

                $scope.currentPage = $scope.currentPage - 1;
            }
            else{
                loadClassifiedRec();
            }
        };

        $scope.prev = function () {
            $scope.currentPage = $scope.currentPage - 1;
            if ($scope.currentPage  < 0) {
                $scope.currentPage = 0;
            }
            else
            {
                loadClassifiedRec();
            }
        };

        $scope.gotoc = function(where) {
            if (where == 'first') {
                $scope.currentPage = 0;
            }
            if (where == 'last') {
                $scope.currentPage = Math.ceil($scope.patternMatchingData.total/$scope.maxPerPage) - 1;
            }

            loadClassifiedRec();
        };


        $scope.toggleRecDetails = function() {
            $scope.showMore = !$scope.showMore;
            if($scope.showMore && !$scope.recs) {
                loadClassifiedRec();
            }
        };


        $scope.loading = true;
        $scope.htresDeci = '-';
        $scope.patternMatchingData = PatternMatchingInfo.data;
        $scope.project = PatternMatchingInfo.project;
        $scope.showMore = false;
        $scope.currentPage = 0;
        $scope.maxPerPage = 1;

        $scope.csvUrl = "/api/project/"+$scope.project.url+"/patternmatchings/csv/"+$scope.patternMatchingData.id;

        $scope.showDownload = a2UserPermit.can('manage models and pattern matching');

        console.table($scope.patternMatchingData);

        a2PatternMatching.getDetails($scope.patternMatchingData.id, function(data) {
            if(!data) {
                $modalInstance.close();
                notify.log("No details available for this pattern matching");
                return;
            }

            angular.extend($scope.patternMatchingData, data);

            $scope.totalRecs = Math.ceil($scope.patternMatchingData.total/$scope.maxPerPage);

            console.log($scope.patternMatchingData);
            $scope.results = [
                ['absent', $scope.patternMatchingData.total-$scope.patternMatchingData.present],
                ['present', $scope.patternMatchingData.present],
                ['skipped', $scope.patternMatchingData.errCount]
            ];

            a2Models.findById($scope.patternMatchingData.modelId)
                .success(function(modelInfo) {
                    console.log(modelInfo);
                    $scope.model = modelInfo;
                    $scope.loading = false;
                })
                .error(function(err) {
                    $scope.loading = false;
                });
        });
})
.controller('CreateNewPatternMatchingInstanceCtrl', function($scope, $modalInstance, a2PatternMatching, data, projectData, playlists) {
    $scope.data = data;
    $scope.projectData = projectData;
    $scope.recselected = '';
    $scope.showselection = false;
    $scope.playlists = playlists;
    $scope.nameMsg = '';
    $scope.datas = {
        name : '' ,
        classifier: '',
        playlist:''
    };


    $scope.$watch('recselected', function() {
        if ($scope.recselected === 'selected') {
            $scope.showselection = true;
        }
        else {
            $scope.showselection = false;
        }
    });


    $scope.ok = function () {
        $scope.nameMsg = '';
        var url = $scope.projectData.url;
        $scope.all = 0;
        $scope.selectedSites = [];

        // NOTE temporary block disabled model types
        if(!$scope.datas.classifier.enabled) return;

        var patternMatchingData = {
            n: $scope.datas.name,
            c: $scope.datas.classifier.model_id,
            a: $scope.all,
            s: $scope.selectedSites.join(),
            p: $scope.datas.playlist
        };

        a2PatternMatching.create(patternMatchingData, function(data) {
            if (data.name) {
                $scope.nameMsg = 'Name exists';
            }
            else {
                $modalInstance.close( data );
            }
        });
    };

    $scope.buttonEnable = function () {
        return  !(
            typeof $scope.datas.playlist !== 'string' &&
            $scope.datas.name.length &&
            typeof $scope.datas.classifier !== 'string'
        );
    };

    $scope.cancel = function (url) {
         $modalInstance.close( {url:url});
    };
});
*/
