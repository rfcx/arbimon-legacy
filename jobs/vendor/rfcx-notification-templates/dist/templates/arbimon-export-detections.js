"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbimonExportDetections = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
const DOWNLOAD_ICON = 'https://static.rfcx.org/arbimon/download-icon.png';
/**
 * "Your CNN export is ready" — sent by the arbimon CLI
 * (apps/cli/src/export-cnn) when a classifier-job detection export completes.
 * Ported from arbimon CLI `_services/mail/templates.ts` (`export-detections`).
 */
exports.arbimonExportDetections = {
    name: 'arbimon.exportDetections',
    brand: 'arbimon',
    subject: () => 'Arbimon CNN export detections ready',
    text: (data) => `Hello,\n\n` +
        `Thanks so much for using Arbimon! Your classifier job export id ${data.jobId} has been completed. ` +
        `Please note that this link will expire in 7 days.\n\n` +
        `Download your export: ${data.url}\n\n` +
        `If you have any questions about Arbimon, check out our support docs: https://help.arbimon.org/\n\n` +
        `- The Arbimon Team`,
    html: (data) => {
        const jobId = (0, escape_js_1.escapeHtml)(data.jobId);
        const url = (0, escape_js_1.safeUrl)(data.url);
        const body = `              <p style="color:black;margin-top:0">Hello,</p>
              <p style="color:black;">
                Thanks so much for using Arbimon! Your classifier job export id ${jobId} has been completed.
                Please note that this link will expire in 7 days.
                If you have any questions about Arbimon, check out our <a href="https://help.arbimon.org/">support docs</a>.
              </p>
              <button style="background:#ADFF2C;border:1px solid #ADFF2C;padding:6px 14px;;border-radius:9999px;cursor:pointer;margin: 10px 0">
                  <a style="text-decoration:none;color:#14130D;white-space:nowrap;text-align:center;vertical-align:middle;align-items:center;display:inline-flex;display: -webkit-inline-flex;" href="${url}">
                      Download
                      <img style="width: 14px; height: 14px; margin-left:8px" src="${DOWNLOAD_ICON}">
                  </a>
              </button>
              <p style="color:black;">
                <span> - The Arbimon Team </span>
              </p>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon' });
    }
};
