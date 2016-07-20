angular.module('a2.url-update-service', [])
.factory('a2UrlUpdate', function(){
    return {
        cache:{},
        prefix : '_t_',
        clear : function(){
            this.cache={};
        },
        update: function(url){
            url = this.get(url);
            var qidx = url.indexOf('?');
            var url2;
            var _t_ = new Date().getTime();
            if(qidx >= 0){
                var re = new RegExp('(^|&)' + this.prefix + '=(\\d+)'); 
                var query = url.substr(qidx+1);
                var m = re.exec(query);
                if(m){
                    url2 = url.substr(0,qidx) + '?' + query.replace(re, this.prefix + '=' + _t_);
                } 
                else {
                    url2 = url + '&' + this.prefix + '=' + _t_;
                }
            } 
            else {
                url2 = url + '?' + this.prefix + '=' + _t_;
            }
            
            this.cache[url] = url2;
            $('[src="'+url+'"]').attr('src', '').attr('src', url2);
        },
        get: function(url){
            var url2;
            while((url2 = this.cache[url])){
                url = url2;
            }
            return url;
        }
    };
})
.filter('a2UpdatedUrl', function(a2UrlUpdate){
    return function(url){
        return a2UrlUpdate.get(url);
    };
})
;
