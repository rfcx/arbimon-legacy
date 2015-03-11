angular.module('humane', [])
.service('notify', ['$window', function($window) {
    $window.humane.baseCls = "humane-original";
    $window.humane.error = $window.humane.spawn({ addnCls: humane.baseCls+'-error' });
    $window.humane.info = humane.spawn({ addnCls: humane.baseCls+'-info' });
    $window.humane.success = humane.spawn({ addnCls: humane.baseCls+'-success' });

    return $window.humane;
}]);
