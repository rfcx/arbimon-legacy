angular.module('a2.browser_recordings', [
    'a2.browser_common',
    'a2.browser_recordings_by_site',
    'a2.browser_recordings_by_playlist',
])
.config(function(BrowserVisObjectsProvider, BrowserLOVOsProvider){
    BrowserVisObjectsProvider.add({
        type: 'recording',
        cardTemplate: '/app/visualizer/browser/recordings/card.html',
    });
})
;
