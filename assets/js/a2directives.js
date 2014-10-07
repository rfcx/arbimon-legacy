angular.module('a2directives', [])
.directive('a2Table', function() {
    return {
        restrict: 'E',
        scope: {
            fields: '=',
            rows: '=',
            onSelect: '&',
            checked: '=',
            search: '='
        },
        templateUrl: '/partials/directives/table.html',
        link: function(scope, element, attrs) {
            
            if(attrs.search) {
                scope.$watch(attrs.search, function(value) {
                    //~ console.log(value);
                    scope.query = scope.search;
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
                scope.$watch('rows', function(rows) {
                    if(rows) {
                        scope.checked = rows.filter(function(row) {
                            return row.checked | false;
                        });
                    }
                }, 
                true);
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
            
            scope.sel = function($index) {                
                scope.selected = scope.rows[$index];
                
                if(attrs.onSelect)
                    scope.onSelect({ $index: $index });
            }
        }
    };
})
//~ .directive('mapita', function() {
    //~ return {
        //~ restrict: 'A',
        //~ template: "",
        //~ link: function(scope, element) {
            //~ var mapOptions = {
                //~ center: { lat: 18.3, lng: -66.5},
                //~ zoom: 8
            //~ };
            //~ 
            //~ scope.map = new google.maps.Map(element[0], mapOptions);
        //~ }   
    //~ };
//~ })
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
 });
