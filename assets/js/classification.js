(function(angular)
{ 
    var classification = angular.module('classification', ['ui.bootstrap' , 'a2services']);
    var template_root = '/partials/classification/';
    classification.controller
    ('ClassificationCtrl' , 
        function ($scope,$http,$modal,$filter,$sce,Project, ngTableParams) 
        {
             var p = Project.getInfo(
            function(data)
            {
                $scope.projectData = data;
                pid = data.project_id;
                
                $http.get('/api/project/'+data.url+'/classifications')
                .success
                (
                    function(data) 
                    {
                            $scope.classificationsOriginal = data;
                            $scope.classificationsData = data;
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
                );
   
                $scope.showClassificationDetails =
                function (classi_id)
                {
                    var url = $scope.projectData.url;
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
                                    resolve: 
                                    {
                                        data: function () 
                                        {
                                          return $scope.data;
                                        }
                                    }
                                }
                            );
                            
                            modalInstance.result.then
                            (
                                function () 
                                {
                                }
                            );
                            
                        }
                    );
                };
                
                $scope.createNewClassification =             
                function ()
                {
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
                                    
                                    modalInstance.result.then
                                    (
                                        function (result) 
                                        {
                                            data = result
                                            if (data.ok)
                                            {
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
                                        }
                                    );
                                }
                            );
                        }
                    );
                };
            });
        }
    ).controller
    ('ClassiDetailsInstanceCtrl', 
        function ($scope, $modalInstance,$http, data) 
        {
            $scope.data = data;
            $scope.ok = function () {

		$modalInstance.close( );

            };         
        }
    ).controller
    ('CreateNewClassificationInstanceCtrl', 
        function ($scope, $modalInstance,$http, data,sites,projectData) 
        {
            $scope.data = data;
            $scope.projectData = projectData;
            $scope.recselected = '';
            $scope.showselection = false;
            $scope.sites = sites;
            $scope.datas = {
              name : '' ,
              classifier: ''
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
                var url = $scope.projectData.url;
                $scope.all = 0;
                $scope.selectedSites = []
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
                $http.post('/api/project/'+url+'/classification/new', 
                    {
                        n:$scope.datas.name,
                        c:$scope.datas.classifier.model_id,
                        a:$scope.all,
                        s:$scope.selectedSites.join()
                    }
                ).
                success
                (
                    function(data, status, headers, config) 
                    {
			$modalInstance.close( data );
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
                return  !(
                            flag
                            && $scope.datas.name.length
                            && !((typeof $scope.datas.classifier) == 'string')
                        ) ;
            };
            
            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
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
            return  {restrict : 'E', templateUrl: template_root + 'classificationlist.html'} 

        }
    );
}
)(angular);
