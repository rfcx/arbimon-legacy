angular.module('arbimon2.directive.a2-button', [])
.directive('a2Button', function() {
    return {
        restrict: 'E',
        replace: true,
        scope: {
            label: '@',
            iconSrc: '@?',
            btnClass: '@',
            tooltipText: '@',
            action: '&',
            isViewOnly: '=',
            loading: '=?'
        },
        template: `
        <div class="group clear-button" style="position: relative; display: inline-block;">
            <button class="btn btn-rounded-full {{btnClass}}"

                ng-class="{'disabled': isViewOnly || loading}"
                style="display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;"
                ng-click="!isViewOnly && action()">
                <span ng-bind="label"></span>
                <div ng-if="!isViewOnly" class="absolute z-10 inline-block px-3 py-2 ml-5 text-sm font-medium text-gray-900 bg-white rounded-lg shadow-lg border font-poppins border-gray-100 group-hover-visible w-max whitespace-nowrap pointer-events-none"
                style="position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; background: white; color: black; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: 1px solid #eee; z-index: 9999; font-size: 14px;">
                        {{isViewOnly ? 'Project is View Only' : tooltipText}}
                    <div style="position: absolute; width: 8px; height: 8px; background: white; bottom: -4px; left: 20px; transform: rotate(45deg); border-right: 1px solid #eee; border-bottom: 1px solid #eee;"></div>
                </div>
                
                <img ng-if="iconSrc" 
                     class="ml-2" 
                     ng-src="{{iconSrc}}"
                     ng-style="isViewOnly || loading ? 
                        {'filter': 'brightness(0) invert(52%) sepia(4%) saturate(452%) hue-rotate(24deg) brightness(97%) contrast(89%)'} : {}"
                     style="width: 16px; height: 16px; display: block;">
            </button>
        </div>
        `
    };
});