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
 ;
