angular.module('a2.filter.array-filter-with-skipping-value', [])
.filter('arrayFilterWithSkippingValue',function() {
    return function(items, search) {
        if (items && items.length && items.length > 0) {
            if (!search.length) {
                return items
            }
            const sites1 = items.slice(1)
            const sites = sites1.filter(site => site.toLowerCase().startsWith(search.toLowerCase()))
            sites.unshift('Select all search result' + ' (' + search + '*)')
            return sites
        }
    };
})
;
