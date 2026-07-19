"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbimonProjectBackup = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * "Your project backup is ready" — sent by the arbimon CLI
 * (apps/cli/src/backup) when a user-requested project backup completes.
 * Ported from arbimon CLI `_services/mail/templates.ts` (`project-backup`).
 */
exports.arbimonProjectBackup = {
    name: 'arbimon.projectBackup',
    brand: 'arbimon',
    subject: () => 'Arbimon project backup ready',
    text: (data) => `Hello,\n\n` +
        `Thanks so much for using Arbimon! Your backup of the project "${data.projectName}" ` +
        `has been completed and is now ready.\n\n` +
        `Download your file: ${data.url}\n\n` +
        `Please note that this link will expire in 7 days.\n\n` +
        `For more information and support, please visit our documentation: https://help.arbimon.org/\n\n` +
        `- The Arbimon Team`,
    html: (data) => {
        const projectName = (0, escape_js_1.escapeHtml)(data.projectName);
        const url = (0, escape_js_1.safeUrl)(data.url);
        const body = `              <p style="color:black;margin-top:0">Hello,</p>
              <p style="color:black;">
                Thanks so much for using Arbimon! Your backup of the project "${projectName}" has been completed and now ready.
              </p>
              <p style="color:black;">Please <a href="${url}">click here</a> to download your file.</p>
              <p style="color:black;">Please note that this link will expire in 7 days.</p>
              <p style="color:black;">
                For more information and support, please visit our documentation: <a href="https://help.arbimon.org/">https://help.arbimon.org/</a>
              </p>
              <p style="color:black;">
                <span> - The Arbimon Team </span>
              </p>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon' });
    }
};
