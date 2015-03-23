angular.module('humane', [])
.service('notify', function($window) {
    var humane = $window.humane;
    
    humane.baseCls = "humane-original";
    humane.error = humane.spawn({ addnCls: humane.baseCls+'-error' });
    humane.info = humane.spawn({ addnCls: humane.baseCls+'-info' });
    humane.success = humane.spawn({ addnCls: humane.baseCls+'-success' });

    return humane;
});
