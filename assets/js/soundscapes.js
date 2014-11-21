(function(angular)
{ 
    var soundscapes = angular.module('soundscapes', ['ui.bootstrap' , 'a2services' , 'ui-rangeSlider']);
    var template_root = '/partials/soundscapes/';

    soundscapes.controller
    ('SoundscapesCtrl' , 
        function ($scope,$http,$modal,$filter,$sce,Project,JobsData,ngTableParams,a2Playlists) 
        {
	    $scope.successInfo = "";
	    $scope.showSuccess = false;
	    $scope.errorInfo = "";
	    $scope.showError = false;
	    $scope.infoInfo = "Loading...";
            $scope.showInfo = true;
	    $scope.infopanedata = '';
	    
	    var p = Project.getInfo(
            function(data)
            {
                $scope.projectData = data;
		a2Playlists.getList(
		  function(data)
		  {
		    $scope.playlists = data;
		  }
		);
                $scope.pid = data.project_id;
                $scope.url = data.url;
                $http.get('/api/project/'+data.url+'/soundscapes/details')
                .success
                (
                    function(data) 
                    {
			$scope.soundscapesOriginal = data;
			$scope.soundscapesData = data;
			$scope.infoInfo = "";
			$scope.showInfo = false;
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
				total: $scope.soundscapesOriginal.length,
				getData: function ($defer, params) 
				{

				    $defer.resolve($scope.soundscapesData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
				    $scope.soundscapesData = $scope.soundscapesOriginal.slice((params.page() - 1) * params.count(), params.page() * params.count())
				}
			    }
			    ); 
			}
			else 
			{
			    $scope.infopanedata = "No soundscapes found.";
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
	    });
	    
	    $scope.createNewSoundscape =             
	    function ()
	    {
		var modalInstance = $modal.open
		(
		    {
			templateUrl: template_root + 'createnewsoundscape.html',
			controller: 'CreateNewSoundscapeInstanceCtrl',
			resolve: 
			{
			    playlists:function()
			    {
				return $scope.playlists;
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
		});
		
		modalInstance.result.then
		(
		    function (result) 
		    {
			data = result
			if (data.ok)
			{
			    JobsData.updateJobs();
			    $scope.successInfo = "New Soundscape on Queue";
			    $scope.showSuccess = true;
			    $("#successDiv").fadeTo(3000, 500).slideUp(500,
			    function()
			    {
				$scope.showSuccess = false;
			    });
			}
			
			if (data.err)
			{
			    $scope.errorInfo = "Error Creating Soundscape Job";
			    $scope.showError = true;
			    $("#errorDiv").fadeTo(3000, 500).slideUp(500,
			    function()
			    {
				$scope.showError = false;
			    });
			}
		    }
		);
	    };
	}
    )
    .directive
    ('a2Soundscapes',
        function()
        {
            return  {restrict : 'E', templateUrl: template_root + 'main.html'} 

        }
    ).directive
    ('a2Soundscapelist',
        function()
        {
            return  {restrict : 'E',
                    templateUrl: template_root + 'soundscapelist.html'} 

        }
    ).controller
    ('CreateNewSoundscapeInstanceCtrl', 
        function ($scope, $modalInstance,$http,projectData,playlists) 
        {
            $scope.projectData = projectData;
	    $scope.playlists = playlists;
	    $scope.buttonEnableFlag = true;
            $scope.datasubmit = {
              name : '' ,
              playlist: '',
	      aggregation : '',
	      threshold : 0.0
            };
	    $scope.threshold = 0;
	    $scope.nameMsg = '';
	    $scope.aggregationValue = function(val)
	    {
		$scope.$apply(function () {
		    $scope.datasubmit.aggregation = val;
		});
	    };
	    $scope.$watch('threshold',
		function()
		{
		    $scope.datasubmit.threshold = $scope.threshold/100;
		}
	    );
            $scope.ok = function () {
		
                var url = $scope.projectData.url;
		$scope.nameMsg = '';
                $http.post('/api/project/'+url+'/soundscape/new', 
                    {
                        n:$scope.datasubmit.name,
			p:$scope.datasubmit.playlist,
			a:$scope.datasubmit.aggregation,
			t:$scope.datasubmit.threshold,
			m:22050,
			b:86
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
                return  (
			    $scope.datasubmit.aggregation.length  == 0
			    || $scope.datasubmit.name.length  == 0
                            || ((typeof $scope.datasubmit.playlist) == 'string')
                        ) ;
            };
            
            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
            };
            
        }
    ).
    directive('a2Aggregationtypeselector',
	function()
        {
            return  {
		restrict : 'E',
		scope: {
		    "onSelected": "="
		},
                templateUrl: template_root + 'aggregationtypetelector.html',
		controller: ['$scope', '$http', function($scope, $http) {
		
		    $scope.messages =[
			'Hour in Day',
			'Day in Week',
			'Day in Month',
			'Month in Year',
			'Day in Year',
			'Year',				
		    ];
		    
		    $scope.tickesString = [
		        ['00:00','01:00','......','22:00','23:00'],
			['Sun','Mon','......','Fri','Sat'],
			['1','2','......','30','31'],
			['Jan','Feb','......','Nov','Dec'],
			['1','2','......','365','366'],
			['2010','2011','......','2016','2017']	
		    ];
		    
		    $scope.identifier =
		    [
			'time_of_day',
			'day_of_week',
			'day_of_month',
			'month_in_year',
			'day_of_year',
			'year'
		    ];
	
		    $scope.width = 200;
		    $scope.padding = 18;
		    $scope.height = 20;    
		    $scope.draw = function (who)
		    {
			$scope.svgContainer = d3.select("#aggregationlist").append("li")
						    .attr('data-toggle','tooltip')
						    .attr('display','block')
						    .attr('data-placement','right')
						    .attr('title',$scope.messages[who])
						    .attr("class", "btn btn-default a2-li-spaced")
						    .attr("id",$scope.identifier[who])
						.append("svg")
						    .attr("width", $scope.width)
						    .attr("height",$scope. height);
						    
			$scope.axisScale = d3.scale.linear()
					.domain([0,4])
					.range([$scope.padding, $scope.width - $scope.padding]);
			$scope.tickesStringsel = $scope.tickesString[who];
			$scope.xAxis = d3.svg.axis()
				    .scale($scope.axisScale)
				    .orient("bottom")
				    .ticks(5)
				    .tickValues([0,1,2,3,4])
				    .tickFormat(function(d) { return ($scope.tickesStringsel[d]); });
			
			$scope.xAxisGroup = $scope.svgContainer.append("g")
				    .attr("transform","translate(0,1)")
				    .attr("class", "aggregationaxis")
				    .call($scope.xAxis);
		    }
		    
		    for(var i = 0; i < 6; i++)
		    {
			    $scope.draw(i);
		    }
		    
		    $("#aggregationlist").selectable(			     
			{
			    stop: function() {
			    $( ".ui-selected", this ).each(function() {
				$scope.onSelected(this.id);
			    });
			    }
			}				     
		    );
		    
		}]
	    } 

        }
    );
}
)(angular);
