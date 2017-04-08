angular.module('a2.utils-browser-metrics', [    
])
.service('a2BrowserMetrics', function(){
    var metrics = {};
    
    var css = {
        "border":  "none",
        "height":  "200px",
        "margin":  "0",
        "padding": "0",
        "width":   "200px"
    };

    var inner = $("<div>").css($.extend({}, css));
    var outer = $("<div>").css($.extend({
        "left":       "-1000px",
        "overflow":   "scroll",
        "position":   "absolute",
        "top":        "-1000px"
    }, css)).append(inner).appendTo("body")
    .scrollLeft(1000)
    .scrollTop(1000);

    metrics.scrollSize = {
        height : (outer.offset().top  - inner.offset().top ) | 0,
        width  : (outer.offset().left - inner.offset().left) | 0
    };

    outer.remove();
    
    return metrics;
})
;