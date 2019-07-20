angular.module('a2.filter.a2-page-number-to-title', [
])
.filter('a2PageNumberToTitle',function() {
    return function a2PageNumberToTitle(page_number){
        return page_number + 1;
    };
})
;
