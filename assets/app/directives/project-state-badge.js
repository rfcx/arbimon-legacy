/**
 * @name arbimon2.directive.project-state-badge
 * @description
 * Project state badge with dynamic tooltip placement.
 * Adjusted line-height for better text spacing in tooltip.
 */
angular.module('arbimon2.directive.project-state-badge', [])
.directive('projectStateBadge', function(Project) {
    return {
        restrict: 'E',
        replace: true,
        scope: {
            tooltipPlacement: '@?' // 'top', 'bottom', 'left', 'right'
        },
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

            ctrl.getTooltipStyle = function() {
                var placement = $scope.tooltipPlacement || 'top';
                var styles = {
                    'position': 'absolute',
                    'background': 'white',
                    'color': 'black',
                    'padding': '8px 12px',
                    'border-radius': '8px',
                    'box-shadow': '0 4px 6px rgba(0,0,0,0.2)',
                    'border': '1px solid #eee',
                    'z-index': '9999',
                    'font-size': '14px',
                    'white-space': 'nowrap',
                    'pointer-events': 'none',
                    'text-align': 'center',
                    'font-family': "'Poppins', sans-serif",
                    'line-height': '1.4'
                };

                switch (placement) {
                    case 'top':
                        angular.extend(styles, { 'bottom': '100%', 'left': '0', 'margin-bottom': '8px' });
                        break;
                    case 'bottom':
                        angular.extend(styles, { 'top': '100%', 'left': '50%', 'transform': 'translateX(-50%)', 'margin-top': '8px' });
                        break;
                    case 'right':
                        angular.extend(styles, { 'left': '100%', 'top': '50%', 'transform': 'translateY(-50%)', 'margin-left': '10px' });
                        break;
                    case 'left':
                        angular.extend(styles, { 'right': '100%', 'top': '50%', 'transform': 'translateY(-50%)', 'margin-right': '10px' });
                        break;
                }

                return styles;
            };

            ctrl.getArrowStyle = function() {
                var placement = $scope.tooltipPlacement || 'top';
                var arrowBase = {
                    'position': 'absolute',
                    'width': '8px',
                    'height': '8px',
                    'background': 'white',
                    'transform': 'rotate(45deg)',
                    'border': '1px solid #eee'
                };

                switch (placement) {
                    case 'top':
                        return angular.extend(arrowBase, { 
                            'bottom': '-4px', 'left': '20px', 
                            'border-top': 'none', 'border-left': 'none' 
                        });
                    case 'bottom':
                        return angular.extend(arrowBase, { 
                            'top': '-4px', 'left': '50%', 'margin-left': '-4px',
                            'border-bottom': 'none', 'border-right': 'none' 
                        });
                    case 'right':
                        return angular.extend(arrowBase, { 
                            'left': '-4px', 'top': '50%', 'margin-top': '-4px', 
                            'border-top': 'none', 'border-right': 'none' 
                        });
                    case 'left':
                        return angular.extend(arrowBase, { 
                            'right': '-4px', 'top': '50%', 'margin-top': '-4px', 
                            'border-bottom': 'none', 'border-left': 'none' 
                        });
                }
            };

            ctrl.getTierStyle = function(tier) {
                var baseStyle = {
                    'border-radius': '50px', 'padding': '4px 12px', 'font-size': '14px',
                    'font-weight': '600', 'text-transform': 'capitalize', 'display': 'inline-block',
                    'line-height': '1', 'font-family': "'Poppins', sans-serif"
                };
                if (!tier) tier = 'free';
                switch (tier.toLowerCase()) {
                    case 'premium': return angular.extend(baseStyle, { 'background-color': 'rgba(217, 119, 6, 0.2)', 'color': '#f59e0b' });
                    case 'unlimited': return angular.extend(baseStyle, { 'background-color': 'rgba(244, 63, 94, 0.2)', 'color': '#fb7185' });
                    default: return angular.extend(baseStyle, { 'background-color': 'rgba(163, 230, 53, 0.2)', 'color': '#bef264' });
                }
            };

            ctrl.loadTieringData();
        },
        template: 
            '<div style="display: inline-flex; vertical-align: middle; align-items: center; gap: 4px;">' +
                '<div ng-if="!ctrl.tieringGuard.loading && (ctrl.tieringGuard.isViewOnlyBlocked || ctrl.tieringGuard.summary.isLocked)" ' +
                     'class="state-badge-group" style="position: relative; display: inline-block;">' +
                    
                    '<span style="background-color: #b3b3b3; border-radius: 50px; padding: 4px 12px; font-size: 14px; color: black; display: flex; align-items: center; justify-content: center; font-family: Poppins; font-weight: 600; text-transform: capitalize; cursor: default; line-height: 1;">' +
                        'View-Only' +
                    '</span>' +
                    
                    '<div class="state-badge-tooltip" ng-style="ctrl.getTooltipStyle()">This project is now View Only due to inactivity.<br>Upgrade your plan to restore access.<div ng-style="ctrl.getArrowStyle()"></div></div>' +
                '</div>' +
                
                '<span ng-if="!ctrl.tieringGuard.loading && !ctrl.tieringGuard.isViewOnlyBlocked && !ctrl.tieringGuard.summary.isLocked" ' +
                    'ng-style="ctrl.getTierStyle(ctrl.tieringGuard.summary.projectType)">' +
                    '{{ ctrl.tieringGuard.summary.projectType || "Free" }}' +
                '</span>' +

                '<style>' +
                    '.state-badge-group .state-badge-tooltip {' +
                        'visibility: hidden; ' +
                        'opacity: 0; ' +
                        'transition: opacity 0.2s ease-in-out; ' +
                    '}' +
                    '.state-badge-group:hover .state-badge-tooltip { ' +
                        'visibility: visible; ' +
                        'opacity: 1; ' +
                    '}' +
                '</style>' +
            '</div>'
    };
});