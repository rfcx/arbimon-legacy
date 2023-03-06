angular.module('a2.analysis.soundscapes', [
    'a2.services',
    'a2.permissions',
    'ui.bootstrap' ,
    'ui-rangeSlider',
    'ngCsv'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.soundscapes', {
        url: '/soundscapes',
        controller: 'SoundscapesCtrl as controller',
        templateUrl: '/app/analysis/soundscapes/list.html'
    });
})
.controller('SoundscapesCtrl', function(
    $window,
    $scope,
    $modal,
    $filter,
    Project,
    JobsData,
    ngTableParams,
    a2Playlists,
    $location,
    a2Soundscapes,
    notify,
    a2UserPermit
){
    var $=$window.$;
    $scope.successInfo = "";
    $scope.showSuccess = false;
    $scope.errorInfo = "";
    $scope.showError = false;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true;

    $scope.infopanedata = '';

    Project.getInfo(function(data){
        $scope.projectData = data;
        $scope.pid = data.project_id;
        $scope.url = data.url;
    });

    a2Playlists.getList().then(function(data) {
            $scope.playlists = data;
    });


    var initTable = function(p,c,s,f,t) {
        var sortBy = {};
        var acsDesc = 'desc';
        if (s[0]=='+') {
            acsDesc = 'asc';
        }
        sortBy[s.substring(1)] = acsDesc;
        $scope.tableParams = new ngTableParams(
            {
                page: p,
                count: c,
                sorting: sortBy,
                filter:f
            },
            {
                total: t,
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
                    a2Soundscapes.saveState({'data':$scope.soundscapesOriginal,
                                'filtered': $scope.soundscapesData,
                                'f':params.filter(),
                                'o':params.orderBy(),
                                'p':params.page(),
                                'c':params.count(),
                                't':orderedData.length});
                }
            }
        );
    };


    $scope.loadSoundscapes = function() {
        a2Soundscapes.getList2(function(data) {
            $scope.soundscapesOriginal = data;
            $scope.soundscapesData = data;
            $scope.infoInfo = "";
            $scope.showInfo = false;
            $scope.loading = false;

            $scope.infopanedata = "";

            if(data.length > 0) {
                if(!$scope.tableParams) {
                    initTable(1,10,"+name",{},data.length);
                }
                else {
                    $scope.tableParams.reload();
                }
            }
            else {
                $scope.infopanedata = "No soundscapes found.";
            }
        });
    };
    var stateData = a2Soundscapes.getState();

    if (stateData === null)
    {
        $scope.loadSoundscapes();
    }
    else
    {
        if (stateData.data.length > 0) {
            $scope.soundscapesData = stateData.filtered;
            $scope.soundscapesOriginal = stateData.data;
            initTable(stateData.p,stateData.c,stateData.o[0],stateData.f,stateData.filtered.length);
        }
        else {
            $scope.infopanedata = "No models found.";
        }
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
    }

    $scope.deleteSoundscape = function (id, name) {
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.log('You do not have permission to delete soundscapes');
            return;
        }

        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.loading = true;
        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/soundscapes/deletesoundscape.html',
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

        modalInstance.result.then(function(ret) {
                if (ret.error) {
                    notify.error("Error: "+ret.error);
                }
                else {
                    var index = -1;
                    var modArr = angular.copy($scope.soundscapesOriginal);
                    for (var i = 0; i < modArr.length; i++) {
                        if (modArr[i].soundscape_id === id) {
                            index = i;
                            break;
                        }
                    }
                    if (index > -1) {
                        $scope.soundscapesOriginal.splice(index, 1);
                        $scope.tableParams.reload();

                        notify.log("Soundscape deleted successfully");
                    }
                }
        });
    };


    $scope.createNewSoundscape = function () {
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.log('You do not have permission to create soundscapes');
            return;
        }

        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.loading = true;
        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/soundscapes/createnewsoundscape.html',
            controller: 'CreateNewSoundscapeInstanceCtrl',
            resolve: {
                amplitudeReferences : function(a2Soundscapes){
                    return a2Soundscapes.getAmplitudeReferences();
                },
                playlists:function()
                {
                    return $scope.playlists;
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


        modalInstance.result.then(function(result) {
            data = result;
            if (data.ok) {
                JobsData.updateJobs();
                notify.log("Your new soundscape is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            }

            if (data.err) {
                notify.error(data.err);
            }

            if (data.url) {
                $location.path(data.url);
            }
        });
    };

    $scope.showDetails = function(soundscapeId) {

        a2Soundscapes.get(soundscapeId, function(soundscape) {

            a2Playlists.getInfo(soundscape.playlist_id, function(plist) {

                var modalInstance = $modal.open({
                    controller: 'SoundscapesDetailsCtrl as controller',
                    templateUrl: '/app/analysis/soundscapes/details.html',
                    resolve: {
                        soundscape: function() {
                            return soundscape;
                        },
                        playlist: function() {
                            return plist;
                        }
                    }
                });

            });

        });

    };


    this.exportSoundscape = function(options) {
        if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
            return notify.log('You do not have permission to export soundscape data');
        }

        a2Soundscapes.getExportUrl(options).then(function(export_url){
            var a = $('<a></a>').attr('target', '_blank').attr('href', export_url).appendTo('body');
            $window.setTimeout(function(){
                a[0].click();
                a.remove();
            }, 0);
        });

    };

})
.controller('DeleteSoundscapeInstanceCtrl',function($scope, $modalInstance, a2Soundscapes, name, id, projectData) {
    $scope.name = name;
    $scope.id = id;
    $scope.projectData = projectData;
    var url = $scope.projectData.url;
    $scope.ok = function() {
        a2Soundscapes.delete(id, function(data) {
            $modalInstance.close(data);
        });
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

})
.controller('CreateNewSoundscapeInstanceCtrl', function($scope, $modalInstance, a2Soundscapes, $timeout, projectData, playlists) {

    $scope.projectData = projectData;
    $scope.playlists = playlists;
    $scope.buttonEnableFlag = true;
    $scope.datasubmit = {
        name : '' ,
        playlist: '',
        aggregation : '',
        threshold : 0,
        thresholdReference: 'absolute',
        bin : 86,
        bandwidth : 0,
        normalize:false
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
        a2Soundscapes.create({
                n: $scope.datasubmit.name,
                p: $scope.datasubmit.playlist,
                a: $scope.datasubmit.aggregation,
                t: $scope.datasubmit.threshold,
                tr: $scope.datasubmit.thresholdReference,
                m: 22050,
                b: $scope.datasubmit.bin,
                f: $scope.datasubmit.bandwidth,
                nv:$scope.datasubmit.normalize
            })
            .success(function(data) {
                if (data.name) {
                    $scope.nameMsg = 'Name exists';
                }
                else {
                    $modalInstance.close( data );
                }
            })
            .error(function(data) {
                if (data.err) {
                    $modalInstance.close( {err:"Error: "+data.err});
                }
                else {
                    $modalInstance.close( {err:"Error: Cannot create soundscape job"});
                }
            });
    };

    $scope.buttonEnable = function () {
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
})
.directive('a2Aggregationtypeselector', function() {
    return  {
        restrict : 'E',
        scope: {
            "selected": "="
        },
        templateUrl: '/app/analysis/soundscapes/aggregationtypetelector.html',
        controller: function($scope) {

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
        }
    };
})
.directive('a2DrawAggregation', function($window) {
    var d3 = $window.d3;

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
.directive('a2ThresholdSelector', function(a2Soundscapes) {
    return {
        restrict : 'E',
        scope: {
            "threshold": "=" ,
            "thresholdReference": "=" ,
            "bandwidth": "="
        },
        templateUrl: '/app/analysis/soundscapes/thresholdselector.html',
        link : function($scope) {
            $scope.amplitudeReferences = [];
            var afterGetAmplitudeReferences = a2Soundscapes.getAmplitudeReferences().then(function(amplitudeReferences){
                $scope.amplitudeReferences = amplitudeReferences;
            });

            $scope.setAmplitudeReference = function(amplitudeReference){
                console.log("amplitudeReference", amplitudeReference);
                $scope.thresholdReference = amplitudeReference.value;
            };

            $scope.$watch('thresholdReference', function(thresholdReference) {
                afterGetAmplitudeReferences.then(function(){
                    console.log("thresholdReference", thresholdReference, $scope.amplitudeReferences);
                    $scope.amplitudeReference = $scope.amplitudeReferences.reduce(function(_, item){
                        return _ || (item.value == thresholdReference ? item : null);
                    });
                });
            });

            $scope.$watch('threshold', function(n, o) {
                console.log('threshold', n, o);
                $scope.thresholdInvPercent = (1-$scope.threshold)*100;
            });

            $scope.$watch('thresholdInvPercent', function(n, o) {
                console.log('thresholdInvPercent', n, o);
                var precision = 0.1;
                $scope.threshold = Math.round((100-$scope.thresholdInvPercent) / precision)/(100/precision);
            });

        }
    };
})
.directive('a2DrawPeakThreshold', function($window) {
    var d3 = $window.d3;
    return {
        restrict : 'E',
        scope: {
            "threshold": "=" ,
            "bandwidth": "="
        },
        link: function($scope, element, attrs) {


            var data = [0.7,1.0,0.1,0.55,0.1,0.6,0.9,0.01,0.15,0.1,0.4,0.1];
            var data_scale = 0.5;
            var lineData = [];
            for(var i= 0 ; i < data.length ; i++) {
                lineData.push({x:(i+1),y:data[i] * data_scale});
            }

            var peaks = [
                {x:2.6 , y:1.0  * data_scale , d:999999},
                {x:4.4 , y:0.55 * data_scale , d:210},
                {x:7 ,   y:0.9  * data_scale , d:520},
                {x:9 ,   y:0.15 * data_scale , d:750},
                {x:11 ,  y:0.4  * data_scale , d:950}
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
})
.controller('SoundscapesDetailsCtrl', function($scope, soundscape, playlist, a2Soundscapes, a2UserPermit) {
    $scope.showDownload = a2UserPermit.can('manage soundscapes');

    var data2xy = function(offset) {
        offset = offset || 0;

        return function(d, i) {
            return { x: i+offset, y: d };
        };
    };

    $scope.soundscape = soundscape;
    $scope.playlist = playlist;

    $scope.chartOptions = {
        lineColor: '#c42',
        width: 400,
        height: 400
    };

    a2Soundscapes.getAmplitudeReferences().then((function(amplitudeReferences){
        this.amplitudeReferences = amplitudeReferences.reduce(function(_, _1){
            _[_1.value] = _1;
            return _;
        }, {});
    }).bind(this));


    a2Soundscapes.findIndices(soundscape.id, function(result) {
        if(!result)
            return;

        $scope.index = {
            H: [],
            ACI: [],
            NP: [],
        };
        $scope.indices = [];

        $scope.indices.push({
            time: "TIME",
            ACI: "ACI",
            NP: "NP",
        });

        for(var i = 0; i < result.H.length; i++) {
            var t = i+soundscape.min_t;

            $scope.indices.push({
                time: t,
                ACI: result.ACI[i],
                NP: result.NP[i],
            });

            $scope.index.H.push({ x: t, y: result.H[i] });
            $scope.index.ACI.push({ x: t, y: result.ACI[i] });
            $scope.index.NP.push({ x: t, y: result.NP[i] });
        }

    });
});
