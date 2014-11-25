(function(angular)
{ 
    var classification = angular.module('classification', ['ui.bootstrap' , 'a2services']);
    var template_root = '/partials/classification/';

    classification.controller
    ('ClassificationCtrl' , 
        function ($scope,$http,$modal,$filter,$sce,Project, ngTableParams,JobsData,a2Playlists,$location) 
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
	    
	    a2Playlists.getList(
	      function(data)
	      {
		$scope.playlists = data;
	      }
	    );
	    
            var p = Project.getInfo(
            function(data)
            {

                $scope.projectData = data;
                pid = data.project_id;
                $scope.url = data.url;
                $http.get('/api/project/'+data.url+'/classifications')
                .success
                (
                    function(data) 
                    {
                            $scope.classificationsOriginal = data;
                            $scope.classificationsData = data;
			    $scope.infoInfo = "";
                            $scope.showInfo = false;
			    $scope.loading = false;
                            $scope.infopanedata = "";			
                            if(data.length> 0)
                            {              
                                $scope.tableParams = new ngTableParams
                                (
                                {
                                    page: 1,          
                                    count: 10
                                }, 
                                {
                                    total: $scope.classificationsOriginal.length,
                                    getData: function ($defer, params) 
                                    {
 
                                        $defer.resolve($scope.classificationsData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                                        $scope.classificationsData = $scope.classificationsOriginal.slice((params.page() - 1) * params.count(), params.page() * params.count())
                                    }
                                }
                                ); 
                            }
                            else 
                            {
                                $scope.infopanedata = "No classifications found.";
                            }       
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
   
                $scope.showClassificationDetails =
                function (classi_id)
                {
		    $scope.infoInfo = "Loading...";
		    $scope.showInfo = true;
		    $scope.loading = true;
                    var url = $scope.projectData.url;
                    var pid = $scope.projectData.project_id;
                    $scope.classi_id = classi_id;
                    $http.get('/api/project/'+url+'/classification/'+classi_id)
                    .success
                    (
                        function(data) 
                        {
                            $scope.data = data;
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
                                function () 
                                {
                                    
                                }
                            );
                            
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
                };
                
                $scope.createNewClassification =             
                function ()
                {
		    $scope.loading = true;
		    $scope.infoInfo = "Loading...";
		    $scope.showInfo = true;
                     $http.get('/api/project/'+$scope.projectData.url+'/sites')
                    .success
                    (
                        function (data)
                        {
                            
                            $scope.successInfo = "";
                            $scope.showSuccess = false;
                            $scope.errorInfo = "";
                            $scope.showError = false;
                            $scope.sites = data;
                            $http.get('/api/project/'+$scope.projectData.url+'/models')
                            .success
                            (
                                function(data) 
                                {
                                    var modalInstance = $modal.open
                                    (
                                        {
                                            templateUrl: template_root + 'createnewclassification.html',
                                            controller: 'CreateNewClassificationInstanceCtrl',
                                            resolve: 
                                            {
                                                data: function () 
                                                {
                                                  return data;
                                                },
						playlists:function()
						{
						    return $scope.playlists;
						},
                                                sites:function()
                                                {
                                                  return $scope.sites;
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
                                            data = result
                                            if (data.ok)
                                            {
                                                JobsData.updateJobs();
                                                $scope.successInfo = "New Classification on Queue";
                                                $scope.showSuccess = true;
                                                $("#successDiv").fadeTo(3000, 500).slideUp(500,
                                                function()
                                                {
                                                    $scope.showSuccess = false;
                                                });
                                            }
                                            
                                            if (data.err)
                                            {
                                                $scope.errorInfo = "Error Creating Classification Job";
                                                $scope.showError = true;
                                                $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                                function()
                                                {
                                                    $scope.showError = false;
                                                });
                                            }
					    
					    if (data.url)
					    {
						$location.path(data.url);
					    }
                                        }
                                    );
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
                };
            });
        }
    ).controller
    ('ClassiDetailsInstanceCtrl', 
        function ($scope, $modalInstance,$http, data,url,id,pid) 
        {
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
	    
            $scope.next= function () {

                $scope.currentPage = $scope.currentPage + 1;
                if ($scope.currentPage*$scope.maxPerPage >= $scope.data[0].total) {
                    
                    $scope.currentPage = $scope.currentPage - 1;
                }
                else{
                    $http.get('/api/project/'+$scope.url+'/classification/'+$scope.id+'/more/'+($scope.currentPage*$scope.maxPerPage)+"/"+$scope.maxPerPage)
                    .success
                    (
                        function(dataRec) 
                        {
                            $scope.recs =dataRec;
                            jsonArr = JSON.parse(dataRec[0].json_stats)
                            $scope.minv = parseFloat(jsonArr['minv'])
                            $scope.maxv = parseFloat(jsonArr['maxv'])

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
            $scope.prev= function () {
                $scope.currentPage = $scope.currentPage - 1;
                if ($scope.currentPage  < 0) {
                    $scope.currentPage =0;
                }
                else
                {
                    $http.get('/api/project/'+$scope.url+'/classification/'+$scope.id+'/more/'+($scope.currentPage*$scope.maxPerPage)+"/"+$scope.maxPerPage)
                    .success
                    (
                        function(dataRec) 
                        {
                            $scope.recs =dataRec;
                            jsonArr = JSON.parse(dataRec[0].json_stats)
                            $scope.minv = parseFloat(jsonArr['minv'])
                            $scope.maxv = parseFloat(jsonArr['maxv'])
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
            $scope.more= function () {

		$scope.showMore = true;
                if ($scope.recs.length <1)
                {
                    $http.get('/api/project/'+$scope.url+'/classification/'+$scope.id+'/more/0/'+$scope.maxPerPage)
                    .success
                    (
                        function(dataRec) 
                        {
                            $scope.recs = dataRec;
                            jsonArr = JSON.parse(dataRec[0].json_stats)
                            $scope.minv = parseFloat(jsonArr['minv'])
                            $scope.maxv = parseFloat(jsonArr['maxv'])
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
            
            $scope.less= function () {

		$scope.showMore = false;

            };
        }
    ).controller
    ('CreateNewClassificationInstanceCtrl', 
        function ($scope, $modalInstance,$http, data,sites,projectData,playlists) 
        {
            $scope.data = data;
            $scope.projectData = projectData;
            $scope.recselected = '';
            $scope.showselection = false;
            $scope.sites = sites;
	    $scope.playlists = playlists;
	    $scope.nameMsg = ''
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
		$scope.nameMsg = ''
                var url = $scope.projectData.url;
                $scope.all = 0;
                $scope.selectedSites = []
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
                ).
                success
                (
                    function(data, status, headers, config) 
                    {
			if (data.name)
			{
			    $scope.nameMsg = 'Name exists';
			}
			else $modalInstance.close( data );
                    }
                ).
                error(
                    function(data, status, headers, config) 
                    {
			$modalInstance.close( {err:"Cannot create job"});
                    }
                );
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
                            !((typeof $scope.datas.playlist) == 'string')
                            && $scope.datas.name.length
                            && !((typeof $scope.datas.classifier) == 'string')
                        ) ;
            };
            
            $scope.cancel = function (url) {
                 $modalInstance.close( {url:url});
            };
            

        }
    ).directive
    ('a2Classification',
        function()
        {
            return  {restrict : 'E', templateUrl: template_root + 'main.html'} 

        }
    ).directive
    ('a2Classificationlist',
        function()
        {
            return  {restrict : 'E',
                    templateUrl: template_root + 'classificationlist.html'} 

        }
    ).directive
    ('a2Vectorchart',
        function()
        {
            return  {restrict : 'E',
                    scope: {
                        vurl: '=',
                        minvect: '=',
                        maxvect: '='
                    },
                    templateUrl: template_root + 'vectorchart.html',
                    controller: ['$scope', '$http', function($scope, $http) {
			$scope.loadingflag = true;
                        $scope.getVect = function(path,minve,maxve,ctx) {
                        $http.post('/api/project/'+$scope.url+'/classification/vector', 
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
                                ctx.width = $scope.dataLength
                                ctx.height = canvasheight 
                                ctxContext = ctx.getContext('2d');
                                ctxContext.beginPath();
                                ctxContext.moveTo(i,canvasheight*(1-Math.round(((parseFloat($scope.data[i]) - minve)/(maxve-minve))*100000)/100000));
                                for(var i =1; i < $scope.data.length;i++)
                                {
                                    ctxContext.lineTo(i,canvasheight*(1-Math.round(((parseFloat($scope.data[i]) - minve)/(maxve-minve))*100000)/100000));

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
                        };
                    }],
                    link: function (scope, element) {
                          var ctx = element.children()
                          ctx = ctx[0];
                          scope.getVect(scope.vurl,parseFloat(scope.minvect),parseFloat(scope.maxvect),ctx)
                      }
                    } 

        }
     );
}
)(angular);
