angular.module('a2.srv.uploads', [
    'a2.srv.api',
])
.factory('a2UploadsService',function(a2APIService){
    return {
        getProcessingList: function(opts) {
            const config = {
                params: opts
            };
            return a2APIService.get('/uploads/processing', config).then(function(data) {
                return data
            })
        },
        checkStatus: function(opts) {
            const config = {
                params: opts
            };
            return a2APIService.get('/uploads/check', config).then(function(data) {
                return data.items
            })
        },
    };
})
;
