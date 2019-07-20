angular.module('a2.filter.a2-page-title-to-number', [
])
.filter('a2PageTitleToNumber',function() {
    return function a2PageTitleToNumber(page_title){
        var page_number;
        if(!isFinite(page_title) || page_title === ''){
            page_number = '';
        } else if(page_title == '0'){
            page_number = 9;
        } else {
            page_number = page_title - 1;
        }

        return page_number;
    };
})
;
