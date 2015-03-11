(function(angular)
{
    var classification = angular.module('classification', ['ui.bootstrap' , 'a2services', 'humane']);
    var template_root = '/partials/classification/';

    classification.controller('ClassificationCtrl' ,
        function ($scope, $http, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, $location, notify, $q)
        {
            $scope.loading = true;
            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;

            $scope.updateFlags = function()
            {
                $scope.successInfo = "";
                $scope.showSuccess = false;
                $scope.errorInfo = "";
                $scope.showError = false;
                $scope.infoInfo = "";
                $scope.showInfo = false;
                $scope.loading = false;
            };


            Project.getInfo(function(data) {
                $scope.projectData = data;
                $scope.url = data.url;
            });


            var initTable = function() {

                $scope.tableParams = new ngTableParams(
                    {
                        page: 1,
                        count: 10,
                        sorting: {
                            cname: 'asc'
                        }
                    },
                    {
                        total: $scope.classificationsOriginal.length,
                        getData: function ($defer, params)
                        {
                            $scope.infopanedata = "";
                            var filteredData = params.filter() ?
                            $filter('filter')($scope.classificationsOriginal , params.filter()) :
                            $scope.classificationsOriginal  ;

                            var orderedData = params.sorting() ?
                            $filter('orderBy')(filteredData, params.orderBy()) :
                            $scope.classificationsOriginal;

                            params.total(orderedData.length);

                            $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

                            if(orderedData.length < 1)
                            {
                                $scope.infopanedata = "No classifications found.";
                            }

                            $scope.classificationsData  = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                        }
                    }
                );
            };



            $scope.loadClassifications = function() {
                $http.get('/api/project/'+Project.getUrl()+'/classifications')
                .success(function(data) {
                    $scope.classificationsOriginal = data;
                    $scope.classificationsData = data;
                    $scope.infoInfo = "";
                    $scope.showInfo = false;
                    $scope.loading = false;
                    $scope.infopanedata = "";

                    if(data.length> 0) {
                        if(!$scope.tableParams) {
                            initTable();
                        }
                        else {
                            $scope.tableParams.reload();
                        }
                    }
                    else {
                        $scope.infopanedata = "No classifications found.";
                    }
                })
                .error(function() {
                    notify.error("Error Communicating With Server");
                });
            };
            $scope.loadClassifications();


            $scope.showClassificationDetails = function (classi_id) {

                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;
                $scope.loading = true;
                var url = $scope.projectData.url;
                var pid = $scope.projectData.project_id;
                $scope.classi_id = classi_id;

                $http.get('/api/project/'+url+'/classification/'+classi_id)
                .success(function(data) {

                    if(!data.data.length) {
                        notify.log("No details available for this classification");
                        $scope.showInfo = false;
                        $scope.loading = false;

                        return;
                    }

                    $scope.data = data;
                    $scope.currentModelTh = data.data[0].th;
                    var modalInstance = $modal.open
                    (
                        {
                            templateUrl: template_root + 'classinfo.html',
                            controller: 'ClassiDetailsInstanceCtrl',
                            windowClass: 'details-modal-window',
                            resolve:
                            {
                                data: function ()
                                {
                                  return $scope.data;
                                },
                                url : function ()
                                {
                                  return $scope.url;
                                },
                                id : function ()
                                {
                                  return $scope.classi_id;
                                },
                                pid : function ()
                                {
                                    return $scope.pid;
                                },
                                th : function ()
                                {
                                return $scope.currentModelTh;
                                }
                            }
                        }
                    );

                    modalInstance.opened.then(function()
                    {
                        $scope.infoInfo = "";
                        $scope.showInfo = false;
                        $scope.loading = false;
                    });
                })
                .error(function() {
                    notify.error("Error Communicating With Server");
                });
            };

            $scope.createNewClassification = function () {
                $scope.loading = true;
                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;


                var modalInstance = $modal.open
                (
                    {
                        templateUrl: template_root + 'createnewclassification.html',
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
                                a2Playlists.getList(function(data) {
                                    d.resolve(data || []);
                                });
                                return d.promise;
                            },
                            projectData:function()
                            {
                                return $scope.projectData;
                            }
                        }
                    }
                );

                modalInstance.opened.then(function()
                {
                    $scope.infoInfo = "";
                    $scope.showInfo = false;
                    $scope.loading = false;
                });

                modalInstance.result.then
                (
                    function (result)
                    {
                        data = result;
                        if (data.ok)
                        {
                            JobsData.updateJobs();
                            notify.log("New Classification on Queue");
                        }

                        if (data.err)
                        {
                            notify.error("Error Creating Classification Job");
                        }

                        if (data.url)
                        {
                            $location.path(data.url);
                        }
                    }
                );
            };


            $scope.deleteClassification = function(id,name) {
                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;
                $scope.loading = true;
                var modalInstance = $modal.open({
                    templateUrl: template_root + 'deleteclassification.html',
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
                    }
                });

                modalInstance.opened.then(function() {
                    $scope.infoInfo = "";
                    $scope.showInfo = false;
                    $scope.loading = false;
                });

                modalInstance.result.then(
                    function() {
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
                            notify.log("Classification Deleted Successfully");
                        }
                    }
                );
            };
    })
    .controller('DeleteClassificationInstanceCtrl',
        function($scope, $modalInstance, $http, name, id, projectData) {
            $scope.name = name;
            $scope.id = id;
            $scope.deletingloader = false;
            $scope.projectData = projectData;
            var url = $scope.projectData.url;
            $scope.ok = function() {
            $scope.deletingloader = true;
            $http.get('/api/project/' + url + '/classification/' + id + "/delete")
                .success(function(data) {
                    $modalInstance.close();
                })
                .error(function() {
                    notify.error("Error Communicating With Server");
                });
            };

            $scope.cancel = function() {
                $modalInstance.dismiss('cancel');
            };

        }
    )
    .controller('ClassiDetailsInstanceCtrl',
        function ($scope, $modalInstance, $http, notify, data, url, id, pid, th)
        {
            $scope.th = th;
            $scope.data = data.data;
            $scope.pid = pid;
            $scope.url = url;
            $scope.id = id;
            $scope.recs = [];
            $scope.showMore = false;
            $scope.currentPage = 0;
            $scope.maxPerPage = 1;
            $scope.totalRecs = Math.ceil($scope.data[0].total/$scope.maxPerPage);


            $scope.ok = function () {
                $modalInstance.close( );
            };

            var loadClassifiedRec = function() {
                $http.get('/api/project/'+$scope.url+'/classification/'+$scope.id+'/more/'+($scope.currentPage*$scope.maxPerPage)+"/"+$scope.maxPerPage)
                .success(function(dataRec) {

                    $http.post('/api/project/'+$scope.purl+'/classification/vector', { v:dataRec[0].vect } )
                    .success(function(vectordata) {

                        var recVect =  vectordata.data.split(",") ;

                        for(var jj = 0 ; jj < recVect.length; jj++)
                        {
                            recVect[jj] = parseFloat(recVect[jj]);
                        }

                        var maxVal = Math.max.apply(null,recVect);
                        if (! isNaN($scope.th)) {
                            if(maxVal < $scope.th )
                                $scope.htresDeci = 'no';
                            else
                                $scope.htresDeci = 'yes';
                        }
                        $scope.recs = dataRec;
                        $scope.minv = dataRec[0].stats.minv;
                        $scope.maxv = dataRec[0].stats.maxv;
                        $scope.maxvRounded = Math.round($scope.maxv*1000)/1000;
                    });
                })
                .error(function() {
                    notify.error("Error Communicating With Server");
                });
            };


            $scope.next= function () {
                $scope.currentPage = $scope.currentPage + 1;

                if($scope.currentPage*$scope.maxPerPage >= $scope.data[0].total) {

                    $scope.currentPage = $scope.currentPage - 1;
                }
                else{
                    loadClassifiedRec();
                }
            };


            $scope.prev= function () {
                $scope.currentPage = $scope.currentPage - 1;
                if ($scope.currentPage  < 0) {
                    $scope.currentPage = 0;
                }
                else
                {
                    loadClassifiedRec();
                }
            };


            $scope.gotoc = function (where) {
                if (where == 'first') {
                    $scope.currentPage = 0;
                }
                if (where == 'last') {
                    $scope.currentPage = Math.ceil($scope.data[0].total/$scope.maxPerPage) - 1;
                }

                loadClassifiedRec();
            };
            $scope.htresDeci = '-';



            $scope.more= function () {
                $scope.showMore = true;
                if ($scope.recs.length <1)
                {
                    loadClassifiedRec();
                }
            };

            $scope.less= function () {
                $scope.showMore = false;
            };

        }
    )
    .controller('CreateNewClassificationInstanceCtrl',
        function ($scope, $modalInstance, $http, data, projectData, playlists)
        {
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


            $scope.$watch('recselected',
                function()
                {
                    if ($scope.recselected === 'selected')
                        $scope.showselection = true;
                    else $scope.showselection = false;
                }
            );


            $scope.ok = function () {
                $scope.nameMsg = '';
                var url = $scope.projectData.url;
                $scope.all = 0;
                $scope.selectedSites = [];
                /*
                if ($scope.recselected=='all')
                {
                    $scope.all = 1;
                    $scope.selectedSites.push('none')
                }
                else
                {
                    angular.forEach($scope.sites, function (site) {
                        if (site.Selected)
                        {
                            $scope.selectedSites.push(site.id)
                        }
                    });
                }
                */
                $http.post('/api/project/'+url+'/classification/new',
                    {
                        n:$scope.datas.name,
                        c:$scope.datas.classifier.model_id,
                        a:$scope.all,
                        s:$scope.selectedSites.join(),
                        p:$scope.datas.playlist
                    }
                )
                .success(
                    function(data, status, headers, config) {
                        if (data.name)
                        {
                            $scope.nameMsg = 'Name exists';
                        }
                        else {
                            $modalInstance.close( data );
                        }
                    }
                )
                .error(function(data, status, headers, config) {
                    $modalInstance.close( {err:"Cannot create job"});
                });
            };

            $scope.buttonEnable = function ()
            {
        /*
                var flag = false;
                if ($scope.recselected === 'all')
                    flag = true;
                else
                {
                    var numberOfChecked = $('input:checkbox:checked').length;
                    if (numberOfChecked>0)
                    {
                        flag = true;
                    }

                }
        */
                return  !(
                            typeof $scope.datas.playlist !== 'string' &&
                            $scope.datas.name.length &&
                            typeof $scope.datas.classifier !== 'string'
                        ) ;
            };

            $scope.cancel = function (url) {
                 $modalInstance.close( {url:url});
            };


        }
    )
    .directive('a2Vectorchart',
        function()
        {
            return  {
                restrict : 'E',
                scope: {
                    vurl: '=',
                    minvect: '=',
                    maxvect: '=',
                    purl: '='
                },
                templateUrl: template_root + 'vectorchart.html',
                controller: ['$scope', '$http', function($scope, $http) {
                    $scope.loadingflag = true;
                    $scope.setLoader = function()
                    {
                        $scope.loadingflag = true;
                    };

                    $scope.getVect = function(path,minve,maxve,ctx) {
                        if(path)
                        {
                            $http.post('/api/project/'+$scope.purl+'/classification/vector',
                            {
                                v:path
                            }
                            ).
                            success
                            (
                            function(data, status, headers, config)
                            {
                                $scope.data =  data.data.split(",") ;
                                $scope.dataLength = $scope.data.length;
                                var canvasheight = 50;
                                var i = 0;
                                ctx.width = $scope.dataLength;
                                ctx.height = canvasheight;
                                ctxContext = ctx.getContext('2d');
                                ctxContext.beginPath();

                                //minvev = 99999999.0;
                                //maxvev = -99999999.0;
                                /*
                                for(var jj = 0 ; jj < $scope.data.length; jj++)
                                {
                                $scope.data[jj] = parseFloat($scope.data[jj]);
                                if (minvev >$scope.data[jj])
                                {
                                    minvev =$scope.data[jj];
                                }
                                if (maxvev<$scope.data[jj])
                                {
                                    maxvev =$scope.data[jj];
                                }
                                }
                                */

                                ctxContext.moveTo(i,canvasheight*(1- (($scope.data[i]-$scope.minvect)/($scope.maxvect-$scope.minvect))   ));
                                //ctxContext.moveTo(i,canvasheight*(1-Math.round(((parseFloat($scope.data[i]) - minve)/(maxve-minve))*100000)/100000));
                                for(i = 1; i < $scope.data.length; i++)
                                {
                                    ctxContext.lineTo(i,canvasheight*(1- (($scope.data[i]-$scope.minvect)/($scope.maxvect-$scope.minvect)) ) );
                                    //ctxContext.lineTo(i,canvasheight*(1-Math.round(((parseFloat($scope.data[i]) - minve)/(maxve-minve))*100000)/100000));

                                }
                                ctxContext.strokeStyle = "#000";
                                ctxContext.stroke();
                                $scope.loadingflag = false;
                            }
                            ).error(
                            function()
                            {
                                $scope.errorInfo = "Error Communicating With Server";
                                $scope.showError = true;
                                $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                function()
                                {
                                $scope.showError = false;
                                });
                            }
                            );
                        }
                    };
                }],
                link: function (scope, element) {
                    var ctx = element.children();
                    ctx = ctx[0];
                    scope.$watch("vurl",function(newValue,oldValue) {
                        scope.setLoader();
                        scope.getVect(scope.vurl,parseFloat(scope.minvect),parseFloat(scope.maxvect),ctx);
                    });
                }
           };

        }
    );

})(angular);
