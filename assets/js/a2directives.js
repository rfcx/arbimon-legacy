/*jshint -W030 */

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


angular.module('a2directives', ['a2services'])
.run(function() {
    $(document).click( function(e){
        if($(e.target).closest('.calendar.popup:visible').length)
            return;
            
        $('.calendar.popup:visible').hide();
    });
})
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
            };
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
            };
        }
    };
})
.directive('a2Table', ['$filter', function($filter) {
    return {
        restrict: 'E',
        scope: {
            fields: '=',
            rows: '=',
            selected: '=?',
            onSelect: '&',
            extSort: '&',
            checked: '=?',
            search: '=?',
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

                for(var j in scope.rows) {
                    scope.rows[j].checked = allFalse;
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
            };
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
            };

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
         scope : {
             hideText : '@',
             text : '@'
         },
         templateUrl: '/partials/directives/loader.html'
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
.directive('yearpick', function($timeout) {
    return {
        restrict: 'AE',
        scope: {
            ngModel      : '=',
            maxDate      : '=?',
            minDate      : '=?',
            year         : '=?',
            dateCount    : '=?',
            disableEmpty : '&'
        },
        link: function(scope, element, attrs) {
            var is_a_popup = !/yearpick/i.test(element[0].tagName);
            var popup;
            if(is_a_popup){
                popup = $('<div></div>').insertAfter(element).addClass('calendar popup');
                
                element.click(function(e) {
                    e.stopPropagation();
                    
                    // console.log('toggle');
                    var visible = popup.css('display') === 'none';
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
            
            if(!scope.year){
                scope.year = (new Date()).getFullYear();
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
            
        
            prev.append('text')
                .attr('text-anchor', 'start')
                .attr('font-family', 'FontAwesome')
                .attr('font-size', 24)
                .attr('x', 5)
                .attr('y', 24)
                .text('\uf060');
            
            prev.on('click', function(){
                $timeout(function(){
                    --scope.year;
                });
            });
            
            
            next.append('text')
                .attr('text-anchor', 'end')
                .attr('font-family', 'FontAwesome')
                .attr('font-size', 24)
                .attr('x', width-5)
                .attr('y', 24)
                .text('\uf061');
            
            next.on('click', function(){
                $timeout(function(){
                    ++scope.year;
                });
            });
            
            var scale = {scale:[1, 50, 100], labels:['0','1','50','100']};
            var color = d3.scale.threshold().domain(scale.scale).range(scale);
            
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
                    days.classed('cal-disabled', function(d) {
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
                // on enter, create a new title
                var title = calendar.enter().append('g');
                // .. and set it up
                title.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 30)
                    .attr('x', width/2)
                    .attr('y', 30);
                // .. and add a line underneath
                title.append('line')
                    .attr('x1', 5)
                    .attr('y1', headerHeight)
                    .attr('x2', width-5)
                    .attr('y2', headerHeight)
                    .attr('stroke', 'rgba(0,0,0,0.5)')
                    .attr('stroke-width', 1);
                // on exit, remove it
                calendar.exit().remove();
                // re-set the title text on each draw
                calendar.select('text').text(function(d) { return d; });
                
                prev.classed('disabled', scope.minDate && scope.minDate.getFullYear() >= scope.year);
                next.classed('disabled', scope.maxDate && scope.year >= scope.maxDate.getFullYear());
                
                // setup the months container and set the years' month date range
                var mon = calendar.append('g').attr('transform', 'translate(0,'+ headerHeight +')')
                    .selectAll('g')
                    .data(function(d) { 
                        // console.log(d);
                        return d3.time.months(new Date(d, 0, 1), new Date(d+1, 0, 1));
                    });
                // on enter in months, append a g
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
                // in months, on exit, remove
                mon.exit().remove();
                // setup day containers for each months
                days = mon.selectAll('g')
                    .data(function(d) { 
                        return d3.time.days(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)); 
                    });
                //  in days, on enter, append a g of class btn
                days.enter().append('g').attr('class', 'btn');
                //  for each day, move the text, add class hover and onclick event handler
                days.attr('transform', function() { return 'translate(0,24)'; })
                    .classed('hover', true)
                    .classed('cal-disabled cal-oor', function(d) {
                        // console.log(d ,scope.minDate, (d < scope.minDate) );
                        return (scope.minDate ? (d < scope.minDate) : false) ||
                               (scope.maxDate ? (scope.maxDate < d) : false);
                    })
                    .classed('selected', function(d){
                        return scope.ngModel && (dateFormat(d) == dateFormat(scope.ngModel));
                    })
                    .on('click', function(d){
                        scope.$apply(function() {
                            d3.event.preventDefault();
                            scope.ngModel = d;
                            is_a_popup && popup.css('display', 'none');
                        });
                    });
                // .. also, add a rect on the background
                days.append('rect')
                    .attr('width', cubesize)
                    .attr('height', cubesize)
                    .attr('y', function(d, i) { return weekOfMonth(d) * (cubesize+1); })
                    .attr('x', function(d, i) { return (d.getDay()) * (cubesize+1); })
                    .attr('fill', 'white')
                    ;
                // .. and append a text on the foreground
                days.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 10)
                    .attr('y', function(d, i) { return weekOfMonth(d) * (cubesize+1)+13; })
                    .attr('x', function(d, i) { return (d.getDay()+1) * (cubesize+1)-10; })
                    .text(function(d, i) { return d.getDate(); })
                    ;
                // if we have date counts, then draw them
                if(attrs.dateCount) {
                    drawCounts();
                }
                // in days, on exit, remove
                days.exit().remove();
            };
            
            scope.$watch('maxDate', function(){
                if(scope.maxDate && scope.year > scope.maxDate.getFullYear()){
                    scope.year = scope.maxDate.getFullYear();
                }
                draw();
            });
            scope.$watch('minDate', function(){
                if(scope.minDate && scope.year < scope.minDate.getFullYear()){
                    scope.year = scope.minDate.getFullYear();
                }
                draw();
            });
            scope.$watch('year', function(){
                if(!scope.year){
                    scope.year = new Date().getFullYear();
                }
                draw();
            });
            scope.$watch('ngModel', function(){
                if(scope.ngModel){
                    scope.year = scope.ngModel.getFullYear();
                    days.classed('selected', function(d){
                        return scope.ngModel && (dateFormat(d) == dateFormat(scope.ngModel));
                    });
                }
            });
            
            if(attrs.dateCount) {
                scope.$watch('dateCount', function(value) {
                    drawCounts();
                });
            }
        }
    };
})
.directive('a2Img', function($compile){
    return {
        restrict : 'E',
        scope : {},
        link: function ($scope, $element, $attr) {
            $element.addClass('a2-img');
            var loader = $compile(
                '<loader hide-text="yes"></loader>'
            )($scope).appendTo($element);
            var img = $('<img />')
                .load(function(){
                    $element.removeClass('loading');
                })
                .appendTo($element);

            $attr.$observe('a2Src', function(new_src){
                if(!new_src){
                    img.attr('src', '');
                    return;
                }
                $element.addClass('loading');
                var image = new Image();
                image.onload = function () {
                    img.attr('src', this.src);
                };
                image.src = new_src;
                
            });
            
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
                        a2TrainingSets.getDataImage($scope.trainingSet.name, $scope.datum.id, function(datum2){
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
.directive('a2InsertIn', function(){
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
            
            anchor.on('$destroy', function(){
                $element.remove();
            });
        }        
    };
})
 ;
