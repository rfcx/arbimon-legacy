import type { TemplateDefinition } from '../types.js';
export interface UserResetPasswordData {
    /** Recipient's full name for the greeting. */
    fullName: string;
    /** Account username reminder. */
    username: string;
    /** Public base URL, e.g. https://arbimon.org (no trailing slash). */
    host: string;
    /** Reset token appended to `${host}/reset_password/${hash}`. */
    hash: string;
}
/**
 * "Reset your password" — sent by arbimon-legacy on a password-reset request.
 * Ported from arbimon-legacy `app/views/mail/reset-password.ejs`
 * (subject "RFCx Arbimon: Password reset", from support@rfcx.org).
 */
export declare const userResetPassword: TemplateDefinition<UserResetPasswordData>;
