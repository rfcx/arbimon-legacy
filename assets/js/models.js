(function(angular)
{ 
    var models = angular.module('models', ['ngTable','ui.bootstrap','a2services', 'ui.select']);
    var template_root = '/partials/models/';
    var amazons3 = "https://s3.amazonaws.com/arbimon2/";
    models.controller
    ('ModelsCtrl' , 
        function ($scope,$http,$modal,$filter,$sce, ngTableParams,Project,JobsData) 
        {
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
	    };
	    
            var pid=-1;
            var p = Project.getInfo(
                function(data)
                {
                    $scope.projectData = data;
                    pid = data.project_id;
                    $http.get('/api/project/'+data.url+'/models')
                    .success
                    (
                        function(data) 
                        {
                                $scope.modelsData = data;
				$scope.modelsDataOrig = data;
                                $scope.infopanedata = "";
                                $scope.successInfo = "";
                                $scope.showSuccess = false;
                                $scope.errorInfo = "";
                                $scope.showError = false;
				$scope.infoInfo = "";
                                $scope.showInfo = false;
                                if(data.length> 0)
                                {              
                                    $scope.tableParams = new ngTableParams
                                    (
                                    {
                                        page: 1,          
                                        count: 10,      
                                        filter: {

                                        },     
                                        sorting: {
                                            mname: 'asc'     
                                        }
                                    }, 
                                    {
                                        total: $scope.modelsDataOrig.length,
                                        getData: function ($defer, params) 
                                        {
					    $scope.infopanedata = "";
                                            var filteredData = params.filter() ?
                                                    $filter('filter')($scope.modelsDataOrig  , params.filter()) :
                                                    $scope.modelsDataOrig  ;
                                            
                                            var orderedData = params.sorting() ?
                                                    $filter('orderBy')(filteredData, params.orderBy()) :
                                                    $scope.modelsDataOrig ;
                                            params.total(orderedData.length);
                                            $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                                            if(orderedData.length < 1)
                                            {
                                                $scope.infopanedata = "No models found.";
                                            }
					    $scope.modelsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count())
                                        }
                                    }
                                    ); 
                                }
                                else 
                                {
                                    $scope.infopanedata = "No models found.";
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
                }
            );

            $scope.newClassification =
            function (model_id,model_name)
            {
                var modalInstance = $modal.open
                (
                    {
                        templateUrl: template_root + 'newclassification.html',
                        controller: 'NewClassificationInstanceCtrl',
                        resolve: 
                        {
                            model_name: function () 
                            {
                              return model_name;
                            },
                            model_id: function () 
                            {
                              return model_id;
                            }
                        }
                    }
                );
                
                modalInstance.result.then
                (
                    function () 
                    {
                        console.log('new classification: ' + new Date());
                    }
                );
            };
            $scope.deleteModel =
            function (model_id,model_name)
            {
		$scope.infoInfo = "Loading...";
		$scope.showInfo = true;

                var modalInstance = $modal.open
                (
                    {
                        templateUrl: template_root + 'deletemodel.html',
                        controller: 'DeleteModelInstanceCtrl',
                        resolve: 
                        {
                            model_name: function () 
                            {
                                return model_name;
                            },
                            model_id: function () 
                            {
                                return model_id;
                            },
                            projectData: function ()
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
		});
		
                modalInstance.result.then
                (
                    function () 
                    {
			var index = -1;		
			var modArr = eval( $scope.modelsDataOrig );
			for( var i = 0; i < modArr.length; i++ ) 
			{
			    if( modArr[i].model_id === model_id ) 
			    {
				index = i;
				break;
			    }
			}
			if( index > -1 ) 
			{
			    $scope.modelsDataOrig.splice( index, 1 );
			    $scope.tableParams.reload();
			    $scope.successInfo = "Model Deleted Successfully";
			    $scope.showSuccess = true;
			    $("#successDiv").fadeTo(3000, 500).slideUp(500,
			    function()
			    {
				$scope.showSuccess = false;
			    });
                        }
                    }
                );
            };

            $scope.showModelDetails =
            function (model_id)
            {
		$scope.infoInfo = "Loading...";
		$scope.showInfo = true;
                var url = $scope.projectData.url;
                $http.get('/api/project/'+url+'/models/'+model_id)
                .success
                (
                    function(data) 
                    {   
			$scope.data = data;
			var modalInstance = $modal.open
			(
			    {
				templateUrl: template_root + 'modelinfo.html',
				controller: 'ModelDetailsInstanceCtrl',
				windowClass: 'models-modal-window',
				resolve: 
				{
				    data: function () 
				    {
				      return $scope.data;
				    }
				}
			    }
			);
			
			modalInstance.opened.then(function()
			{
			    $scope.infoInfo = "";
			    $scope.showInfo = false;    
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


            $scope.newModel = 
            function ()
            {
		$scope.infoInfo = "Loading...";
		$scope.showInfo = true;
                var url = $scope.projectData.url;
                $http.get('/api/project/'+url+'/models/forminfo')
                .success
                (
                    function(data) 
                    {

                        var modalInstance = $modal.open
                        (
                            {
                                templateUrl: template_root + 'newmodel.html',
                                controller: 'NewModelInstanceCtrl',
                                resolve: 
                                {
                                    projectData: function ()
                                    {
                                        return $scope.projectData;
                                    },
                                    types: function()
                                    {
                                        return data.types;
                                    },
                                    trainings: function()
                                    {
                                        return data.trainings;
                                    }
                                }
                            }
                        );
               		modalInstance.opened.then(function()
			{
			    $scope.infoInfo = "";
			    $scope.showInfo = false;    
			});
			         
                        modalInstance.result.then
                        (
                            function (result) 
                            {
				data = result
				if (data.ok)
				{
				    JobsData.updateJobs();
				    $scope.successInfo = "New Model Training on Queue";
				    $scope.showSuccess = true;
				    $("#successDiv").fadeTo(3000, 500).slideUp(500,
				    function()
				    {
					$scope.showSuccess = false;
				    });
				}
				
				if (data.err)
				{
				    $scope.errorInfo = "Error Creating Training Job";
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

        }
    ).controller
    ('NewModelInstanceCtrl', 
        function ($scope, $modalInstance,$http,projectData,types,trainings) 
        {
            $scope.types = types;
            $scope.projectData = projectData;
            $scope.trainings = trainings;
	    $scope.nameMsg = '';
            $scope.data = 
            {
                training : '',
                classifier : '',
                name : '',
		totalValidations : 'Retrieving...',
		presentValidations: '-',
		absentsValidations: '-',
		usePresentTraining: '',
		useNotPresentTraining: '',
		usePresentValidation: -1,
		useNotPresentValidation: -1
            };
	    
	    $scope.$watch('data.usePresentTraining',
	    function()
	    {
		var val = $scope.data.presentValidations - $scope.data.usePresentTraining;
		if (val > -1)
		{
		   $scope.data.usePresentValidation = val;
		}
		else
		    $scope.data.usePresentValidation = 0;
		
		if($scope.data.usePresentTraining > $scope.data.presentValidations) 
		    $scope.data.usePresentTraining =  $scope.data.presentValidations
		    
	    });

	    $scope.$watch('data.useNotPresentTraining',
	    function()
	    {
		var val = $scope.data.absentsValidations - $scope.data.useNotPresentTraining;
		if (val > -1)
		{
		   $scope.data.useNotPresentValidation = val;
		}
		else
		    $scope.data.useNotPresentValidation = 0;
		
		if($scope.data.useNotPresentTraining > $scope.data.absentsValidations) 
		    $scope.data.useNotPresentTraining =  $scope.data.absentsValidations;
		
	    });
	    
	    $scope.$watch('data.training',
	    function()
	    {
		if($scope.data.training != '')
		{
		    $http.get('/api/project/'+$scope.projectData.url+'/validations/'+$scope.data.training.species_id+"/"+$scope.data.training.songtype_id)
		    .success
		    (
			function(data) 
			{
			    $scope.data.totalValidations = data[0].total
			    $scope.data.presentValidations = data[0].present
			    $scope.data.absentsValidations = data[0].absent
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
	    });
	    
            $scope.buttonEnable = function () 
            {
                return  !(   $scope.trainings.length 
                            && $scope.data.name.length
			    && $scope.data.usePresentTraining >0
			    && $scope.data.useNotPresentTraining >0
			    && $scope.data.usePresentValidation >0
			    && $scope.data.useNotPresentValidation >0
                            && !((typeof $scope.data.training) == 'string')  
                            && !((typeof $scope.data.classifier) == 'string')
                        ) ;
            };

            $scope.ok = function () {
                var url = $scope.projectData.url;
		$scope.nameMsg = '';
                $http.post('/api/project/'+url+'/models/new', 
                    {
                        n:$scope.data.name,
                        t:$scope.data.training.training_set_id,
                        c:$scope.data.classifier.model_type_id  ,
			tp:$scope.data.usePresentTraining,
			tn:$scope.data.useNotPresentTraining,
			vp:$scope.data.usePresentValidation,
			vn:$scope.data.useNotPresentValidation
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

            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
            };

        }
    ).controller
    ('DeleteModelInstanceCtrl', 
        function ($scope, $modalInstance,$http,model_name,model_id,projectData) 
        {
            $scope.model_name = model_name;
            $scope.model_id = model_id;
            $scope.projectData = projectData;
            var url = $scope.projectData.url;
            $scope.ok = function () {
                $http.get('/api/project/'+url+'/models/'+model_id+"/delete")
                .success
                (
                    function(data) 
                    {
                        $modalInstance.close(   );
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

            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
            };

        }
    ).controller
    ('NewClassificationInstanceCtrl', 
        function ($scope, $modalInstance,model_name,model_id) 
        {
            $scope.model_name = model_name;
            $scope.model_id = model_id;
            $scope.ok = function () {
                $modalInstance.close(   );
            };

            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
            };

        }
    ).controller
    ('ModelDetailsInstanceCtrl', 
        function ($scope, $modalInstance,data) 
        {
	    var json = JSON.parse(data[0]['json']);
	    $scope.data = {
		modelmdc : data[0].mdc, //ok
		modelmtime : data[0].mtime,//ok
		modelmname : data[0].mname,//ok
		modelmtname : data[0].mtname,//ok
		modelmuser : data[0].muser,//ok
		modelmodel_id : data[0].model_id,//ok
		png : amazons3+json['roipng'],//ok
		lasttime : data[0].lasttime,//ok
		lastupdate : data[0].lastupdate,//ok
		remarks : data[0].remarks,
		songtype : data[0].songtype,//ok
		species : data[0].species,//ok
		trainingName : data[0].trainingSetName,//ok
		trainingDate : data[0].trainingSetdcreated,//ok
		trainingTime : data[0].trainingSettime,//ok
		all:data[0].use_in_training_present + data[0].use_in_validation_present+data[0].use_in_training_notpresent + data[0].use_in_validation_notpresent,//ok
		p : data[0].use_in_training_present + data[0].use_in_validation_present,//ok
		np : data[0].use_in_training_notpresent + data[0].use_in_validation_notpresent,//ok
		tnp : data[0].use_in_training_notpresent,//ok
		tp : data[0].use_in_training_present,//ok
		vnp : data[0].use_in_validation_notpresent,//ok
		vp : data[0].use_in_validation_present,//ok
		accuracy :  Math.round(json['accuracy'] * 100) / 100 ,//ok
		oob : Math.round(json['forestoobscore'] * 100) / 100  ,//ok
		precision : Math.round(json['precision'] * 100) / 100,//ok
		sensitivity  : json['sensitivity'] != null ? Math.round(json['sensitivity'] * 100) / 100:null,//ok
		specificity  : json['specificity'] != null ? Math.round(json['specificity'] * 100) / 100:null,//ok
		tpos : json['tp'],
		fpos : json['fp'],
		tneg : json['tn'],
		fneg : json['fn'],
		roicount : json['roicount'],//ok
		hfreq : Math.round(json['roihighfreq']* 100) / 100,//ok
		lfreq : Math.round(json['roilowfreq']* 100) / 100,//ok
		rlength : Math.round(json['roilength']* 100) / 100,//ok
		bw :  Math.round( ((  parseFloat(json['roihighfreq']) - parseFloat(json['roilowfreq']) ) * 100)) / 100,
		freqMax : json['roisamplerate']/2//ok
	    }
            $scope.ok = function () {
                $modalInstance.close(   );
            };

        }
    ).directive
    ('a2Models',
        function()
        {
            return  {restrict : 'E', templateUrl: template_root + 'main.html'} 

        }
    ).directive
    ('a2Modellist',
        function()
        {
            return  {restrict : 'E', templateUrl: template_root + 'modellist.html'} 

        }
    );
}
)(angular);

