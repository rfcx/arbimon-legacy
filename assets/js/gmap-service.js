angular.module('google-maps', [])
.service('geocoding', function() {
    geocoder = new google.maps.Geocoder();
    return geocoder;
})
;
