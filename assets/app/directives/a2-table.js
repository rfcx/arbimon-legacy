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
                tdclass: clone.attr('tdclass'),
                width: clone.attr('width'),
                filter: clone.attr('filter') !== undefined ? (clone.attr('filter') || clone.attr('key')) : undefined,
                content: clone.html(),
                show: clone.attr('show'),
                tooltip: clone.attr('tooltip')
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
            selected: '=?',  // able to work with $scope.selected rows
            onSelect: '&',
            onCheck: '&',
            onCheckAll: '&',
            checked: '=?', // able to work with $scope.checked rows
            search: '=?',
            checkAll: '=?',
            // noCheckbox: '@',    // disable row checkboxes
            // noSelect: '@',      // disable row selection
            dateFormat: '@',    // moment date format, default: 'lll'
            numberDecimals: '@', // decimal spaces
        },
        controller: 'a2TableCtrl as a2TableController',
        compile: function(element, attrs) {
            var template = angular.element($templateCache.get('/directives/a2-table.html'));
            var tplHead = template.find("thead tr.headers");
            var tplFilters = template.find("thead tr.filters");
            var tplBody = template.find("tbody tr");
            var options = {};
            var filterable = [];
            var hasFilters = false;
            options.fields = compileFields(element);
            options.hasCheckbox = attrs.noCheckbox === undefined;
            options.hasSelection = attrs.noSelect === undefined;
            options.fieldCount = options.fields.length + (options.hasCheckbox?1:0);
            options.selectExpand = compileSelectExpand(element, options);
            options.fields.forEach(function(field, index){
                tplHead.append(
                    angular.element('<th ng-click="a2TableController.sortBy(' + index+ ')" class="cs-pointer"' + (field && field.tooltip !== undefined ? ' title="' + field.tooltip + '"' : '') + (field && field.show !== undefined ? ' ng-if="' + field.show + '"' : '') + '></th>').addClass(field.tdclass).text(field.title).append(
                        field.key ?
                        '    <i ng-if="sortKey == ' + index + '" class="fa" ng-class="reverse ? \'fa-chevron-up\': \'fa-chevron-down\'"></i>\n' :
                        ''
                    )
                );
                hasFilters |= field.filter !== undefined;
                tplFilters.append(
                    angular.element('<th' + (field && field.show !== undefined ? ' ng-if="' + field.show + '"' : '') + '></th>').append(
                        (field.filter !== undefined) ?
                        '   <input type="text" class="a2-table-filter form-control" ng-model="a2TableController.filter['+index+']" ng-change="a2TableController.onFilterChanged(' + index + ')">\n' :
                        ''
                    )
                );
                tplBody.append(
                    angular.element('<td ' + (['Project', 'Species'].includes(field.title) ? 'title="' + field.content +'"' : '') + (field.width ? 'width="' + field.width + '"' : '') + (field && field.show !== undefined ? ' ng-if="' + field.show + '"' : '') + '>').addClass(field.tdclass).html(field.content)
                );
            });

            return function(scope, element, attrs, a2TableCtrl) {
                var tableScope = scope.$parent.$new(false, scope);
                options.scope = scope;
                options.tableScope = tableScope;
                options.onSelect = scope.onSelect && function (row){
                    return scope.onSelect({row:row});
                };
                options.onCheck = scope.onCheck && function (row){
                    return scope.onCheck({row:row});
                };
                options.onCheckAll = scope.onCheckAll && function (){
                    return scope.onCheckAll();
                };

                a2TableCtrl.initialize(options);

                tableScope.a2TableController = a2TableCtrl;
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


                var cmpel = $compile(template.clone())(tableScope);
                element.append(cmpel);

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
        this.options = options;
        this.__onSelect = options.onSelect;
        this.__onCheck = options.onCheck;
        this.__onCheckAll = options.onCheckAll;
        this.hasFilters = options.fields.reduce(function (_, field){ return _ || field.filter !== undefined; }, false);
        this.filter = {};
    };

    this.setRows = function(rows){
        this.rows = rows;
        this.updateChecked();
    };

    this.onFilterChanged = function(index){
        var query = (tableScope.query || (tableScope.query = {}));
        var key = this.options.fields[index].filter.split('.');
        var value = this.filter[index];
        if(value == ""){
            while(key.length > 1){
                query = (query || {})[key.shift()];
            }
            delete query[key.shift()];
        } else {
            while(key.length > 1){
                var keycomp = key.shift();
                query = (query[keycomp] || (query[keycomp] = {}));
            }
            query[key.shift()] = value;
        }
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
        if(this.__onCheckAll){
            this.__onCheckAll();
        }
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

    this.onCheck = function(row, $index, $event) {
        if(this.__onCheck){
            this.__onCheck(row);
        }

        let checker = arr => arr.every(Boolean);
        this.checkAll = checker(this.rows.map(r => r.checked))
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
