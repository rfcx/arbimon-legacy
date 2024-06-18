angular.module('humane', [])
.factory('notify', function($window) {
    var humane = $window.humane;
    humane.timeout = 8000
    
    humane.baseCls = "humane-original";
    humane.error = humane.spawn({ addnCls: humane.baseCls+'-error' });
    humane.info = humane.spawn({ addnCls: humane.baseCls+'-info' });
    humane.success = humane.spawn({ addnCls: humane.baseCls+'-success' });
    
    humane.serverError = function() {
        humane.error("Error communicating with server");
        
    };
    
    return humane;
});
