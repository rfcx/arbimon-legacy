import type { TemplateDefinition } from '../types.js';
export interface SupportContactFormData {
    /** The submitted message body (plain text; rendered preformatted). */
    message: string;
    /** Reply-to address supplied by the submitter. */
    replyTo: string;
}
/**
 * Contact-form notification to the internal support inbox (contact@rfcx.org).
 * Ported from rfcx-api `noncore/views/email/contact-form.handlebars`.
 */
export declare const supportContactForm: TemplateDefinition<SupportContactFormData>;
