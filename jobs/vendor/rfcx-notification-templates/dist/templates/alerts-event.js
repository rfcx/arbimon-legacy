"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsEvent = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * Event-alert email to subscribed users when a classification is detected.
 * Ported from rfcx-api `noncore/views/email/event-alert.handlebars` +
 * `core/events/bl/notifications.js` (which rendered the subject in-app and
 * relied on provider-side Handlebars merge vars — now rendered here instead,
 * removing the dependence on provider merge features).
 */
exports.alertsEvent = {
    name: 'alerts.event',
    brand: 'rfcx',
    subject: (data) => `A ${data.classificationName} detected on ${data.streamName} at ${data.time}`,
    text: (data) => `Site: ${data.streamName}\n` +
        `What detected: ${data.classificationName}\n` +
        `Time: ${data.time} (Local time)`,
    html: (data) => {
        const streamName = (0, escape_js_1.escapeHtml)(data.streamName);
        const classificationName = (0, escape_js_1.escapeHtml)(data.classificationName);
        const time = (0, escape_js_1.escapeHtml)(data.time);
        const row = (label, value) => `                  <tr style="margin: 0; padding: 0;">
                    <td width="200" align="right" style="text-align: right; color: #323a45; margin: 0; padding: 7px 10px; font: 600 14px Arial, sans-serif;">
                      ${label}
                    </td>
                    <td width="450" align="left" style="text-align: left; color: #323a45; margin: 0; padding: 7px 10px; font: 400 14px Arial, sans-serif;">
                      ${value}
                    </td>
                  </tr>`;
        const body = `              <table width="100%" cellspacing="0" style="margin: 0 auto; padding: 0;">
                <tbody style="margin: 0; padding: 0;">
${row('Site:', streamName)}
${row('What detected:', classificationName)}
${row('Time:', `${time} (Local time)`)}
                </tbody>
              </table>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'rfcx' });
    }
};
