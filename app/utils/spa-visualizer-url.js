/* jshint node:true */
'use strict';
/**
 * Target of the /project/<slug>/visualizer[/...] -> SPA redirect (2026-09-28).
 * Zero dependencies on purpose, so it is testable on bare node.
 *
 * @param {string} projectUrl  the :projectUrl route param
 * @param {string|undefined} rest  the `*` tail after /visualizer/ (may be undefined or '')
 * @param {string} originalUrl  req.originalUrl (the query string is copied verbatim)
 * @return {string}  /p/<slug>/visualizer[/<rest without trailing slash>][?<query>]
 */
module.exports = function spaVisualizerUrl (projectUrl, rest, originalUrl) {
    var tail = rest ? '/' + String(rest).replace(/\/+$/, '') : '';
    if (tail === '/') { tail = ''; }
    var url = String(originalUrl || '');
    var q = url.indexOf('?');
    var query = q === -1 ? '' : url.slice(q);
    return '/p/' + encodeURIComponent(projectUrl) + '/visualizer' + tail + query;
};
