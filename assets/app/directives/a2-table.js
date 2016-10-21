angular.module('a2.directive.a2-table', [
    
])
.directive('a2Table', function($window, $filter, $templateCache, $compile) {
    var $ = $window.$;
    
    function compileFields(element){
        return element.children('field').toArray().map(function(field){
            field = angular.element(field);
            return {
                title: field.attr('title'),
                key: field.attr('key'),
                content: field.html()
            };
        });
    }
    
    function compileSelectExpand(element, options){
        var selectExpand = element.children('expand-select');
        if(!selectExpand.length){
            return;
        }
        
        var clone = selectExpand.clone(true);
        selectExpand.detach();
        selectExpand = angular.element('<tr ng-show="selected"><td colspan="' + options.fieldCount + '"></td></tr>');
        selectExpand.find('td').append(clone);
        return selectExpand;
    }
    
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
        controller: 'a2TableCtrl as controller',
        compile: function(element, attrs) {
            var options = {};
            options.fields = compileFields(element);
            options.hasCheckbox = attrs.noCheckbox === undefined;
            options.hasSelection = attrs.noSelect === undefined;
            options.fieldCount = options.fields.length + (options.hasCheckbox?1:0);
            options.selectExpand = compileSelectExpand(element, options);
            
            return function(scope, element, attrs, a2TableCtrl) {
                scope.fields = options.fields;
                if(options.selectExpand){
                    a2TableCtrl.selectExpand = $compile(options.selectExpand)(scope);
                }
                
                scope.noCheck = !options.hasCheckbox;
                scope.noSelect = !options.hasSelection;
                scope.sortKey = attrs.defaultSort || scope.sortKey;
                
                if(attrs.search) {
                    scope.$watch('search', function(value) {
                        scope.query = scope.search;
                        scope.updateChecked();
                    });
                }
                    
                if(attrs.checked) {
                    scope.$watch('rows', scope.updateChecked, true);
                }
                
                var template = angular.element($templateCache.get('/directives/a2-table.html'));
                
                
                element.append($compile(template)(scope));
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
    
    this.sel = function(row, $index, $event) {
        if($scope.noSelect)
            return;
            
        $scope.selected = row;
        if(this.selectExpand){
            angular.element($event.currentTarget).after(
                this.selectExpand
            );
        }
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
        requires:'^a2Table',
        link: function(scope, element, attrs, a2TableCtrl) {
                element.html(scope.template);
                $compile(element.contents())(scope);
        }
    };
})
;
