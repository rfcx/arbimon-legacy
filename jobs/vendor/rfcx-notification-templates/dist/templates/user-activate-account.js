"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userActivateAccount = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * "Activate your account" — sent by arbimon-legacy on account registration.
 * Ported from arbimon-legacy `app/views/mail/activate-account.ejs`
 * (subject "RFCx Arbimon: Account activation", from support@rfcx.org).
 */
exports.userActivateAccount = {
    name: 'user.activateAccount',
    brand: 'arbimon',
    subject: () => 'RFCx Arbimon: Account activation',
    text: (data) => {
        const link = `${data.host}/activate/${data.hash}`;
        return (`Hello ${data.fullName},\n\n` +
            `Your Arbimon account for ${data.username} is almost ready to use!\n\n` +
            `Follow this link to activate your account:\n\n` +
            `${link}`);
    },
    html: (data) => {
        const fullName = (0, escape_js_1.escapeHtml)(data.fullName);
        const username = (0, escape_js_1.escapeHtml)(data.username);
        const link = (0, escape_js_1.safeUrl)(`${data.host}/activate/${data.hash}`);
        const body = `              <p style="color:#000;">Hello ${fullName},</p>
              <p style="color:#000;">Your Arbimon account for <b>${username}</b> is almost ready to use!</p>
              <p style="color:#000;">Follow this link to activate your account:</p>
              <p style="color:#000;"><a href="${link}">${link}</a></p>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon' });
    }
};
