angular.module('a2directives', [])
.directive('a2GlobalKeyup', function($timeout){
    return {
        restrict : 'A',
        scope : {
            onkeyup:'&a2GlobalKeyup'
        }, link: function($scope, $element, $attrs){

            var handler = function(evt){
                $timeout(function(){
                    $scope.onkeyup({$event:evt});
                });
            }
            $(document).on('keyup', handler);
            $element.on('$destroy', function() {
                $(document).off('keyup', handler);
            });
        }
    };
})
.directive('a2Scroll', function() {
    return {
        scope: {
            a2Scroll : '&a2Scroll'
        },
        link : function($scope, $element, $attrs) {
            $element.bind("scroll", function(e) {
                $scope.a2Scroll(e);
            });
        }
    };
})
.directive('a2ZoomControl', function(){
    return {
        restrict :'E',
        scope : {
            'level' : '='
        },
        templateUrl : '/partials/directives/zoom-ctrl.html',
        replace  : true,
        link : function($scope, $element, $attrs) {
            var delta = (+$attrs.delta) || 0.1;
            var horizontal = !!(($attrs.horizontal|0) || (/on|yes|true/.test($attrs.horizontal+'')));
            $scope.horizontal = horizontal;
            $scope.switched   = horizontal;
            $scope.step = function(step){
                $scope.level = Math.min(1, Math.max($scope.level + step*delta, 0));
            };
            $scope.set_by_mouse = function($event){
                var track = $element.find('.zoom-track'), trackpos=track.offset();
                var px = (track.width()  - ($event.pageX - trackpos.left )) / track.width() ;
                var py = (track.height() - ($event.pageY - trackpos.top  )) / track.height();
                // console.log('$scope.set_by_mouse', [px,py]);
                var level = $scope.horizontal ? px : py;
                $scope.level = $scope.switched ? (1-level) : level;
            }
        }
    }
})
.directive('a2Table', ['$filter', function($filter) {
    return {
        restrict: 'E',
        scope: {
            fields: '=',
            rows: '=',
            onSelect: '&',
            extSort: '&',
            checked: '=',
            search: '=',
            noCheckbox: '@',
            noSelect: '@',
            dateFormat: '@'
        },
        templateUrl: '/partials/directives/table.html',
        link: function(scope, element, attrs) {

            if(attrs.noCheckbox !== undefined)
                scope.noCheck = true;

            var updateChecked = function(rows) {
                if(rows) {
                    var visible = $filter('filter')(rows, scope.query);

                    scope.checked = visible.filter(function(row) {
                        return row.checked | false;
                    });
                }
            };


            if(attrs.search) {
                scope.$watch(attrs.search, function(value) {
                    //~ console.log(value);
                    scope.query = scope.search;
                    updateChecked(scope.rows);
                });
            }

            scope.toggleAll = function() {
                var allFalse = true;

                for(var i in scope.rows) {
                    if(scope.rows[i].checked) {
                        allFalse = false;
                        break;
                    }
                }

                for(var i in scope.rows) {
                    scope.rows[i].checked = allFalse;
                }

                scope.checkall = allFalse;

            };



            if(attrs.checked) {
                scope.$watch('rows', updateChecked, true);
            }


            scope.check = function($event, $index) {
                //~ console.log('$event:', $event);
                //~ console.log('$index:', $index);
                //~ console.log('last checked:', scope.lastChecked);

                if(scope.lastChecked && $event.shiftKey) {
                    console.log('shift!');

                    if(scope.lastChecked) {
                        var rows;
                        if(scope.lastChecked > $index)
                            rows = scope.rows.slice($index, scope.lastChecked);
                        else
                            rows = scope.rows.slice(scope.lastChecked, $index);

                        rows.forEach(function(row) {
                            row.checked = true;
                        });
                    }
                }

                scope.lastChecked = $index;
            };

            scope.sel = function(row, $index) {
                if(attrs.noSelect !== undefined)
                    return;

                scope.selected = row;

                if(attrs.onSelect)
                    scope.onSelect({ $index: $index });
            };

            scope.sortBy = function(field) {
                if(scope.sortKey !== field.key) {
                    scope.sortKey = field.key;
                     
                    if(attrs.extSort === undefined)
                        scope.sort = field.key;
                    
                    scope.reverse = false;
                }
                else {
                    scope.reverse = !scope.reverse;
                }
                
                if(attrs.extSort)
                    scope.extSort({ sortBy: field.key, reverse: scope.reverse });
            };
            
            scope.formatString = function(value) {
                
                if(value instanceof Date){
                    return moment(value).utc().format(attrs.dateFormat || 'MMM D YYYY, HH:mm');
                }
                return value;
            }
        }
    };
}])
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
                    console.log('new persistent scope "%s" created in ', tag, $rootScope);
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
            }
        }
    }
})
.directive('autoHeight', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attr) {

            var updateHeight = function() {
                // console.log('window h:', $(window).height());
                // console.log('ele pos:',  element.offset());
                // console.log('ele h:', element.height());
                var h = $(window).height() - element.offset().top;

                if(h < 500)
                    return;

                window.requestAnimationFrame(function() {
                    element.height(h);
                });
            }

            updateHeight();

            $( window ).resize(function() {
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
                //~ console.log("click stopped");
                e.stopPropagation();
            });
        }
    };
 })
 .directive('loader', function() {
     return {
         restrict: 'E',
         templateUrl: '/partials/directives/loader.html'
     }
 })
 
 /*
  yearpick - complete year date picker
  
  example usage:
  <div class="dropdown">
    <button ng-model="dia" yearpick disable-empty="true" date-count="dateData">
        <span ng-hide="dia"> Select Date </span>
        {{ dia | date: short }}
    </button>
  </div>
 */
 .directive('yearpick', function() {
    return {
        restrict: 'A',
        scope: {
            ngModel: '=',
            dateCount: '=',
            disableEmpty: '&'
        },
        link: function(scope, element, attrs) {
            // console.log(attrs);
            var popup = $('<div></div>').insertAfter(element);
            popup.addClass('calendar');
            
            var weekOfMonth = function(d) {
                var firstDay = new Date(d.toString());
                firstDay.setDate(1);
                var monthOffset = firstDay.getDay()-1;
                return Math.floor((d.getDate()+monthOffset+7)/7)-1;
            };
            var monthName = d3.time.format('%B');
            var dateFormat = d3.time.format("%Y-%m-%d");
            
            var year = (new Date()).getFullYear();
            var cubesize = 19;
            var width = 600;
            var height = 510;
            var headerHeight = 40;
            var days;
            
            var svg = d3.select(popup[0])
            .append('svg')
            .attr('width', width)
            .attr('height', height);
            
            var cal = svg.append('g');
            var legend = svg.append('g');
            var prev = svg.append('a');
            var next = svg.append('a');
            
            
            prev.append('text')
            .attr('text-anchor', 'start')
            .attr('font-family', 'FontAwesome')
            .attr('font-size', 24)
            .attr('x', 5)
            .attr('y', 24)
            .html('&#xf060');
            
            prev.on('click', function(){
                --year;
                draw();
            });
            
            
            next.append('text')
            .attr('text-anchor', 'end')
            .attr('font-family', 'FontAwesome')
            .attr('font-size', 24)
            .attr('x', width-5)
            .attr('y', 24)
            .html('&#xf061');
            
            next.on('click', function(){
                ++year;
                draw();
            });
            
            var icon = legend.selectAll('g')
            .data(['1','50','100'])
            .enter()
            .append('g')
            .attr('transform', 'translate(20,0)');
            
            icon.append('rect')
            .attr('width', cubesize)
            .attr('height', cubesize)
            .attr('y', height-cubesize-10)
            .attr('x', function(d, i) { return i*45+22; })
            .attr('class', function(d) { return 'cal-level-'+d; })
            ;
            
            icon.append('text')
            .attr('text-anchor', 'middle')
            .attr('font-size', 10)
            .attr('y', height-15)
            .attr('x', function(d, i) { return i*45+10; })
            .text(function(d, i) { return '+'+d; })
            ;
            
            var drawCounts = function() {
                if(!scope.dateCount) return;
                
                if(scope.disableEmpty()) {
                    days.attr('class', function(d) {
                        if(scope.dateCount[dateFormat(d)])
                            return 'hover';
                        
                        return 'cal-disabled';
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
                calendar = cal.selectAll('g').data([year]);
                
                var title = calendar.enter().append('g');
                
                title.append('text')
                .attr('text-anchor', 'middle')
                .attr('font-size', 30)
                .attr('x', width/2)
                .attr('y', 30);
                
                title.append('line')
                .attr('x1', 5)
                .attr('y1', headerHeight)
                .attr('x2', width-5)
                .attr('y2', headerHeight)
                .attr('stroke', 'rgba(0,0,0,0.5)')
                .attr('stroke-width', 1);
                
                calendar.exit().remove();
                
                calendar.select('text').text(function(d) { return d; });
                
                var mon = calendar.append('g').attr('transform', 'translate(0,'+ headerHeight +')')
                .selectAll('g')
                .data(function(d) { 
                    // console.log(d);
                    return d3.time.months(new Date(d, 0, 1), new Date(d+1, 0, 1));
                });
                
                mon.enter().append('g');
                
                mon.attr('transform', function(d, i) { 
                    return 'translate('+((d.getMonth()%4)*150+5)+','+(Math.floor(d.getMonth()/4)*150+5)+')'; 
                });
                
                mon.append('text')
                .attr('text-anchor', 'middle')
                .attr('x', cubesize*7/2)
                .attr('y', 15)
                .text(function(d) { return monthName(d); });
                
                mon.exit().remove();
                
                days = mon.selectAll('g')
                .data(function(d) { 
                    return d3.time.days(new Date(year, d.getMonth(), 1), new Date(year, d.getMonth() + 1, 1)); 
                });
                
                days.enter().append('a');
                
                days.attr('transform', function() { return 'translate(0,24)'; })
                .attr('class', 'hover')
                .on('click', function(d){
                    scope.$apply(function() {
                        scope.ngModel = d;
                        popup.css('display', 'none');
                    });
                });
                
                days.append('rect')
                .attr('width', cubesize)
                .attr('height', cubesize)
                .attr('y', function(d, i) { return weekOfMonth(d) * (cubesize+1); })
                .attr('x', function(d, i) { return (d.getDay()) * (cubesize+1); })
                .attr('fill', 'white')
                ;
                
                days.append('text')
                .attr('text-anchor', 'middle')
                .attr('font-size', 10)
                .attr('y', function(d, i) { return weekOfMonth(d) * (cubesize+1)+13; })
                .attr('x', function(d, i) { return (d.getDay()+1) * (cubesize+1)-10; })
                .text(function(d, i) { return d.getDate(); })
                ;
            
                if(attrs.dateCount) {
                    drawCounts();
                }
                
                days.exit().remove();
            };
            draw();
            
            if(attrs.dateCount) {
                scope.$watch('dateCount', function(value) {
                    drawCounts();
                });
            }
            
            element.click(function() {
                if(popup.css('display') === 'none') {
                    popup.css('display','block');
                }
                
                else
                    popup.css('display', 'none');
            });
        }
    };
})
 ;
