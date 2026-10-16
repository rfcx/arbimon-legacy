/**
 * @ngdoc directive
 * @name a2-roi-img
 * @description
 * ROI thumbnail <img> that loads ONLY the URL it is given (`roi.uri`) and recovers
 * from the two transient failures we measured, instead of falling back to the
 * stored arbimon2 detection PNG (rfcx-local OPEN-ITEMS §473, 2026-10-16):
 *
 *  1. EXPIRED signed URL: `roi.uri` carries `exp=<epoch s>` (6 h, hour-bucketed).
 *     A tab left open past it gets 401s. If `exp` has passed, ask the owner page to
 *     re-fetch its ROIs (fresh URLs) via `a2-roi-img-refresh`, at most once per
 *     page load, and let Angular re-bind.
 *  2. Transient render failure (a 504 during a storage hiccup, an aborted request):
 *     retry the SAME url once, after a short delay, with a cache-busting `&r=1`
 *     (media-api ignores unknown query params; the signature covers stream-token +
 *     exp only — verified 2026-10-16).
 *
 * Why no stored-PNG fallback: post-§196 (2026-08-24) PM jobs never wrote detection
 * PNGs, so for them the fallback could only ever 404, and the whole arbimon2 bucket
 * is being retired. Rows that CANNOT render dynamically (no datetime_utc / stream id)
 * still receive the stored URL as `roi.uri` from the server, unchanged.
 *
 * Usage: <img a2-roi-img="roi.uri" a2-roi-img-refresh="controller.refreshRoiUrls()" class="roi-img"/>
 */
angular.module('a2.directive.roi-img', [])
.directive('a2RoiImg', function($timeout, $window){
    var RETRY_DELAY_MS = 1500;
    function expOf(url){
        var m = /[?&]exp=(\d+)/.exec(url || '');
        return m ? Number(m[1]) : null;
    }
    function withRetryMark(url){
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'r=1';
    }
    return {
        restrict: 'A',
        scope: {
            src: '=a2RoiImg',
            refresh: '&a2RoiImgRefresh'
        },
        link: function(scope, element){
            var el = element[0];
            var retried = false;
            var pending = null;

            scope.$watch('src', function(url){
                retried = false;
                if (pending) { $timeout.cancel(pending); pending = null; }
                element.removeClass('roi-img-failed');
                if (url) { el.src = url; } else { el.removeAttribute('src'); }
            });

            element.on('error', function(){
                var url = scope.src;
                if (!url) return;
                var exp = expOf(url);
                if (exp && exp * 1000 <= Date.now()) {
                    // Expired: only a fresh server-minted URL can fix this.
                    scope.$applyAsync(function(){ scope.refresh(); });
                    return;
                }
                if (!retried) {
                    retried = true;
                    pending = $timeout(function(){
                        pending = null;
                        if (scope.src === url) el.src = withRetryMark(url);
                    }, RETRY_DELAY_MS, false);
                    return;
                }
                element.addClass('roi-img-failed');
                if ($window.console && $window.console.warn) $window.console.warn('a2-roi-img: render failed twice', url.split('?')[0]);
            });

            scope.$on('$destroy', function(){
                if (pending) $timeout.cancel(pending);
                element.off('error');
            });
        }
    };
})
/**
 * Rate-limited guard for the expired-URL refresh: a page of thumbnails expires at
 * the same instant, so they must trigger ONE reload, and a reload that somehow
 * hands back URLs that still fail must not loop. At most one reload per
 * MIN_INTERVAL_MS (a tab that stays open another 6 h can refresh again).
 */
.factory('a2RoiImgRefreshGuard', function(){
    var MIN_INTERVAL_MS = 60000;
    return function create(reloadFn){
        var last = 0;
        return function(){
            var now = Date.now();
            if (now - last < MIN_INTERVAL_MS) return;
            last = now;
            return reloadFn();
        };
    };
});