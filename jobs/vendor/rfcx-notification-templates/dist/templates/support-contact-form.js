"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportContactForm = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * Contact-form notification to the internal support inbox (contact@rfcx.org).
 * Ported from rfcx-api `noncore/views/email/contact-form.handlebars`.
 */
exports.supportContactForm = {
    name: 'support.contactForm',
    brand: 'rfcx',
    subject: () => 'RFCx contact form submission',
    text: (data) => `New contact form submission.\n\n` +
        `${data.message}\n\n` +
        `Reply to: ${data.replyTo}`,
    html: (data) => {
        const message = (0, escape_js_1.escapeHtml)(data.message);
        const replyTo = (0, escape_js_1.escapeHtml)(data.replyTo);
        const body = `              <table width="100%" cellspacing="0" style="margin: 0 auto; padding: 0;">
                <tbody style="margin: 0; padding: 0;">
                  <tr style="margin: 0; padding: 0;">
                    <td align="left" style="text-align: justify; color: #323a45; margin: 0; padding: 10px 0; font: 400 14px Arial, sans-serif; border-top: 1px solid #eee;">
                      <pre style="color: #323a45; margin: 0; padding: 0; font: 400 14px Arial, sans-serif; line-height: 1.4; white-space: pre-wrap;">${message}</pre>
                    </td>
                  </tr>
                  <tr style="margin: 0; padding: 0;">
                    <td align="left" style="text-align: left; color: #323a45; margin: 0; padding: 7px 0; font: 400 14px Arial, sans-serif; border-top: 1px solid #eee;">
                      <b>Reply to:</b> ${replyTo}
                    </td>
                  </tr>
                </tbody>
              </table>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'rfcx' });
    }
};
