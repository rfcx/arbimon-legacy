(function(angular)
{ 
    var soundscapes = angular.module('soundscapes', ['ui.bootstrap' , 'a2services' , 'ui-rangeSlider']);
    var template_root = '/partials/soundscapes/';

    soundscapes.controller('SoundscapesCtrl' , 
        function ($scope, $http, $modal, $filter, Project, JobsData, ngTableParams, a2Playlists, $location) 
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
                    
                    a2Playlists.getList(function(data) {
                            $scope.playlists = data;
                    });
                    
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
                                count: 10,      
                                filter: {

                                },     
                                sorting: {
                                    name: 'asc'     
                                }
                            }, 
                            {
                                total: $scope.soundscapesOriginal.length,
                                getData: function ($defer, params) 
                                {
                                    $scope.infopanedata = "";
                                    var filteredData = params.filter() ?
                                            $filter('filter')($scope.soundscapesOriginal , params.filter()) :
                                            $scope.soundscapesOriginal  ;
                                    
                                    var orderedData = params.sorting() ?
                                            $filter('orderBy')(filteredData, params.orderBy()) :
                                            $scope.soundscapesOriginal ;
                                    params.total(orderedData.length);
                                    $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                                    if(orderedData.length < 1)
                                    {
                                        $scope.infopanedata = "No classifications found.";
                                    }
                                    $scope.soundscapesData  = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
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
            
            
            $scope.deleteSoundscape = function (id,name) {
                
                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;
                $scope.loading = true;
                var modalInstance = $modal.open({
                    templateUrl: template_root + 'deletesoundscape.html',
                    controller: 'DeleteSoundscapeInstanceCtrl',
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
                        var modArr = eval($scope.soundscapesOriginal);
                        for (var i = 0; i < modArr.length; i++) {
                            if (modArr[i].soundscape_id === id) {
                                index = i;
                                break;
                            }
                        }
                        if (index > -1) {
                            $scope.soundscapesOriginal.splice(index, 1);
                            $scope.tableParams.reload();
                            $scope.successInfo = "Soundscape Deleted Successfully";
                            $scope.showSuccess = true;
                            $("#successDiv").fadeTo(3000, 500).slideUp(500,
                                function() {
                                    $scope.showSuccess = false;
                            });
                        }
                    }
                );
            };
            
            
            $scope.createNewSoundscape = function () {
                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;
                $scope.loading = true;
                var modalInstance = $modal.open
                (
                    {
                        templateUrl: template_root + 'createnewsoundscape.html',
                        controller: 'CreateNewSoundscapeInstanceCtrl',
                        resolve: {
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
                    data = result;
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
                    
                    if (data.url)
                    {
                        $location.path(data.url);
                    }
                    }
                );
            };
            
            
            $scope.showDetails = function(soundscapeId) {
                
                var modalInstance = $modal.open({
                    controller: 'SoundscapesDetailsCtrl',
                    templateUrl: '/partials/soundscapes/details.html',
                    resolve: {
                        soundscapeId: function() {
                            return soundscapeId;
                        }
                    }
                });
            };
        }
    )
    .controller('DeleteSoundscapeInstanceCtrl',
        function($scope, $modalInstance, $http, name, id, projectData) {
            $scope.name = name;
            $scope.id = id;
            $scope.projectData = projectData;
            var url = $scope.projectData.url;
            $scope.ok = function() {
                $http.get('/api/project/' + url + '/soundscapes/' + id + "/delete")
                    .success(
                        function(data) {
                            $modalInstance.close();
                        }
                    ).error(
                        function() {
                            $scope.errorInfo = "Error Communicating With Server";
                            $scope.showError = true;
                            $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                function() {
                                    $scope.showError = false;
                                });
                        }
                    );
            };

            $scope.cancel = function() {
                $modalInstance.dismiss('cancel');
            };

        }
    )
    .directive
    ('a2Soundscapes',
        function()
        {
            return  {restrict : 'E', templateUrl: template_root + 'main.html'}; 

        }
    )
    .directive
    ('a2Soundscapelist',
        function()
        {
            return  {restrict : 'E',
                    templateUrl: template_root + 'soundscapelist.html'}; 

        }
    )
    .controller
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
                threshold : 0,
                bin : 86,
                bandwidth : 0
            };
            
            $scope.nameMsg = '';
            $scope.aggregationValue = function(val)
            {
                $scope.$apply(function () {
                    $scope.datasubmit.aggregation = val;
                });
            };
        
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
                )
                .success(
                    function(data, status, headers, config) 
                    {
                        if (data.name)
                        {
                            $scope.nameMsg = 'Name exists';
                        }
                        else {
                            $modalInstance.close( data );
                        }
                    }
                )
                .error(
                    function(data, status, headers, config) 
                    {
                        $modalInstance.close( {err:"Cannot create job"});
                    }
                );
            };
            
            $scope.buttonEnable = function () 
            {
                return  (
                    $scope.datasubmit.bin === 0 || 
                    ((typeof $scope.datasubmit.bin.length)  == 'string') || 
                    $scope.datasubmit.aggregation.length  === 0 || 
                    ((typeof $scope.datasubmit.threshold.length)  == 'string') || 
                    ((typeof $scope.datasubmit.bandwidth.length)  == 'string') || 
                    $scope.datasubmit.name.length  === 0 || 
                    ((typeof $scope.datasubmit.playlist) == 'string')
                ) ;
            };
            
            $scope.cancel = function (url) {
                 $modalInstance.close( {url:url});
            };
        
            // $scope.thresholdValue = function(val)
            // {
            //     $scope.datasubmit.threshold = val;
            // };
            // $scope.banwidthValue = function(val)
            // {
            //     $scope.datasubmit.bandwidth = val;
            // };
        }
    ).
    directive('a2Aggregationtypeselector', function() {
            return  {
                restrict : 'E',
                scope: {
                    "selected": "="
                },
                templateUrl: template_root + 'aggregationtypetelector.html',
                controller: ['$scope', function($scope) {
                
                    $scope.aggregations = [
                        {
                            name: 'Hour in Day',
                            scale: ['00:00', '01:00', '......', '22:00', '23:00'],
                            id: 'time_of_day'
                        }, 
                        {
                            name: 'Day in Week',
                            scale: ['Sun', 'Mon', '......', 'Fri', 'Sat'],
                            id: 'day_of_week'
                        }, 
                        {
                            name: 'Day in Month',
                            scale: ['1', '2', '......', '30', '31'],
                            id: 'day_of_month'
                        }, 
                        {
                            name: 'Month in Year',
                            scale: ['Jan', 'Feb', '......', 'Nov', 'Dec'],
                            id: 'month_in_year'
                        }, 
                        {
                            name: 'Day in Year',
                            scale: ['1', '2', '......', '365', '366'],
                            id: 'day_of_year'
                        }, 
                        {
                            name: 'Year',
                            scale: ['2010', '2011', '......', '2016', '2017'],
                            id: 'year'
                        }
                    ];
            
                    $scope.width = 200;
                    $scope.padding = 18;
                    $scope.height = 20;
                    
                    
                    $scope.select =  function(aggr) {
                        $scope.selected = aggr.id;
                    };
                }]
            }; 
        }
    )
    .directive('a2DrawAggregation', function() {
        return {
            restrict : 'E',
            scope: {
                "aggregation": "="
            },
            link: function(scope, element, attrs) {
                
                // console.log(scope.aggregation);
                
                var draw = function(aggre) {
                    var width = 200;
                    var height = 20;
                    var padding = 18;
                    
                    var svgContainer = d3.select(element[0])
                                    .append("svg")
                                    .attr("width", width)
                                    .attr("height", height);
                                    
                    var axisScale = d3.scale.linear()
                            .domain([0,4])
                            .range([padding, width-padding]);
                            
                    
                    var xAxis = d3.svg.axis()
                            .scale(axisScale)
                            .orient("bottom")
                            .ticks(5)
                            .tickValues([0,1,2,3,4])
                            .tickFormat(function(d) { return aggre.scale[d]; });
                    
                    var xAxisGroup = svgContainer.append("g")
                            .attr("transform","translate(0,1)")
                            .attr("class", "aggregationaxis")
                            .call(xAxis);
                };
                
                scope.$watch('aggregation', function(value) {
                    if(value)
                        draw(value);
                });
            }
        };
    })
    .directive('a2ThresholdSelector',
        function()
        {
        return {    
            restrict : 'E',
            scope: {
                "threshold": "=" ,
                "bandwidth": "=" 
            },
            templateUrl: template_root + 'thresholdselector.html',
            link : function($scope) {
                $scope.$watch('threshold', function(n, o) {
                    console.log('threshold', n, o);
                    $scope.thresholdInvPercent = (1-$scope.threshold)*100;
                });
                
                $scope.$watch('thresholdInvPercent', function(n, o) {
                    console.log('thresholdInvPercent', n, o);
                    $scope.threshold = Math.round(100-$scope.thresholdInvPercent)/100;
                });
                
            }
        };
    }
    )
    .directive('a2DrawPeakThreshold',
        function()
        {
        return {    
            restrict : 'E',
            scope: {
                "threshold": "=" ,
                "bandwidth": "=" 
            },
            link: function($scope, element, attrs) {
                                
                
                var data = [0.7,1.0,0.1,0.55,0.1,0.6,0.9,0.01,0.15,0.1,0.4,0.1];
                var lineData = [];
                for(var i= 0 ; i < data.length ; i++) {
                    lineData.push({x:(i+1),y:data[i]});
                }
                
                var peaks = [
                    {x:2.6 , y:1.0 ,  d:999999},
                    {x:4.4 , y:0.55 , d:210},
                    {x:7 ,   y:0.9 ,  d:520},
                    {x:9 ,   y:0.15,  d:750},
                    {x:11 ,  y:0.4,   d:950}
                ];
                
                var WIDTH = 250,
                HEIGHT = 70,
                MARGINS = {
                    top: 10,
                    right: 10,
                    bottom: 10,
                    left: 24
                };
                
                var vis = d3.select(element[0]).append('svg')
                    .attr('width', WIDTH)
                    .attr('height', HEIGHT);
                
                
                var xRange = d3.scale.linear().
                range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(lineData, function(d) {
                  return d.x;
                }), d3.max(lineData, function(d) {
                  return d.x;
                })]);
                
                var yRange = d3.scale.linear().domain([0,1]).range([HEIGHT - MARGINS.top, MARGINS.bottom]);
                
                var xAxis = d3.svg.axis()
                    .scale(xRange)
                    .ticks(0);
                  
                var yAxis = d3.svg.axis()
                    .scale(yRange)
                    .ticks(3)
                    .tickSize(3)
                    .orient('left')
                    .tickSubdivide(true);
                
                var drawAmpThreshold = function(ampThresh) {
                    yval = 50*(1-ampThresh) + 10;
                    
                    vis.selectAll("line.movingline").remove();
                    
                    $scope.line=  vis.append('svg:line')
                        .attr("x1", MARGINS.left)
                        .attr("y1", yval)
                        .attr("x2", WIDTH-MARGINS.right)
                        .attr("y2", yval)  .attr('stroke', 'red')
                        .attr('stroke-width', 2)
                        .attr('fill', 'none').attr('class','movingline');
                    
                    vis.selectAll("text.peakText").remove();
                    
                    var peaki = 1;
                    for (var i = 0 ; i < peaks.length;i++)
                    {
                        if (peaks[i].y >= ampThresh && peaks[i].d >= $scope.bandwidth)
                        {                
                            $scope.peakText = vis.append("text")     
                            .attr("x", WIDTH*(peaks[i].x/lineData.length) )
                            .attr("y",  50*(1-peaks[i].y) + 10 ).attr('font-size','11px')
                            .style("text-anchor", "middle").attr('class','peakText')
                            .text("P"+(peaki ));
                            peaki = peaki + 1;
                        }
                    }
                };
                
                $scope.$watch('threshold', function() {
                    if(!$scope.threshold)
                        return;
                    
                    drawAmpThreshold($scope.threshold);
                });
                
                $scope.$watch('bandwidth',
                function()
                {
                    // $scope.banwidthPerc = ($scope.bandwidth)/100;
                    // $scope.banwidthValue = Math.round(1000*$scope.banwidthPerc);
                    $scope.banwidthValue = $scope.bandwidth;
                    xval = Math.floor( WIDTH*(peaks[0].x/lineData.length)) -11 + 190*($scope.bandwidth/1000);
                    vis.selectAll("line.movingline1").remove();
                          
                    $scope.line = vis.append('svg:line')
                            .attr("x1",xval)
                            .attr("y1", 12)
                            .attr("x2",xval)
                            .attr("y2", 60)  .attr('stroke', 'red')
                            .attr('stroke-width', 2)
                            .attr('fill', 'none').attr('class','movingline1');
                  
                    vis.selectAll("text.peakText").remove();
                
                    var peaki = 1;
                    for (var i = 0 ; i < peaks.length;i++)
                    {
                    if (peaks[i].y >= $scope.threshold && peaks[i].d > $scope.banwidthValue)
                    {
                    
                        $scope.peakText = vis.append("text")     
                        .attr("x", WIDTH*(peaks[i].x/lineData.length) )
                        .attr("y",  50*(1-peaks[i].y) + 10 ).attr('font-size','11px')
                        .style("text-anchor", "middle").attr('class','peakText')
                        .text("P"+(peaki ));
                        peaki  = peaki  + 1;
                    }   
                    }
                    // $scope.onBandwidth($scope.banwidthValue);
                    // console.log($scope.banwidthValue);
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
                  
                $scope.line = vis.append('svg:line')
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
            }
        };
    }
    )
    .controller('SoundscapesDetailsCtrl', [
        '$scope', 
        'a2Playlists', 
        'a2Soundscapes', 
        '$modalInstance', 
        'soundscapeId', 
        function($scope, a2Playlists, a2Soundscapes, $modalInstance, soundscapeId) {
        
        a2Soundscapes.get(soundscapeId, function(data) {
            $scope.soundscape = data;
            
            console.log(data);
            
            a2Playlists.getInfo(data.playlist_id, function(plist) {
                $scope.playlist = plist;
            });
        });
        
    }]);
}
)(angular);
