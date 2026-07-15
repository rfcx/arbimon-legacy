import type { TemplateDefinition } from '../types.js';
export interface UserActivateAccountData {
    /** Recipient's full name for the greeting. */
    fullName: string;
    /** Account username being activated. */
    username: string;
    /** Public base URL, e.g. https://arbimon.org (no trailing slash). */
    host: string;
    /** Activation token appended to `${host}/activate/${hash}`. */
    hash: string;
}
/**
 * "Activate your account" — sent by arbimon-legacy on account registration.
 * Ported from arbimon-legacy `app/views/mail/activate-account.ejs`
 * (subject "RFCx Arbimon: Account activation", from support@rfcx.org).
 */
export declare const userActivateAccount: TemplateDefinition<UserActivateAccountData>;
