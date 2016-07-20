angular.module('a2.directive.news-feed-item', [
    'a2.srv.news',
    'templates-arbimon2',
    'a2.directive.a2-tags',
    'a2.filter.time-from-now',
])
.directive('newsFeedItem', function(a2NewsService, $compile){
    function parseFormat(format){
        var RE_INTERP = /%\((\w+)\)s/g;
        var interpolate = [], m;
        var lastidx, matchidx, startidx = 0;
        // jshint -W084
        while((m = RE_INTERP.exec(format))){
            lastidx =  startidx;
            matchidx =  RE_INTERP.lastIndex - m[0].length;
            if(lastidx < matchidx){
                interpolate.push(format.substr(lastidx, matchidx - lastidx));
            }
            interpolate.push("<span a2-tag-"+m[1]+"=\"news.data."+m[1]+"\" ></span>");
            startidx  = RE_INTERP.lastIndex;
        }
        if(startidx < format.length){
            interpolate.push(format.substr(startidx));
        }
        return '<span>' + interpolate.join('') + '</span>';
    }
    
    var parsedFormatsPromise = a2NewsService.loadFormats().then(function(formats){
        return Object.keys(formats).reduce(function(_, i){
            _[i] = parseFormat(formats[i]);
            return _;
        }, {});
    });
    
    return {
        restrict: 'EAC',
        scope:{
            news: '=newsFeedItem'
        },
        templateUrl: '/directives/news-feed-item.html',
        link: function(scope, element, attrs){
            var message = element.find('.message');
            scope.$watch('news', function(news){
                parsedFormatsPromise.then(function(parsedFormats){
                    message.empty().append($compile(parsedFormats[news.type])(scope));
                });
            });
        }
    };
})
;
