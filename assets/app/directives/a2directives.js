angular.module('a2.directives', [
    'a2.services',
    'a2.directive.a2-table',
    'arbimon.directive.a2-switch',
    'a2.directive.percentage-bars',
    'templates-arbimon2',
])
.run(function($window) {
    var $ = $window.$;

    $(document).click( function(e){
        if($(e.target).closest('.calendar.popup:visible').length)
            return;

        $('.calendar.popup:visible').hide();
    });

    // extend jQuery
    // add parent tag selector
    $.expr.filter.UP_PARENT_SPECIAL = function(_1){
        var times = (_1 && _1.length) || 1;
        return $.expr.createPseudo(function(seed,matches,_3,_4){
            var dups=[];
            seed.forEach(function(e, i){
                var p=e;
                for(var t=times; t > 0; --t){
                    p = p && (p.nodeType == 9 || p.parentNode.nodeType == 9  ? p : p.parentNode);
                }
                if(p){
                    for(var di=0, de=dups.length; di < de; ++di){
                        if(dups[di] === p){
                            p = null;
                            break;
                        }
                    }
                    if(p){
                        dups.push(p);
                    }
                }
                matches[i] = p;
                seed[i] = !p;
            });

            return true;
        });
    };
    $.expr.match.needsContext = new RegExp($.expr.match.needsContext.source + '|^(\\^)');
    $.expr.match.UP_PARENT_SPECIAL = /^(\^+)/;
})
.directive('a2GlobalKeyup', function($window, $timeout){
    var $ = $window.$;

    return {
        restrict : 'A',
        scope : {
            onkeyup:'&a2GlobalKeyup'
        }, link: function($scope, $element, $attrs){

            var handler = function(evt){
                $timeout(function(){
                    $scope.onkeyup({$event:evt});
                });
            };
            $(document).on('keyup', handler);
            $element.on('$destroy', function() {
                $(document).off('keyup', handler);
            });
        }
    };
})
.directive('a2Scroll',function($parse, $window) {
    var mkFunction = function(scope, attr){
        var fn = $parse(attr);
        return function(locals) {
            locals.console = console;
            return fn(scope, locals);
        };
    };

    return {
        scope: {
            'a2InfiniteScrollDistance':'=?',
            'a2InfiniteScrollDisabled':'=?',
            'a2InfiniteScrollImmediateCheck':'=?'
        },
        link : function($scope, element, attrs, controller) {
            var pscope = $scope.$parent;
            var fnBind = 'on';
            var fnUnbind = 'off';

            if(attrs.a2Scroll){
                controller.a2Scroll = mkFunction(pscope, attrs.a2Scroll);
            }

            controller.element = element;

            if(attrs.a2ScrollOn){
                if(attrs.a2ScrollOn == 'window'){
                    controller.scrollElement = $window;
                    fnBind = 'addEventListener';
                    fnUnbind = 'removeEventListener';
                } else {
                    controller.scrollElement = $(attrs.a2ScrollOn);
                }
            } else {
                controller.scrollElement = element;
            }

            if(attrs.a2InfiniteScroll){
                $scope.a2InfiniteScroll = mkFunction(pscope, attrs.a2InfiniteScroll);
            }

            if(!$scope.a2InfiniteScrollDistance){
                $scope.a2InfiniteScrollDistance = 1;
            }

            if(!$scope.a2InfiniteScrollRefraction){
                $scope.a2InfiniteScrollRefraction = 1000;
            }

            controller.scrollHandler = controller.scrollHandler.bind(controller);
            controller.scrollElement[fnBind]("scroll", controller.scrollHandler);
            controller.element.bind("$destroy", function(){
                controller.scrollElement[fnUnbind]('scroll', controller.scrollHandler);
                controller.dispose()
            });

        },
        controller: 'a2ScrollController'
    };
})
.controller('a2ScrollController', function($scope){
    Object.assign(this, {
        anchors: {},
        addAnchor: function(name, anchorElement){
            this.anchors[name] = anchorElement;
        },
        removeAnchor: function(name){
            delete this.anchors[name];
        },
        scrollHandler: function (event) {
            try {
                if(this.a2Scroll){
                    this.a2Scroll({
                        $event:event,
                        $controller: this,
                    });
                }
                if($scope.a2InfiniteScroll && !$scope.a2InfiniteScrollDisabled){
                    var remaining = ((element[0].scrollHeight - element[0].scrollTop)|0) / element.height();
                    if(remaining < $scope.a2InfiniteScrollDistance){
                        var time = new Date().getTime();
                        if(!$scope.refraction || $scope.refraction < time){
                            $scope.refraction = time + $scope.a2InfiniteScrollRefraction;
                            $scope.a2InfiniteScroll({$event:e});
                        }
                    }
                }
            } finally {
                $scope.$apply();
            }
        },
        dispose: function(){
            this.element = null;
            this.scrollElement = null;
            this.anchors = {};
        },
    });
})
.directive('a2ScrollAnchor',function() {
    return {
        require: '^a2Scroll',
        link : function($scope, element, attrs, a2ScrollController) {
            var name = attrs.name;
            a2ScrollController.addAnchor(name, element);
            element.bind("$destroy", function(){
                a2ScrollController.removeAnchor(name);
            });
        },
    };
})
.directive('a2Persistent', function($rootScope, $compile, $timeout){
    var counter = 0;
    var poc = $('<div></div>');
    return {
        restrict : 'E', scope : {},
        compile  : function(tElement, tAttrs){
            var children=tElement.children().detach();
            var tag = tAttrs.name || ('persistent-' + (counter++));
            return function(_1, $element, _3){
                if(!$rootScope._$persistence_){
                    $rootScope._$persistence_={};
                }
                var p = $rootScope._$persistence_;
                var ptag = p[tag];
                var persisted = true;
                if(!ptag){
                    // console.log('new persistent scope "%s" created in ', tag, $rootScope);
                    p[tag] = ptag = {};
                    ptag.scope = $rootScope.$new(true);
                    ptag.scope._$persistence_tag_ = tag;
                    ptag.view  = $compile(children)(ptag.scope);
                    persisted  = false;
                }
                $element.append(ptag.view);
                $element.on('$destroy', function(e){
                    e.stopPropagation();
                    poc.append(ptag.view);
                });
                if(persisted){
                    $timeout(function(){
                        ptag.scope.$broadcast('a2-persisted');
                    });
                }
            };
        }
    };
})
.directive('autoHeight', function($window) {
    var $ = $window.$;
    return {
        restrict: 'A',
        link: function (scope, element, attr) {

            var updateHeight = function() {
                // console.log('window h:', $(window).height());
                // console.log('ele pos:',  element.offset());
                // console.log('ele h:', element.height());
                var h = $($window).height() - element.offset().top;

                if(h < 500)
                    return;

                $window.requestAnimationFrame(function() {
                    element.height(h);
                });
            };

            updateHeight();

            $($window).resize(function() {
                updateHeight();
            });
        }
    };
})
.directive('stopClick', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attr) {
            element.bind('click', function (e) {
                e.stopPropagation();
            });
        }
    };
})
.directive('loader', function() {
     return {
         restrict: 'E',
         scope : {
             hideText : '@',
             text : '@'
         },
         templateUrl: '/directives/loader.html'
     };
})
/**   yearpick - complete year date picker

  example usage:
  <div class="dropdown">
    <button ng-model="dia" yearpick disable-empty="true" year="year" date-count="dateData">
        <span ng-hide="dia"> Select Date </span>
        {{ dia | date: short }}
    </button>
  </div>
  or, if you just want to show the component :
  <yearpick ng-model="dia" yearpick disable-empty="true" year="year" date-count="dateData"></yearpick>
 */
