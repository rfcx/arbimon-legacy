"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResetPassword = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
/**
 * "Reset your password" — sent by arbimon-legacy on a password-reset request.
 * Ported from arbimon-legacy `app/views/mail/reset-password.ejs`
 * (subject "RFCx Arbimon: Password reset", from support@rfcx.org).
 */
exports.userResetPassword = {
    name: 'user.resetPassword',
    brand: 'arbimon',
    subject: () => 'RFCx Arbimon: Password reset',
    text: (data) => {
        const link = `${data.host}/reset_password/${data.hash}`;
        return (`Hello ${data.fullName},\n\n` +
            `your username is ${data.username}\n\n` +
            `Follow this link to reset your password:\n${link}`);
    },
    html: (data) => {
        const fullName = (0, escape_js_1.escapeHtml)(data.fullName);
        const username = (0, escape_js_1.escapeHtml)(data.username);
        const link = (0, escape_js_1.safeUrl)(`${data.host}/reset_password/${data.hash}`);
        const body = `              <p style="color:#000;">Hello <b>${fullName}</b>,</p>
              <p style="color:#000;">your username is <b>${username}</b></p>
              <p style="color:#000;">Follow this link to reset your password: <a href="${link}">Reset Password Here</a></p>`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'arbimon' });
    }
};
