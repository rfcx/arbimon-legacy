/**
 * @name a2-project-state-badge
 * @description
 * Directive with full Inline Styles (No Tailwind required).
 */
angular.module('arbimon2.directive.project-state-badge', [])
.directive('projectStateBadge', function(Project) {
    return {
        restrict: 'E',
        replace: true,
        scope: {},
        controllerAs: 'ctrl',
        controller: function($scope) {
            var ctrl = this;
            ctrl.tieringGuard = { loading: true };

            ctrl.loadTieringData = function() {
                ctrl.tieringGuard.loading = true;
                Project.getAnalysisTieringGuard()
                    .then(function(guard) {
                        ctrl.tieringGuard = angular.extend({ loading: false }, guard);
                    })
                    .catch(function() {
                        ctrl.tieringGuard.loading = false;
                    });
            };

            // ฟังก์ชันคืนค่า Style Object ตามประเภทโปรเจกต์ (สีตามรูปที่แนบมา)
            ctrl.getTierStyle = function(tier) {
                var baseStyle = {
                    'border-radius': '50px',
                    'padding': '4px 12px',
                    'font-size': '14px',
                    'font-weight': '600',
                    'text-transform': 'capitalize',
                    'display': 'inline-block',
                    'line-height': '1',
                    'font-family': 'Poppins'
                };
                
                if (!tier) tier = 'free';
                
                switch (tier.toLowerCase()) {
                    case 'premium':
                        return angular.extend(baseStyle, { 'background-color': 'rgba(217, 119, 6, 0.2)', 'color': '#f59e0b' });
                    case 'unlimited':
                        return angular.extend(baseStyle, { 'background-color': 'rgba(244, 63, 94, 0.2)', 'color': '#fb7185' });
                    case 'free':
                    default:
                        return angular.extend(baseStyle, { 'background-color': 'rgba(163, 230, 53, 0.2)', 'color': '#bef264' });
                }
            };

            ctrl.loadTieringData();
        },
        template: 
            '<div style="display: inline-flex; vertical-align: middle; gap: 4px;">' +
                '<div ng-if="!ctrl.tieringGuard.loading && (ctrl.tieringGuard.isViewOnlyBlocked || ctrl.tieringGuard.summary.isLocked)" class="relative group" style="position: relative;">' +
                    '<span style="background-color: #b3b3b3; border-radius: 50px; padding: 4px 12px; font-size: 14px; color: black; display: flex; align-items: center; justify-content: center; font-family: Poppins; font-weight: 600; text-transform: capitalize; cursor: default; line-height: 1;">' +
                        'View-Only' +
                    '</span>' +
                    
                    '<div class="absolute z-10 inline-block px-3 py-2 text-sm font-medium text-gray-900 bg-white rounded-lg shadow-lg border font-poppins border-gray-100 group-hover-visible w-max whitespace-nowrap pointer-events-none" ' +
                    'style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; background: white; color: black; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: 1px solid #eee; z-index: 9999; font-size: 14px;">' +
                            'This project is now View Only due to inactivity. Upgrade your plan to restore access.' +
                        '<div style="position: absolute; width: 8px; height: 8px; background: white; bottom: -4px; left: 50%; transform: translateX(-50%) rotate(45deg); border-right: 1px solid #eee; border-bottom: 1px solid #eee;"></div>' +
                    '</div>' +
                '</div>' +
                
                '<span ng-if="!ctrl.tieringGuard.loading && !ctrl.tieringGuard.isViewOnlyBlocked && !ctrl.tieringGuard.summary.isLocked" ' +
                    'ng-style="ctrl.getTierStyle(ctrl.tieringGuard.summary.projectType)">' +
                    '{{ ctrl.tieringGuard.summary.projectType || "Free" }}' +
                '</span>' +
            '</div>'
    };
});