.directive('yearpick', function($timeout, $window) {
    var d3 = $window.d3;
    var $ = $window.$;

    return {
        restrict: 'AE',
        scope: {
            ngModel      : '=',
            maxDate      : '=?',
            minDate      : '=?',
            year         : '=?',
            dateCount    : '=?',
            mode         : '@',
            onYearChanged: '&?',
            onDateChanged: '&?',
            disableEmpty : '&'
        },
        link: function(scope, element, attrs) {
            var is_a_popup = !/yearpick/i.test(element[0].tagName);

            var popup;

            if(is_a_popup){
                popup = $('<div></div>').insertAfter(element).addClass('calendar popup');

                element.click(function(e) {
                    e.stopPropagation();

                    // verify if hidden
                    var visible = popup.css('display') === 'none';

                    // always hide any other open yearpick
                    $('.calendar.popup:visible').hide();

                    if(visible) {
                        popup.css('display','block');
                    }
                });
            }
            else {
                popup = element.addClass('calendar');
            }

            var weekOfMonth = function(d) {
                var firstDay = new Date(d.toString());
                firstDay.setDate(1);
                var monthOffset = firstDay.getDay()-1;
                return Math.floor((d.getDate()+monthOffset+7)/7)-1;
            };
            var monthName = d3.time.format('%B');
            var dateFormat = d3.time.format("%Y-%m-%d");
            var format2Date = function(txt){
                var m=/^(\d+)-(\d+)-(\d+)$/.exec(txt);
                return m && new Date(m[1]|0, m[2]|0, m[3]|0);
            };
            var canHaveDateCounts = function(){
                return scope.mode === "density" && attrs.dateCount;
            };
            var computeMax = !attrs.maxDate;
            var computeMin = !attrs.minDate;

            function setYear(year){
                var old_year = scope.year;
                scope.year = year;
                if(scope.onYearChanged && old_year != year){
                    $timeout(function(){scope.onYearChanged({year:year});});
                }
            }
            function setDate(date){
                var old_date = scope.ngModel;
                scope.ngModel = date;
                if(scope.onDateChanged && old_date != date){
                    $timeout(function(){scope.onDateChanged({date:date});});
                }
            }

            if(!scope.year){
                setYear((new Date()).getFullYear());
            }
            var cubesize = 19;
            var width = 600;
            var height = 510;
            var headerHeight = 40;
            var days;

            var svg = d3.select(popup[0])
                .append('svg')
                .attr('width', width)
                .attr('height', height);

            var cal    = svg.append('g');
            var legend = svg.append('g');
            var prev   = svg.append('g').attr('class', 'btn');
            var next   = svg.append('g').attr('class', 'btn');

            // draws previous year button
            prev.append('text')
                .attr('text-anchor', 'start')
                .attr('font-family', 'FontAwesome')
                .attr('font-size', 24)
                .attr('x', 5)
                .attr('y', 24)
                .text('\uf060');

            prev.on('click', function(e){
                $timeout(function(){
                    setYear(scope.year-1);
                });
            });

            // draws next year button
            next.append('text')
                .attr('text-anchor', 'end')
                .attr('font-family', 'FontAwesome')
                .attr('font-size', 24)
                .attr('x', width-5)
                .attr('y', 24)
                .text('\uf061');

            next.on('click', function(e){
                $timeout(function(){
                    setYear(scope.year+1);
                });
            });


            // draw legend
            if(scope.mode === "density") {
                var scale = {scale:[1, 50, 100], labels:['0','1','50','100']};
                var color = d3.scale.threshold().domain(scale.scale).range(scale);

                var icon = legend.selectAll('g')
                    .data(['1','50','100'])
                    .enter()
                    .append('g')
                    .attr('transform', function(d, i) {
                        switch (d) {
                            case '50': return 'translate(18,0)';
                            default: return 'translate(20,0)';
                        }
                    })

                icon.append('rect')
                    .attr('width', cubesize*0.63)
                    .attr('height', cubesize*0.63)
                    .attr('y', (height + 7 - cubesize))
                    .attr('x', function(d, i) { return i*45+22; })
                    .attr('class', function(d) { return 'cal-level-'+d; });

                icon.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 10)
                    .attr('y', height - 2)
                    .attr('x', function(d, i) {
                        switch (d) {
                            case '1': return i*45+11;
                            case '50': return i*45+9;
                            case '100': return i*45+6;
                        }
                    })
                    .text(function(d, i) { return '+'+d; });
            }

            var drawCounts = function() {
                if(scope.mode === "density" && !scope.dateCount) return;

                if(scope.disableEmpty()) {
                    days.classed('day-disabled', function(d) {
                        return $(this).hasClass('cal-oor') || !scope.dateCount[dateFormat(d)] ;
                    });
                }

                var squares = days.select('rect');
                squares.attr('class', function(d) {
                    var color = d3.scale.threshold().domain([1, 50, 100]).range(['0','1','50','100']);

                    var count = scope.dateCount[dateFormat(d)] || 0;

                    return 'cal-level-'+color(count);
                });
            };

            var draw = function() {
                // set calendar year
                calendar = cal.selectAll('g').data([scope.year]);

                // append new year
                var title = calendar.enter().append('g');

                // set text position
                title.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 30)
                    .attr('x', width/2)
                    .attr('y', 30);

                // set line position
                title.append('line')
                    .attr('x1', 5)
                    .attr('y1', headerHeight)
                    .attr('x2', width-5)
                    .attr('y2', headerHeight)
                    .attr('stroke', 'rgba(0,0,0,0.5)')
                    .attr('stroke-width', 1);

                // remove old year
                calendar.exit().remove();

                // write year text
                calendar.select('text').text(function(d) { return d; });

                prev.classed('disabled', scope.minDate && scope.minDate.getFullYear() >= scope.year);
                next.classed('disabled', scope.maxDate && scope.year >= scope.maxDate.getFullYear());

                // setup the months containers and set the years' month date range
                var mon = calendar.append('g')
                    .attr('transform', 'translate(0,'+ headerHeight +')')
                    .selectAll('g')
                    .data(function(d) {
                        return d3.time.months(new Date(d, 0, 1), new Date(d+1, 0, 1));
                    });

                // on enter in months, append new months
                mon.enter().append('g');

                // in months, transform each month to their place in the yearpick
                mon.attr('transform', function(d, i) {
                    return 'translate('+((d.getMonth()%4)*150+5)+','+(Math.floor(d.getMonth()/4)*150+5)+')';
                });

                // in months, transform each month to their place in the yearpick
                mon.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('x', cubesize*7/2)
                    .attr('y', 15)
                    .text(function(d) { return monthName(d); });

                // remove old months
                mon.exit().remove();


                // setup day containers for each months
                days = mon.selectAll('g')
                    .data(function(d) {
                        return d3.time.days(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1));
                    });

                //  in days, on enter, append a g of class btn
                days.enter()
                    .append('g')
                    .attr('class', 'day');

                //  for each day, move the text, add class hover and onclick event handler
                days.attr('transform', function() { return 'translate(0,24)'; })
                    .classed('hover', true)
                    .classed('day-disabled cal-oor', function(d) {
                        return (scope.minDate ? (d < scope.minDate) : false) ||
                               (scope.maxDate ? (scope.maxDate < d) : false);
                    })
                    .classed('selected', function(d){
                        return scope.ngModel && (dateFormat(d) == dateFormat(scope.ngModel));
                    })
                    .on('click', function(d){
                        scope.$apply(function() {
                            d3.event.preventDefault();
                            setDate(d);
                            if(is_a_popup) popup.css('display', 'none');
                        });
                    });
                // .. also, add a rect on the background
                days.append('rect')
                    .attr('width', cubesize)
                    .attr('height', cubesize)
                    .attr('y', function(d, i) { return weekOfMonth(d) * (cubesize+1); })
                    .attr('x', function(d, i) { return (d.getDay()) * (cubesize+1); })
                    .attr('fill', 'white');

                // .. and append a text on the foreground
                days.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 10)
                    .attr('y', function(d, i) { return weekOfMonth(d) * (cubesize+1)+13; })
                    .attr('x', function(d, i) { return (d.getDay()+1) * (cubesize+1)-10; })
                    .text(function(d, i) { return d.getDate(); });

                // if we have date counts, then draw them
                if(attrs.dateCount) {
                    drawCounts();
                }

                // remove old days
                days.exit().remove();
            };

            scope.$watch('maxDate', function(){
                if(scope.maxDate && scope.year > scope.maxDate.getFullYear()){
                    setYear(scope.maxDate.getFullYear());
                }
                draw();
            });

            scope.$watch('minDate', function(){
                if(scope.minDate && scope.year < scope.minDate.getFullYear()){
                    setYear(scope.minDate.getFullYear());
                }
                draw();
            });

            scope.$watch('year', function(){
                if(!scope.year){
                    setYear(new Date().getFullYear());
                }
                draw();
            });

            scope.$watch('ngModel', function(){
                if(scope.ngModel){
                    setYear(scope.ngModel.getFullYear());
                    days.classed('selected', function(d){
                        return scope.ngModel && (dateFormat(d) == dateFormat(scope.ngModel));
                    });
                }
            });

            var computeMaxMinDateFromCounts = function(dateCounts, computeMax, computeMin){
                var stats=null;
                if(!dateCounts || (!computeMax && !computeMin)){
                    return;
                }

                for(var dateFmt in dateCounts){
                    var date = format2Date(dateFmt);
                    if(stats){
                        stats.min = Math.min(date, stats.min);
                        stats.max = Math.max(date, stats.max);
                    } else {
                        stats = {min:date, max:date};
                    }
                }
                if(computeMin){
                    scope.minDate = new Date(stats.min);
                }
                if(computeMax){
                    scope.maxDate = new Date(stats.max);
                }
            };

            if(canHaveDateCounts()) {
                scope.$watch('dateCount', function(value) {
                    computeMaxMinDateFromCounts(value, computeMax, computeMin);
                    drawCounts();
                });
            }
        }
    };
})
.directive('a2Img', function($compile, $window){
    var $ = $window.$;
    return {
        restrict : 'E',
        scope : {},
        link: function ($scope, $element, $attr) {
            $element.addClass('a2-img');

            var loader = $compile('<loader hide-text="yes"></loader>')($scope).appendTo($element);

            var img = $('<img>').on('load', function(){
                    $element.removeClass('loading');
                }).appendTo($element);

            $attr.$observe('a2Src', function(new_src){
                if(!new_src){
                    img.hide();
                    img.attr('src', '');
                    return;
                }
                img.show();
                $element.addClass('loading');
                var image = new Image();
                image.onload = function () {
                    img.attr('src', this.src);
                };
                image.src = new_src;

            });

        }
    };
})
.directive('a2TrainingSetDataImage', function($compile, a2TrainingSets){
    return {
        restrict : 'E',
        scope : {
            'trainingSet' : '=',
            'datum'        : '='
        },
        template : '<a2-img a2-src="{{datum.uri}}" ng-class="resolving ? \'resolving-uri\' : \'\'" style="width:100%;height:100%;"></a2-img>',
        link: function ($scope, $element, $attr) {
            $element.addClass('a2-training-set-data-image a2-block-inline');
            var resolve_null_uri = function(){
                if($scope.datum && $scope.trainingSet && !$scope.datum.url){
                    var urikey = [$scope.trainingSet.id, $scope.datum.id].join('-');
                    if($scope.resolving != urikey){
                        $scope.resolving = urikey;
                        a2TrainingSets.getDataImage($scope.trainingSet.id, $scope.datum.id, function(datum2){
                            $scope.resolving = false;
                            if($scope.datum.id == datum2.id){
                                $scope.datum.uri = datum2.uri;
                            }
                        });
                    }
                }
            };
            $scope.$watch('datum', resolve_null_uri);
            $scope.$watch('trainingSet', resolve_null_uri);
        }
    };
})
.directive('a2InsertIn', function($window){
    var $ = $window.$;

    var count=1;
    return {
        restrict: 'A',
        link: function ($scope, $element, $attr){
            var anchor = $('<div class="a2-insert-in-anchor"></div>')
                .attr('id', 'a2InsertInAnchor'+(count++));

            var is_truthy = function(v){
                return (v) && !/no|false|0/.test(''+v);
            };
            var keep_position = is_truthy($attr.a2KeepPosition);
            var target = $($attr.a2InsertIn);

            $element[0].parentNode.replaceChild(anchor[0], $element[0]);
            $element.appendTo(target);

            var reposition_element=null;
            if(keep_position){
                var comp_pos = function(el){
                    return $(el).offset();
                };
                reposition_element = function(){
                    $('.a2-insert-in-anchor');
                    var po = comp_pos($element.offsetParent());
                    var ao = comp_pos(anchor);
                    ao.position='absolute';
                    ao.top  -= po.top;
                    ao.left -= po.left;
                    $element.css(ao);
                };
                $('.a2-insert-in-anchor').parents().each(function(i, e){
                    var $e=$(e);
                    if(!/visible|hidden/.test($e.css('overflow'))){
                        $e.scroll(reposition_element);
                    }
                });
                $scope.$watch(function(){
                    return anchor.offset();
                }, reposition_element, true);
                reposition_element();
            }

            $scope.$watch(function(){
                return anchor.is(':visible');
            }, function(visibility){
                $element.css('display', visibility ? 'block' : 'none');
            });

            anchor.on('$destroy', function(){
                $element.remove();
            });
        }
    };
})
.directive('a2LineChart', function($window) {
    var d3 = $window.d3;

    var drawChart = function(data, options) {

        var padding = {
            left: 30,
            right: 10,
            top: 10,
            bottom: 20
        };

        var getY = function(value) { return value.y; };
        var getX = function(value) { return value.x; };

        var yMin = d3.min(data, getY);
        var yMax = d3.max(data, getY);

        var tMin = d3.min(data, getX);
        var tMax = d3.max(data, getX);

        var element = options.element;
        var lineColor = options.lineColor || "red";
        var width = options.width,
        height = options.height;

        var xScale = d3.scale.linear()
        .domain([tMin, tMax])
        .range([padding.left, width-padding.right]);

        var yScale = d3.scale.linear()
        .domain([yMin, yMax])
        .range([height-padding.bottom, padding.top]);

        var line = d3.svg.line()
        .x(function(d) { return xScale(d.x); })
        .y(function(d) { return yScale(d.y); })
        .interpolate("linear");

        var symbol= d3.svg.symbol().type('circle');

        var xAxis = d3.svg.axis()
        .scale(xScale).ticks(tMax-tMin);

        var yAxis = d3.svg.axis()
        .scale(yScale).orient('left').ticks(3);

        var svg = element
        .append('svg')
        .attr('class', "graph")
        .attr('height', height)
        .attr('width', width);

        svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (height-padding.bottom) + ")")
        .call(xAxis);

        svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate("+ padding.left +",0)")
        .call(yAxis);

        var dataG = svg.append('g')
        .datum(data);

        var path = dataG.append('path')
        .attr('stroke', lineColor)
        .attr('stroke-width',"2")
        .attr('fill',"none")
        .attr('d', line);

        var totalLength = path.node().getTotalLength();

        path.attr("stroke-dasharray", totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().delay(200)
        .duration(1000)
        .ease("linear")
        .attr("stroke-dashoffset", 0)
        .each("end", function(){
            path.attr("stroke-dasharray", null)
            .attr("stroke-dashoffset", null);
        });


        dataG.append("g").selectAll('path')
        .data(function(d) { return d; })
        .enter()
        .append('path')
        .attr('fill',"transparent")
        .attr("transform", function(d) {
            return "translate(" + xScale(d.x) + "," + yScale(d.y) + ")scale(0.7,0.7)";
        })
        .attr("d", symbol)
        .attr('fill', lineColor)
        .on('mouseenter', function(d) {
            var body = d3.select('body');
            var coords = d3.mouse(body.node());

            var tooltip = body.append('div')
            .datum(d)
            .attr('class', "graph-tooltip")
            .style('top', (coords[1]-10)+'px')
            .style('left', (coords[0]-10)+'px')
            .on('mouseleave', function() {
                body.selectAll('.graph-tooltip').remove();
            })
            .append('p')
            .text(Math.round(d.y*1000)/1000);
        });
    };

    return {
        restrict: 'E',
        scope: {
            values: '=',
            height: '@',
            width: '@',
            color: '@?'
        },
        link: function (scope, element, attrs) {

            scope.$watch('values', function() {

                if(!scope.values)
                    return;

                drawChart(scope.values, {
                    lineColor: scope.color,
                    element: d3.select(element[0]),
                    width: Number(scope.width),
                    height: Number(scope.height)
                });
            });

        }
    };
})
.directive('c3ChartDisplay', function($window) {
    var c3 = $window.c3;

    function normalize(data){
        if(typeof data != 'object') {
            return {columns:data};
        }
        return data;
    }

    var makeChart = function(element, data, axes){
        var celem = element.find('div');
        if(!data || !axes){
            celem.remove();
            return;
        }
        if(!celem.length){
            celem = angular.element('<div></div>').appendTo(element);
        }

        var args={bindto: celem[0], data: normalize(data)};
        if(axes){
            args.axis=axes;
        }

        return c3.generate(args);
    };

    return {
        restrict: 'E',
        scope: {
            data:'=',
            axes:'='
        },
        template:'<span></span>',
        link: function (scope, element, attrs) {
            var chart;
            scope.$watch('axes', function(o,n){
                if(!chart || o != n) chart = makeChart(element, scope.data, scope.axes, chart);
            });
            scope.$watch('data', function(o,n){
                if(!chart || o != n){
                    chart = makeChart(element, scope.data, scope.axes, chart);
                } else if(chart){
                    // chart.unload();
                    chart.load(normalize(scope.data));
                }
            });
        }
    };
})
.directive('a2Info', function(){
    return {
        replace:true,
        restrict : 'E',
        template:'<i class="text-info fa fa-info-circle"></i>'
    };
})
.directive('a2BsNgModelOnDirtySaveButton', function($parse){
    return {
        restrict:'A',
        require:'ngModel',
        link: function(scope, element, attrs, ngModel){
            var saveBtn;
            var onDirtySaveFN = $parse(attrs.a2BsNgModelOnDirtySaveButton);

            function addSaveBtn(){
                element.wrap('<div class="input-group"></div>');
                var parentEl = element.parent();
                saveBtn = angular.element(
                    '<div class="input-group-btn">' +
                    '    <button class="btn btn-primary"><i class="fa fa-save"></i></button>' +
                    '</div>'
                );
                saveBtn.find('button.btn').on('click', function(){
                    onDirtySaveFN(scope, {
                        $name  : ngModel.$name,
                        $modelValue : ngModel.$modelValue,
                        $setPristine: function(){
                            ngModel.$setPristine();
                            removeSaveBtn();
                        }
                    });
                });

                saveBtn.appendTo(parentEl);
            }
            function removeSaveBtn(){
                if(saveBtn){
                    saveBtn.remove();
                }
                element.unwrap();
                saveBtn = undefined;
            }

            ngModel.$viewChangeListeners.push(function(){
                if(ngModel.$dirty && !saveBtn){
                    addSaveBtn();
                } else if(saveBtn){
                    removeSaveBtn();
                }
            });
        }
    };
})
.factory('canvasObjectURL', function($window, $q){
    var createObjectURL = $window.URL.createObjectURL;
    var revokeObjectURL = $window.URL.revokeObjectURL;
    if(!createObjectURL && $window.webkitURL.createObjectURL){
        createObjectURL = $window.webkitURL.createObjectURL;
        revokeObjectURL = $window.webkitURL.revokeObjectURL;
    }
    if(!createObjectURL){
        revokeObjectURL = function(){};
    }

    function dataURIToBinaryBuffer(dataURI) {
        var BASE64_MARKER = ';base64,';
        var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
        var base64 = dataURI.substring(base64Index);
        var raw = $window.atob(base64);
        var rawLength = raw.length;
        var array = new $window.Uint8Array(new $window.ArrayBuffer(rawLength));

        for(i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
        }
        return array.buffer;
    }

    function getCanvasBlob(canvas){
        if(canvas.toBlob){
            return $q(function(resolve){
                canvas.toBlob(resolve);
            });
        } else {
            var data = dataURIToBinaryBuffer(canvas.toDataURL("image/png"));
            var blob;
            var BlobBuilder = $window.BlobBuilder || $window.WebKitBlobBuilder;
            if(BlobBuilder){
                var bb = new WebKitBlobBuilder();
                bb.append(data);
                blob = bb.getBlob("image/png");
            } else {
                blob = new $window.Blob([data], {type:'image/png'});
            }
            return $q.resolve(blob);
        }
    }

    return {
        create: function(canvas){
            if(!createObjectURL){
                return $q.resolve(canvas.toDataURL("image/png"));
            }

            return getCanvasBlob(canvas).then(function(blob){
                return createObjectURL(blob);
            });
        },
        revoke: revokeObjectURL
    };
})
.directive('axis', function(canvasObjectURL, $q, $debounce){
    var promiseCache = {};
    var canvas = angular.element('<canvas></canvas>')[0];
    function computeHash(w, h, type, data){
        return JSON.stringify([w, h, type, data]);
    }

    function createAxisData(canvas, w, h, type, data){
        if(!w || !h){
            return $q.reject("Empty canvas size");
        }

        canvas.width = w;
        canvas.height = h;

        var i;
        var prec = data.prec || 1;
        var min = ((data.range[0] / prec) | 0) * prec;
        var max = ((data.range[1] / prec) | 0) * prec;
        var scale;
        var unit = data.unit;
        var count = data.count || 1;
        var dTick = (((((max - min)/prec)|0) / count)|0) * prec;
        var ctx = canvas.getContext('2d');
        var w1=w-1, h1=h-1;
        // var compStyle = getComputedStyle(canvas);
        ctx.font = data.font;
        ctx.strokeStyle = data.color;
        ctx.lineWidth = 0.5;

        ctx.clearRect(0, 0, w, h);
        var val, x, y, pad=3;
        var lblSize={w:0,h:10};
        var loopCt = data.loopCt || 250;
        for(val=min; loopCt>0 && val<max; val += dTick, --loopCt){
            var tW = ctx.measureText(val + unit).width;
            if(lblSize.w < tW){
                lblSize.w = tW;
            }
        }


        if(type == 'h'){
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            scale = w / (max - min);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w1, 0);
            ctx.stroke();

            loopCt = data.loopCt || 250;
            for(val=min; loopCt>0 && val<max; val += dTick, --loopCt){
                x = scale * (val - min);
                if(val >= max - dTick){
                    ctx.textAlign = 'right';
                }
                ctx.beginPath();
                ctx.moveTo(x, pad);
                ctx.lineTo(x, 0);
                ctx.stroke();
                ctx.strokeText(val + unit, x, pad);
            }
        } else if(type == 'v'){
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabet';
            scale = h / (max - min);

            ctx.beginPath();
            ctx.moveTo(w1, 0);
            ctx.lineTo(w1, h1);
            ctx.stroke();

            loopCt = data.loopCt || 250;
            for(val=min; loopCt>0 && val<max; val += dTick, --loopCt){
                y = h - scale * (val - min);
                if(val >= max - dTick){
                    ctx.textBaseline = 'top';
                }
                ctx.beginPath();
                ctx.moveTo(w1-pad, y);
                ctx.lineTo(w1, y);
                ctx.stroke();
                ctx.strokeText(val + unit, lblSize.w, y, w1-pad-1);
            }
        }
        // {
        //     range:[0, recording.sample_rate/2000],
        //     count:10,
        //     unit:'kHz'
        // }

        // console.log("drawAxis(",canvas, w, h, type, data,")");
        return canvasObjectURL.create(canvas);
        // return canvas.toDataURL();
    }

    function drawAxisOnImg(img, w, h, type, data){
        var hash = computeHash(w, h, type, data);
        var axisDataPromise = promiseCache[hash];
        if(!axisDataPromise){
            axisDataPromise = promiseCache[hash] = createAxisData(canvas, w, h, type, data);
        }

        return axisDataPromise.then(function(axisData){
            img.src = axisData;
        });
    }
    return {
        restrict:'E',
        template:'<img />',
        scope:{
            type:"@",
            data:"="
        },
        link:function(scope, element, attrs){
            var img = element.find('img')[0];
            var tout;

            var redrawAxis = $debounce(function (){
                drawAxisOnImg(img, element.width(), element.height(), scope.type, scope.data);
            }, 500);

            function elementSize(){
                return element.width() * element.height();
            }

            scope.$watch(elementSize, redrawAxis);
            scope.$watch('type', redrawAxis);
            scope.$watch('data', redrawAxis);
        }
    };
})
.filter('consoleLog', function(){
    return function(x, type){
        console[type || 'log'](x);
        return x;
    };
})
.filter('mouseEventContainerPercent', function(){
    return function($event, selector){
        var target=angular.element($event.currentTarget);
        if(selector){
            target = target.closest(selector);
        }
        var targetpos=target.offset();
        var px = ($event.pageX - targetpos.left ) / target.width() ;
        var py = ($event.pageY - targetpos.top  ) / target.height();
        return {x:px, y:py};
    };
})
.directive('onErrorSrc', function() {
    return {
      link: function(scope, element, attrs) {
        element.bind('error', function() {
          if (attrs.src != attrs.onErrorSrc) {
            attrs.$set('src', attrs.onErrorSrc);
          }
        });
      }
    }
});
