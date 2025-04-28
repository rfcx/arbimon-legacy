angular.module('a2.analysis.random-forest-models.classification', [
    'ui.bootstrap' ,
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.random-forest-models.classification', {
        url: '/classification',
        controller: 'ClassificationCtrl',
        templateUrl: '/app/analysis/random-forest-models/classification/list.html'
    });
})
.controller('ClassificationCtrl' , function($scope, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, notify, $location, a2Classi, a2UserPermit) {
    var initTable = function(p,c,s,f,t) {
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
                var filteredData = params.filter() ? $filter('filter')($scope.classificationsOriginal , params.filter()) : $scope.classificationsOriginal;

                var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.classificationsOriginal;

                params.total(orderedData.length);

                $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

                if(orderedData.length < 1)
                {
                    $scope.infopanedata = "No classifications found.";
                }

                $scope.classificationsData  = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                a2Classi.saveState({'data':$scope.classificationsOriginal,
                   'filtered': $scope.classificationsData,
                   'f':params.filter(),
                   'o':params.orderBy(),
                   'p':params.page(),
                   'c':params.count(),
                   't':orderedData.length});
            }
        });
    };

    $scope.updateFlags = function() {
        $scope.successInfo = "";
        $scope.showSuccess = false;
        $scope.errorInfo = "";
        $scope.showError = false;
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
    };

    $scope.capitalize = function(row) {
        return row.length ? row[0].toUpperCase() + row.slice(1) : row;
    };

    $scope.loadClassifications = function() {
        a2Classi.list(function(data) {
            $scope.classificationsOriginal = data;
            data.forEach(function(row) {
                row.muser = $scope.capitalize(row.firstname) + " " + $scope.capitalize(row.lastname);
            });
            $scope.classificationsData = data;
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
            $scope.infopanedata = "";

            if(data.length> 0) {
                if(!$scope.tableParams) {
                    initTable(1,10,"+cname",{},data.length);
                }
                else {
                    $scope.tableParams.reload();
                }
            }
            else {
                $scope.infopanedata = "No classifications found.";
            }
        });
    };

    $scope.showClassificationDetails = function (classi) {
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.loading = true;

        var data = {
            id: classi.job_id,
            name: classi.cname,
            modelId: classi.model_id,
            playlist: {
                name: classi.playlist_name,
                id: classi.playlist_id
            }
        };

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/random-forest-models/classification/classinfo.html',
            controller: 'ClassiDetailsInstanceCtrl',
            windowClass: 'modal-element width-900',
            backdrop: 'static',
            resolve: {
                ClassiInfo: function () {
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

    $scope.createNewClassification = function () {
        if(!a2UserPermit.can('manage models and classification')) {
            notify.error('You do not have permission to create classifications');
            return;
        }

        $scope.loading = true;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;


        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/random-forest-models/classification/createnewclassification.html',
            controller: 'CreateNewClassificationInstanceCtrl',
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
            },
            windowClass: 'modal-element'
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
                notify.log("Your new classification is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            }

            if (data.error) {
                notify.error("Error: "+data.error);
            }

            if (data.url) {
                $location.path(data.url);
            }
        });
    };

    $scope.deleteClassification = function(id,name) {
        if(!a2UserPermit.can('manage models and classification') || (a2UserPermit.can('manage models and classification') && !a2UserPermit.can('export report'))) {
            notify.error('You do not have permission to delete classifications');
            return;
        }

        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.loading = true;

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/random-forest-models/classification/deleteclassification.html',
            controller: 'DeleteClassificationInstanceCtrl',
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
            },
            windowClass: 'modal-element width-490'
        });

        modalInstance.opened.then(function() {
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error("Error: "+ret.err);
            }
            else {
                var index = -1;
                var modArr = angular.copy($scope.classificationsOriginal);
                for (var i = 0; i < modArr.length; i++) {
                    if (modArr[i].job_id === id) {
                        index = i;
                        break;
                    }
                }
                if (index > -1) {
                    $scope.classificationsOriginal.splice(index, 1);
                    $scope.tableParams.reload();
                    notify.log("Classification deleted successfully");
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

    var stateData = a2Classi.getState();

    if (stateData === null) {
        $scope.loadClassifications();
    }
    else {
        if (stateData.data.length > 0) {
            $scope.classificationsData = stateData.filtered;
            $scope.classificationsOriginal = stateData.data;
            initTable(stateData.p,stateData.c,stateData.o[0],stateData.f,stateData.filtered.length);
        }
        else {
            $scope.infopanedata = "No models found.";
        }
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
    }
})
.controller('DeleteClassificationInstanceCtrl',
    function($scope, $modalInstance, a2Classi, name, id, projectData) {
        $scope.name = name;
        $scope.id = id;
        $scope.deletingloader = false;
        $scope.projectData = projectData;
        var url = $scope.projectData.url;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2Classi.delete(id, function(data) {
                $modalInstance.close(data);
            });
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    }
)
.controller('ClassiDetailsInstanceCtrl',
    function ($scope, $modalInstance, a2Classi, a2Models, notify, a2UserPermit, ClassiInfo) {
        var loadClassifiedRec = function() {
            a2Classi.getResultDetails($scope.classiData.id, ($scope.currentPage*$scope.maxPerPage), $scope.maxPerPage, function(dataRec) {
                a2Classi.getRecVector($scope.classiData.id, dataRec[0].recording_id).success(function(data) {
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

            if($scope.currentPage*$scope.maxPerPage >= $scope.classiData.total) {

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
                $scope.currentPage = Math.ceil($scope.classiData.total/$scope.maxPerPage) - 1;
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
        $scope.classiData = ClassiInfo.data;
        $scope.project = ClassiInfo.project;
        $scope.showMore = false;
        $scope.currentPage = 0;
        $scope.maxPerPage = 1;

        $scope.csvUrl = "/legacy-api/project/"+$scope.project.url+"/classifications/csv/"+$scope.classiData.id;

        $scope.showDownload = a2UserPermit.can('manage models and classification');

        console.table($scope.classiData);

        a2Classi.getDetails($scope.classiData.id, function(data) {
            if(!data) {
                $modalInstance.close();
                notify.log("No details available for this classification");
                return;
            }

            angular.extend($scope.classiData, data);

            $scope.totalRecs = Math.ceil($scope.classiData.total/$scope.maxPerPage);

            console.log($scope.classiData);
            $scope.results = [
                ['absent', $scope.classiData.total-$scope.classiData.present],
                ['present', $scope.classiData.present],
                ['skipped', $scope.classiData.errCount]
            ];

            a2Models.findById($scope.classiData.modelId)
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

.controller('CreateNewClassificationInstanceCtrl', function($scope, $modalInstance, a2Classi, data, projectData, playlists, notify) {
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

    $scope.showPlaylistLimitWarning = function () {
        if (($scope.datas && !$scope.datas.playlist) || ($scope.projectData.projectt_id = 1902)) return
        return $scope.datas.playlist && $scope.datas.playlist.count > 10000;
    };


    $scope.ok = function () {
        $scope.nameMsg = '';
        $scope.all = 0;
        $scope.selectedSites = [];

        // NOTE temporary block disabled model types
        if(!$scope.datas.classifier.enabled) return;

        var classiData = {
            n: $scope.datas.name,
            c: $scope.datas.classifier.model_id,
            a: $scope.all,
            s: $scope.selectedSites.join(),
            p: $scope.datas.playlist
        };

        a2Classi.create(classiData, function(data) {
            if (data.err) notify.error(data.err);
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
        $modalInstance.close({url: url});
    };

    $scope.isOldModel = function(data) {
        // If created before November 1, 2024, it will be considered a legacy module OR the model wasn't retrained
        return new Date(data.date_created) < new Date(2024, 10, 1) && !data.retrained
    }

})

.directive('a2Vectorchart', function() {
    return {
        restrict: 'E',
        scope: {
            vectorData: '=',
            minvect: '=',
            maxvect: '=',
        },
        templateUrl: '/app/analysis/random-forest-models/classification/vectorchart.html',
        controller: function($scope) {
            $scope.loadingflag = true;

            $scope.drawVector = function() {
                if(!$scope.vectorData) return;

                $scope.loadingflag = true;

                var canvas = $scope.canvas;
                var vector = $scope.vectorData;

                var height = 50;
                var width = $scope.width;

                var xStep;

                if (width>=vector.length) {
                    canvas.width = width;
                    xStep = width/vector.length;

                }
                else {
                    canvas.width = vector.length;
                    xStep = 1;
                }

                canvas.height = height;
                ctx = canvas.getContext('2d');
                ctx.beginPath();

                var i = 0;
                ctx.moveTo(i*xStep, height * (1 - ((vector[i] - $scope.minvect) / ($scope.maxvect - $scope.minvect))));
                while(i < vector.length) {
                    i++;
                    ctx.lineTo(i*xStep, height * (1 - ((vector[i] - $scope.minvect) / ($scope.maxvect - $scope.minvect))));
                }

                ctx.strokeStyle = '#000';
                ctx.stroke();



                if ($scope.minvect < -0.09) {
                    //code
                    ctx.beginPath();
                    i = 0;
                    ctx.moveTo(i*xStep, height * (1 - ((0 - $scope.minvect) / ($scope.maxvect - $scope.minvect))));
                    while(i < vector.length) {
                        i++;
                        ctx.lineTo(i*xStep, height * (1 - ((0 - $scope.minvect) / ($scope.maxvect - $scope.minvect))));
                    }

                    ctx.strokeStyle = '#aa0000';
                    ctx.stroke();
                }

                $scope.loadingflag = false;
            };

            $scope.$watch('vectorData', function() {
                $scope.drawVector();
            });
        },
        link: function(scope, element) {
            scope.canvas = element.children()[0];
            scope.width = parseInt(element.css('width'));
        }
    };
});
