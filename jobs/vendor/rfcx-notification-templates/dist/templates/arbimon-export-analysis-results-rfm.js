"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbimonExportAnalysisResultsRfm = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
const DOWNLOAD_ICON = 'https://static.rfcx.org/arbimon/download-icon.png';
function formatBytes(bytes) {
    if (bytes == null || isNaN(bytes))
        return undefined;
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = Number(bytes);
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    // Whole numbers for B; one decimal for KB/MB/GB (keeps the trailing .0, e.g.
    // "2.0 MB") except when >= 100 where a decimal adds no value.
    const value = i === 0 || n >= 100 ? String(Math.round(n)) : n.toFixed(1);
    return `${value} ${units[i]}`;
}
function statLines(data) {
    const lines = [];
    // Job metadata first: Job ID / Job name / Playlist.
    if (data.jobId != null && !isNaN(data.jobId))
        lines.push(`Job ID: ${data.jobId}`);
    if (data.jobName != null && data.jobName !== '')
        lines.push(`Job name: ${data.jobName}`);
    if (data.playlistName != null && data.playlistName !== '')
        lines.push(`Playlist: ${data.playlistName}`);
    // Then file metadata.
    if (data.filename != null && data.filename !== '')
        lines.push(`Filename: ${data.filename}`);
    if (data.rows != null && !isNaN(data.rows))
        lines.push(`Rows: ${Number(data.rows).toLocaleString('en-US')}`);
    const size = formatBytes(data.bytes);
    if (size != null)
        lines.push(`Size: ${size}`);
    return lines;
}
function expiryClause(data) {
    var _a;
    const days = (_a = data.expiryDays) !== null && _a !== void 0 ? _a : 7;
    const when = data.expiresAt != null && data.expiresAt !== '' ? ` (on ${data.expiresAt})` : '';
    return `Please note that this link will expire in ${days} days${when}.`;
}
/**
 * "Your RFM analysis results are ready for download" — sent by the
 * arbimon-legacy recording-export job when a Random Forest Model (RFM)
 * classification-job results export completes.
 *
 * Body order: greeting -> download (button/link) -> copyable URL -> stats
 * (Filename / Rows / Size) -> expiry + support -> signature.
 */
exports.arbimonExportAnalysisResultsRfm = {
    name: 'arbimon.exportAnalysisResultsRFM',
    brand: 'arbimon',
    subject: (data) => data.filename != null && data.filename !== ''
        ? `Export ready — ${data.projectName} — ${data.filename}`
        : `Export ready — ${data.projectName}`,
    text: (data) => {
        const stats = statLines(data);
        const statsBlock = stats.length ? `\n${stats.join('\n')}\n` : '';
        return (`Thanks so much for using Arbimon! Your export report for the project "${data.projectName}" is ready for download.\n\n` +
            `Download your export:\n${data.url}\n` +
            `${statsBlock}\n` +
            `${expiryClause(data)} If you have any questions about Arbimon, check out our support docs: https://help.arbimon.org/\n\n` +
            `- The Arbimon Team`);
    },
    html: (data) => {
        var _a;
        const projectName = (0, escape_js_1.escapeHtml)(data.projectName);
        const url = (0, escape_js_1.safeUrl)(data.url);
        const mode = (_a = data.mode) !== null && _a !== void 0 ? _a : 'button';
        const header = `              <p style="color:black;margin-top:0">Thanks so much for using Arbimon! Your export report for the project "${projectName}" is ready for download.</p>`;
        const download = mode === 'button'
            ? `              <button style="background:#ADFF2C;border:1px solid #ADFF2C;padding:6px 14px;;border-radius:9999px;cursor:pointer;margin: 10px 0">
                  <a style="text-decoration:none;color:#14130D;white-space:nowrap;text-align:center;vertical-align:middle;align-items:center;display:inline-flex;display: -webkit-inline-flex;" download target="_self" href="${url}">
                      Download
                      <img style="width: 14px; height: 14px; margin-left:8px" src="${DOWNLOAD_ICON}">
                  </a>
              </button>`
            : `              <p><img style="width: 14px; height: 14px; margin-left:8px" src="${DOWNLOAD_ICON}"><a style="margin-left: 1px" href="${url}">Download export</a></p>`;
        const plainLink = `              <p style="color:black;">Or copy and paste this link into your browser:<br>
                <a href="${url}" style="color:#1a73e8; word-break:break-all;">${url}</a></p>`;
        const stats = statLines(data).map(escape_js_1.escapeHtml);
        const statsHtml = stats.length
            ? `              <p style="color:black; margin:8px 0;">${stats.join('<br>')}</p>`
            : '';
        const expirySupport = `              <p style="color:black;">${(0, escape_js_1.escapeHtml)(expiryClause(data))} If you have any questions about Arbimon, check out our <a href="https://help.arbimon.org/">support docs</a>.</p>`;
        const footer = `              <p style="color:black;"><span> - The Arbimon Team </span></p>`;
        const body = `${header}
${download}
${plainLink}
${statsHtml}
${expirySupport}
${footer}`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon', footer: false });
    }
};
