angular.module('arbimon2.directive.a2-dropdown', [])
.directive('a2Dropdown', function($compile){
    var masterTemplate = angular.element(
        '<div dropdown dropdown-append-to-body>' +
            '<button class="btn btn-sm btn-default dropdown-toggle" dropdown-toggle>' +
                '<span></span> <i class="fa fa-caret-down"></i>' +
            '</button>' +
            '<ul class="dropdown-menu dropup" role="menu">' + 
                '<li ng-repeat="$item in list" ng-class="{active: $item == $selectedItem}">' +
                    '<a ng-click="select($item)"><span></span></a>' + 
                '</li>' + 
            '</ul>' +
        '</div>'        
    );

    return {
        restrict:'E',
        require:'ngModel',
        scope:true,
        compile: function(element, attrs){
            var tpl = angular.element(masterTemplate[0].cloneNode(true));
            var itemTpl = tpl.children('ul').children('li').children('a').children('span');
            var selectedItemTpl = tpl.children('button').children('span');
            var elementHtml = element.html();
            
            itemTpl.append(elementHtml);
            selectedItemTpl.append(elementHtml.replace(/\$item\b/g, '$selectedItem'));
            
            element.empty();
            var compiledTpl = $compile(tpl.clone());
            
            return function(scope, linkElement, attrs, ngModelCtrl){
                linkElement.append(compiledTpl(scope));
                
                scope.$watch(attrs.list, function(list){
                    scope.list = list || [];
                });                
                
                scope.select = function (item){
                    scope.$selectedItem = item;
                    ngModelCtrl.$setViewValue(item, true);
                };
                
                ngModelCtrl.$render = function() {
                    scope.$selectedItem = ngModelCtrl.$viewValue;
                };
            };
        },
    };
});