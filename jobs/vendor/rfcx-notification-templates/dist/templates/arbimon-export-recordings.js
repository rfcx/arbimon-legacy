"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbimonExportRecordings = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
const DOWNLOAD_ICON = 'https://static.rfcx.org/arbimon/download-icon.png';
/**
 * "Your export report is ready" — sent by arbimon-legacy's recording-export
 * job. Ported from `jobs/arbimon-recording-export-job/index.js` `sendEmail()`
 * (subject "Arbimon export", from no-reply@arbimon.org).
 */
exports.arbimonExportRecordings = {
    name: 'arbimon.exportRecordings',
    brand: 'arbimon',
    subject: () => 'Arbimon export',
    text: (data) => {
        var _a;
        const expires = data.mode === 'attachment' ? '' : ' Please note that this link will expire in 7 days.';
        const download = data.mode === 'attachment'
            ? '\n\nThe report is attached to this email.'
            : `\n\nDownload your export: ${(_a = data.url) !== null && _a !== void 0 ? _a : ''}`;
        return (`Hello,\n\n` +
            `Thanks so much for using Arbimon! Your export report for the project "${data.projectName}" has been completed.` +
            `${expires}` +
            ` If you have any questions about Arbimon, check out our support docs: https://help.arbimon.org/` +
            `${download}\n\n` +
            `- The Arbimon Team`);
    },
    html: (data) => {
        const projectName = (0, escape_js_1.escapeHtml)(data.projectName);
        const url = (0, escape_js_1.safeUrl)(data.url);
        const expires = data.mode === 'attachment' ? '' : ' Please note that this link will expire in 7 days.';
        const textHeader = `              <p style="color:black;margin-top:0">Hello,</p>
              <p style="color:black;">Thanks so much for using Arbimon! Your export report for the project "${projectName}" has been completed.`;
        const textSupport = `${expires} If you have any questions about Arbimon, check out our <a href="https://help.arbimon.org/">support docs</a>.
              </p>`;
        const textFooter = `              <p style="color:black;">
                <span> - The Arbimon Team </span>
              </p>`;
        let download = '';
        if (data.mode === 'signed-url-button') {
            download = `
              <button style="background:#ADFF2C;border:1px solid #ADFF2C;padding:6px 14px;;border-radius:9999px;cursor:pointer;margin: 10px 0">
                  <a style="text-decoration:none;color:#14130D;white-space:nowrap;text-align:center;vertical-align:middle;align-items:center;display:inline-flex;display: -webkit-inline-flex;" download target="_self" href="${url}">
                      Download
                      <img style="width: 14px; height: 14px; margin-left:8px" src="${DOWNLOAD_ICON}">
                  </a>
              </button>`;
        }
        else if (data.mode === 'signed-url-link') {
            download = `
              <p><img style="width: 14px; height: 14px; margin-left:8px" src="${DOWNLOAD_ICON}"><a style="margin-left: 1px" href="${url}">Download export</a></p>`;
        }
        const body = `${textHeader}${textSupport}${download}\n${textFooter}`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon' });
    }
};
