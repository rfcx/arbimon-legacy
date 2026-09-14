angular.module('humane', [])
.factory('notify', function($window) {
    var humane = $window.humane;
    humane.timeout = 5000
    
    humane.baseCls = "humane-original";
    humane.error = humane.spawn({ addnCls: humane.baseCls+'-error' });
    humane.info = humane.spawn({ addnCls: humane.baseCls+'-info' });
    humane.success = humane.spawn({ addnCls: humane.baseCls+'-success' });

    // §316 -- extract a user-facing message from an Angular $http error response.
    //
    // The server now answers a validation failure with 400 + {error: "<field>: <reason>"}
    // (see app/utils/joi-http-error.js). Before this, EVERY validation failure was a
    // 500 whose body was the bare string "Server error", so the only honest thing a
    // client could say was "something broke" -- which is why the messages below were
    // hardcoded. Now there is a real reason to show, but only for 4xx: a 5xx body is
    // still an internal failure the user can do nothing about, and we must not start
    // echoing internal errors at people.
    //
    // Returns null when there is no safe, useful message, so callers keep their
    // existing fallback text.
    function extractMessage(response) {
        if (!response) { return null; }
        // An Angular response object ({data, status, ...}); anything else is not ours.
        var status = response.status;
        var data = response.data;
        if (typeof status !== 'number' || status < 400 || status >= 500) { return null; }
        if (!data) { return null; }
        // The shape this codebase uses for 4xx JSON bodies: {error: "..."}.
        if (typeof data === 'string') { return data; }
        if (typeof data.error === 'string') { return data.error; }
        if (typeof data.message === 'string') { return data.message; }
        return null;
    }

    // Backwards compatible: called with no argument (as `.catch(notify.serverError)`
    // did before it was passed the rejection) it behaves exactly as it always has.
    humane.serverError = function(response) {
        var msg = extractMessage(response);
        humane.error(msg || "Error communicating with server");
    };

    // For `.catch(function(err){ ... })` handlers that hold the whole response.
    // Without this, `notify.error(err)` hands humane an OBJECT, and humane renders
    // it with `el.innerHTML = msg.html` -- i.e. the user sees "[object Object]"
    // or nothing useful.
    humane.apiError = function(response, fallback) {
        var msg = extractMessage(response);
        humane.error(msg || fallback || "Error communicating with server");
    };

    humane.extractMessage = extractMessage;

    return humane;
});