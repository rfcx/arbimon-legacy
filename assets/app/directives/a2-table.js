angular.module('a2.directive.a2-table', [
    
])
.directive('a2Table', function($window, $filter, $templateCache, $compile) {
    var $ = $window.$;
    
    return {
        restrict: 'E',
        scope: {
            rows: '=',
            selected: '=?',
            onSelect: '&',
            extSort: '&',
            checked: '=?',
            search: '=?',
            // noCheckbox: '@',    // disable row checkboxes
            // noSelect: '@',      // disable row selection
            dateFormat: '@',    // moment date format, default: 'lll'
            numberDecimals: '@', // decimal spaces 
        },
        controller: 'a2TableCtrl',
        compile: function(tElement, tAttrs) {
            var detaEle = tElement;
            
            var fields = [];
            
            for(var i = 0; i < detaEle[0].children.length; i++) {
                var child = $(detaEle[0].children[i]);
                
                fields.push({
                    title: child.attr('title'),
                    key: child.attr('key'),
                    content: child.html()
                });
            }
            
            
            return function(scope, element, attrs) {
                scope.fields = fields;
                
                if(attrs.noCheckbox !== undefined) {
                    scope.noCheck = true;
                }
                
                if(attrs.noSelect !== undefined) {
                    scope.noSelect = true;
                }
                
                if(attrs.search) {
                    scope.$watch('search', function(value) {
                        scope.query = scope.search;
                        scope.updateChecked();
                    });
                }
                
                if(attrs.defaultSort) { 
                    scope.sortKey = attrs.defaultSort;
                }
                    
                if(attrs.checked) {
                    scope.$watch('rows', scope.updateChecked, true);
                }
                
                element.html($templateCache.get('/directives/a2-table.html'));
                
                $compile(element.contents())(scope);
            };
        }
    };
})
.controller('a2TableCtrl', function($scope, $filter) {
    $scope.updateChecked = function() {
        if($scope.rows) {
            var visible = $filter('filter')($scope.rows, $scope.query);
            
            $scope.checked = visible.filter(function(row) {
                return row.checked | false;
            });
        }
    };
    
    $scope.toggleAll = function() {
        var allFalse = true;
        
        for(var i in $scope.rows) {
            if($scope.rows[i].checked) {
                allFalse = false;
                break;
            }
        }
        
        for(var j in $scope.rows) {
            $scope.rows[j].checked = allFalse;
        }
        
        $scope.checkall = allFalse;
        
    };
    
    $scope.check = function($event, $index) {
        
        if($scope.lastChecked && $event.shiftKey) {
            if($scope.lastChecked) {
                var rows;
                if($scope.lastChecked > $index) {
                    rows = $scope.rows.slice($index, $scope.lastChecked);
                }
                else {
                    rows = $scope.rows.slice($scope.lastChecked, $index);
                }
                    
                rows.forEach(function(row) {
                    row.checked = true;
                });
            }
        }
                
        $scope.lastChecked = $index;
    };
    
    $scope.keyboardSel = function(row, $index, $event) {
        if($event.key === " " || $event.key === "Enter") 
            $scope.sel(row, $index);
    };
    
    $scope.sel = function(row, $index) {
        if($scope.noSelect)
            return;
            
        $scope.selected = row;
        if($scope.onSelect)
            $scope.onSelect({ row: row });
    };
                        
    $scope.sortBy = function(field) {
        if($scope.sortKey !== field.key) {
            $scope.sortKey = field.key;
            
            if($scope.extSort === undefined)
                $scope.sort = field.key;
            
            $scope.reverse = false;
        }
        else {
            $scope.reverse = !$scope.reverse;
        }
            
        if($scope.extSort)
            $scope.extSort({ sortBy: field.key, reverse: $scope.reverse });
    };
            
    $scope.formatString = function(value) {
                
        if(value instanceof Date) {
            return moment(value).utc().format($scope.dateFormat || 'lll');
        }
        else if(typeof value === 'number') {
            var precision = $scope.numberDecimals || 3;
            
            var p =  Math.pow(10, precision);
            
            return Math.round(value*p)/p;
        }
        
        return value;
    };
})
.directive('a2TableContent', function($compile){
    return {
        restrict: 'E',
        scope: {
            template: '=',
            row: '='
        },
        link: function(scope, element, attrs) {
                element.html(scope.template);
                $compile(element.contents())(scope);
        }
    };
})
;
