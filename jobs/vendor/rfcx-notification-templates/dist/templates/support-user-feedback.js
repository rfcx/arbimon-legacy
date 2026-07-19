"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportUserFeedback = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * User-feedback notification to the internal support team.
 * Ported from device-api `src/common/email/user-feedback-email-template.html`.
 */
exports.supportUserFeedback = {
    name: 'support.userFeedback',
    brand: 'rfcx',
    subject: () => 'New RFCx Companion user feedback',
    text: (data) => {
        var _a;
        const images = (_a = data.images) !== null && _a !== void 0 ? _a : [];
        const attachments = images.length > 0
            ? `\n\nAttachments:\n${images.map((u, i) => `attachment_${i}: ${u}`).join('\n')}`
            : '';
        return (`Hi RFCx Support Team!\n\n` +
            `We have got a new feedback from ${data.name}(${data.email}) at ${data.date}.\n\n` +
            `"${data.feedback}"${attachments}\n\n` +
            `Regards,\nRFCx Companion Bot`);
    },
    html: (data) => {
        var _a;
        const name = (0, escape_js_1.escapeHtml)(data.name);
        const email = (0, escape_js_1.escapeHtml)(data.email);
        const date = (0, escape_js_1.escapeHtml)(data.date);
        const feedback = (0, escape_js_1.escapeHtml)(data.feedback);
        const images = (_a = data.images) !== null && _a !== void 0 ? _a : [];
        const attachments = images.length > 0
            ? `\n              <p style="color:black;">with attachments:</p>\n` +
                images
                    .map((u, i) => `              <p><a href="${(0, escape_js_1.safeUrl)(u)}">attachment_${i}</a></p>`)
                    .join('\n')
            : '';
        const body = `              <p style="color:black;">Hi RFCx Support Team!</p>
              <p style="color:black;">We have got a new feedback from ${name}(${email}) at ${date}.</p>
              <blockquote style="color: black">
                "${feedback}"
              </blockquote>${attachments}
              <p style="color:black;">Regards,</p>
              <p style="color:black;">RFCx Companion Bot</p>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'rfcx' });
    }
};
