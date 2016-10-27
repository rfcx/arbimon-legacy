angular.module('a2.directive.a2-table', [
    
])
.directive('a2Table', function($window, $filter, $templateCache, $compile) {
    var $ = $window.$;
    
    function compileFields(element){
        return element.children('field').toArray().map(function(field){
            field = angular.element(field);
            var clone = field.clone();
            field.detach();
            return {
                title: clone.attr('title'),
                key: clone.attr('key'),
                content: clone.html()
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
            checked: '=?',
            search: '=?',
            // noCheckbox: '@',    // disable row checkboxes
            // noSelect: '@',      // disable row selection
            dateFormat: '@',    // moment date format, default: 'lll'
            numberDecimals: '@', // decimal spaces 
        },
        controller: 'a2TableCtrl as controller',
        compile: function(element, attrs) {
            var template = angular.element($templateCache.get('/directives/a2-table.html'));
            var tplHead = template.find("thead tr");
            var tplBody = template.find("tbody tr");
            var options = {};
            options.fields = compileFields(element);
            options.hasCheckbox = attrs.noCheckbox === undefined;
            options.hasSelection = attrs.noSelect === undefined;
            options.fieldCount = options.fields.length + (options.hasCheckbox?1:0);
            options.selectExpand = compileSelectExpand(element, options);
            options.fields.forEach(function(field, index){
                tplHead.append(
                    angular.element('<th ng-click="controller.sortBy(' + index+ ')"></th>').text(field.title).append(
                        field.key ?
                        '    <i ng-if="sortKey == ' + index + '" class="fa" ng-class="reverse ? \'fa-chevron-up\': \'fa-chevron-down\'"></i>\n' :
                        ''
                    )
                );
                tplBody.append(
                    angular.element('<td>').addClass(field.tdclass).html(field.content)
                );
            });
            
            return function(scope, element, attrs, a2TableCtrl) {
                var tableScope = scope.$parent.$new(false, scope);
                options.scope = scope;
                options.tableScope = tableScope;
                options.onSelect = scope.onSelect && function (row){
                    return scope.onSelect({row:row});
                };
                
                a2TableCtrl.initialize(options);
                
                tableScope.controller = a2TableCtrl;
                a2TableCtrl.fields = options.fields;
                if(options.selectExpand){
                    a2TableCtrl.selectExpand = $compile(options.selectExpand)(tableScope);
                }
                
                a2TableCtrl.noCheck = !options.hasCheckbox;
                a2TableCtrl.noSelect = !options.hasSelection;
                tableScope.sortKey = attrs.defaultSort || tableScope.sortKey;
                
                if(attrs.search) {
                    scope.$watch('search', function(value) {
                        tableScope.query = scope.search;
                        a2TableCtrl.updateChecked();
                    });
                }
                    
                a2TableCtrl.setRows(scope.rows);
                scope.$watch('rows', function(rows){
                    a2TableCtrl.setRows(rows);
                }, true);

                
                element.append($compile(template)(tableScope));
                console.log("!!!", tableScope);
                
                scope.$on('$destroy', function(){
                    tableScope.$destroy();
                });
                
            };
        }
    };
})
.controller('a2TableCtrl', function($filter) {
    var scope, tableScope;
    this.initialize = function(options){
        scope = options.scope;
        tableScope = options.tableScope;
        this.__onSelect = options.onSelect;
    };
    
    this.setRows = function(rows){
        this.rows = rows;
        this.updateChecked();
    };
    
    this.updateChecked = function() {
        if(this.rows) {
            var visible = $filter('filter')(this.rows, tableScope.query);
            
            scope.checked = visible.filter(function(row) {
                return row.checked | false;
            });
        }
    };
    
    this.toggleAll = function() {
        var allFalse = this.rows.reduce(function(_, row){
            return _ && !row.checked;
        }, true);
        
        this.rows.forEach(function(row){
            row.checked = allFalse;
        });
        
        tableScope.checkall = allFalse;        
    };
    
    this.check = function($event, $index) {        
        if(this.lastChecked && $event.shiftKey) {
            if(this.lastChecked) {
                var rows;
                if(this.lastChecked > $index) {
                    rows = this.rows.slice($index, this.lastChecked);
                } else {
                    rows = this.rows.slice(this.lastChecked, $index);
                }
                    
                rows.forEach(function(row) {
                    row.checked = true;
                });
            }
        }
                
        this.lastChecked = $index;
    };
    
    this.keyboardSel = function(row, $index, $event) {
        if($event.key === " " || $event.key === "Enter"){
            this.sel(row, $index);
        }
    };
    
    this.sel = function(row, $index, $event) {
        if(this.noSelect){
            return;
        }
            
        if(tableScope.selected === row){
            row = undefined;
        }
        
        tableScope.selected = row;
        scope.selected = row;
        if(this.selectExpand){
            angular.element($event.currentTarget).after(
                this.selectExpand
            );
        }
        if(this.__onSelect){
            this.__onSelect(row);
        }
    };
                        
    this.sortBy = function(fieldIndex) {
        var field = this.fields[fieldIndex];
        
        if(tableScope.sortKey !== fieldIndex) {
            tableScope.sortKey = fieldIndex;
            tableScope.sort = field.key;
            
            tableScope.reverse = false;
        } else {
            tableScope.reverse = !tableScope.reverse;
        }
            
    };
            
})
;
