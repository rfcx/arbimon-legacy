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
	    $scope.loading = true;

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
		$scope.infoInfo = "Loading...";
		$scope.showInfo = true;
		$scope.loading = true;
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
        function ($scope, $modalInstance,$http,$timeout,projectData,playlists) 
        {
	    
            $scope.projectData = projectData;
	    $scope.playlists = playlists;
	    $scope.buttonEnableFlag = true;
            $scope.datasubmit = {
              name : '' ,
              playlist: '',
	      aggregation : '',
	      threshold : '' ,
	      bin : 86,
	      bandwidth : ''
            };
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
			b:$scope.datasubmit.bin,
			f:$scope.datasubmit.bandwidth 
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
			   ((typeof $scope.datasubmit.bin.length)  == 'string')
			    || $scope.datasubmit.aggregation.length  == 0 
			    || ((typeof $scope.datasubmit.threshold.length)  == 'string')
			    || ((typeof $scope.datasubmit.bandwidth.length)  == 'string')
			    || $scope.datasubmit.name.length  == 0
                            || ((typeof $scope.datasubmit.playlist) == 'string')
                        ) ;
            };
            
            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
            };
	    
	    $timeout(function()
		{
		    if(!$scope.$$phase)
		    {
			$('#binhzlist').selectable(
			    {
				stop: function() {
				$( ".ui-selected", this ).each(function() {
				    $scope.datasubmit.bin = this.id;
				});
				}
			    }
			);
			$('#binhzlist li:nth-child(3)').addClass('ui-selected');
			$scope.$apply();
		    }
		      
		},
	    0);
	    $scope.thresholdValue = function(val)
	    {
		$scope.datasubmit.threshold = val;
	    };
	    $scope.banwidthValue = function(val)
	    {
		$scope.datasubmit.bandwidth = val;
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
    ).
    directive('a2Thresholdselector',
	function()
        {
	    return {	
		restrict : 'E',
		scope: {
		    "onThreshold": "=" ,
		    "onBandwidth": "=" 
		},
                templateUrl: template_root + 'thresholdselector.html',
		controller :['$scope', '$http',
		function($scope, $http)
		{
		    var data = [0.7,1.0,0.1,0.55,0.1,0.6,0.9,0.01,0.15,0.1,0.4,0.1]
		    var lineData = [];
		    for (var i= 0 ; i < data.length ; i++)
		    {
			lineData.push({x:(i+1),y:data[i]})
		    }
		    var peaks = [
			{x:2.6 , y:1.0 , d:999999},
			{x:4.4 , y:0.55 , d:210},
			{x:7 , y:0.9 , d:520},
			{x:9 , y:0.15,d:750},
			{x:11 , y:0.4, d:950}
		    ]
		    var vis = d3.select('#thresholdvisualisation'),
		    
			WIDTH = 250,
			HEIGHT = 70,
			MARGINS = {
			  top: 10,
			  right: 10,
			  bottom: 10,
			  left: 24
			},
			
			xRange = d3.scale.linear().
			range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(lineData, function(d) {
			  return d.x;
			}), d3.max(lineData, function(d) {
			  return d.x;
			})]),
			
			yRange = d3.scale.linear().domain([0,1]).range([HEIGHT - MARGINS.top, MARGINS.bottom]),
			
			xAxis = d3.svg.axis()
			    .scale(xRange)
			    .ticks(0),
			  
			yAxis = d3.svg.axis()
			    .scale(yRange)
			    .ticks(3)
			    .tickSize(3)
			    .orient('left')
			    .tickSubdivide(true);
			  
		    $scope.threshold = 100;
		    $scope.$watch('threshold',
			function()
			{
			    $scope.thresholdPerc = (100-$scope.threshold)/100;
			    yval = 50*(1-$scope.thresholdPerc) + 10
			    vis.selectAll("line.movingline").remove()
			    $scope.line=  vis.append('svg:line')
					    .attr("x1", MARGINS.left)
					    .attr("y1", yval)
					    .attr("x2", WIDTH-MARGINS.right)
					    .attr("y2", yval)  .attr('stroke', 'red')
					    .attr('stroke-width', 2)
					    .attr('fill', 'none').attr('class','movingline');
			    vis.selectAll("text.peakText").remove()		
			    var peaki = 1;
			    for (var i = 0 ; i < peaks.length;i++)
			    {
				if (peaks[i].y >= $scope.thresholdPerc && peaks[i].d >= $scope.banwidthValue)
				{			    
				    $scope.peakText = vis.append("text")     
					.attr("x", WIDTH*(peaks[i].x/lineData.length) )
					.attr("y",  50*(1-peaks[i].y) + 10 ).attr('font-size','11px')
					.style("text-anchor", "middle").attr('class','peakText')
					.text("P"+(peaki ));
				    peaki  = peaki  + 1;
				}   
			    }
			    $scope.onThreshold($scope.thresholdPerc);
			}
		    );
				
				
		    $scope.banwidth = 0;
		    $scope.banwidthValue = 0;
		    $scope.$watch('banwidth',
			function()
			{
			    $scope.banwidthPerc = ($scope.banwidth)/100;
			    $scope.banwidthValue = Math.round(1000*$scope.banwidthPerc);
			    xval = Math.floor( WIDTH*(peaks[0].x/lineData.length)) -11 + 190*($scope.banwidthPerc)
			    vis.selectAll("line.movingline1").remove()
					  
			    $scope.line = vis.append('svg:line')
					    .attr("x1",xval)
					    .attr("y1", 12)
					    .attr("x2",xval)
					    .attr("y2", 60)  .attr('stroke', 'red')
					    .attr('stroke-width', 2)
					    .attr('fill', 'none').attr('class','movingline1');
		      
			    vis.selectAll("text.peakText").remove()
			
			    var peaki = 1;
			    for (var i = 0 ; i < peaks.length;i++)
			    {
				if (peaks[i].y >= $scope.thresholdPerc && peaks[i].d > $scope.banwidthValue)
				{
				
				    $scope.peakText = vis.append("text")     
					.attr("x", WIDTH*(peaks[i].x/lineData.length) )
					.attr("y",  50*(1-peaks[i].y) + 10 ).attr('font-size','11px')
					.style("text-anchor", "middle").attr('class','peakText')
					.text("P"+(peaki ));
				    peaki  = peaki  + 1;
				}   
			    }
			    $scope.onBandwidth($scope.banwidthValue);
			}
		    );
		    vis.append('svg:g')
			.attr('class', 'thresholdaxis')
			.attr('transform', 'translate(0,' + (HEIGHT - MARGINS.bottom) + ')')
			.call(xAxis);
		     
		    vis.append('svg:g')
			.attr('class', 'thresholdaxis')
			.attr('transform', 'translate(' + (MARGINS.left) + ',0)')
			.call(yAxis);
		      
		    var lineFunc = d3.svg.line()
			.x(function(d) {
			  return xRange(d.x);
			})
			.y(function(d) {
			  return yRange(d.y);
			})
			.interpolate('linear');
		      
		    vis.append('svg:path')
			.attr('d', lineFunc(lineData))
			.attr('stroke', 'blue')
			.attr('stroke-width', 2)
			.attr('fill', 'none');
		      
		    $scope.line=  vis.append('svg:line')
			.attr("x1",Math.floor( WIDTH*(peaks[0].x/lineData.length)) -11)
			.attr("y1", 12)
			.attr("x2",Math.floor( WIDTH*(peaks[0].x/lineData.length)) -11)
			.attr("y2", 60)  .attr('stroke', 'red')
			.attr('stroke-width', 2)
			.attr('fill', 'none');
		      
		    vis.append("text")    
			.attr("x", WIDTH/2 )
			.attr("y",  68 ).attr('font-size','9px')
			.style("text-anchor", "middle")
			.text("Hz");
		}]
    	    }
	}
    );
}
)(angular);
