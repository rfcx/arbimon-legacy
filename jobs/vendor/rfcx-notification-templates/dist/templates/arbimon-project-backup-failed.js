"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbimonProjectBackupFailed = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * "Your project backup failed" — sent by the arbimon CLI when a
 * user-requested project backup errors out.
 * Ported from arbimon CLI `_services/mail/templates.ts` (`project-backup-failed`).
 */
exports.arbimonProjectBackupFailed = {
    name: 'arbimon.projectBackupFailed',
    brand: 'arbimon',
    subject: () => 'Arbimon project backup failed',
    text: (data) => `Hello,\n\n` +
        `There was an issue with your project backup of '${data.projectName}'. ` +
        `Our engineering team is looking into this and will update you when we have resolved it. ` +
        `We apologize for the inconvenience and thank you for your patience!\n\n` +
        `All the best,\nArbimon team`,
    html: (data) => {
        const projectName = (0, escape_js_1.escapeHtml)(data.projectName);
        const body = `              <p style="color:black;margin-top:0">Hello,</p>
              <p style="color:black;">
                There was an issue with your project backup of '${projectName}'. Our engineering team is looking into this and will update you when we have resolved it. We apologize for the inconvenience and thank you for your patience!
              </p>
              <p style="color:black;">
                All the best, <br>Arbimon team
              </p>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon' });
    }
};
