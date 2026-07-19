import type { TemplateDefinition } from '../types.js';
export interface SupportUserFeedbackData {
    /** Name of the user who submitted feedback. */
    name: string;
    /** Email of the user who submitted feedback. */
    email: string;
    /** Submission date string. */
    date: string;
    /** The feedback text. */
    feedback: string;
    /** Optional attachment image URLs. */
    images?: string[];
}
/**
 * User-feedback notification to the internal support team.
 * Ported from device-api `src/common/email/user-feedback-email-template.html`.
 */
export declare const supportUserFeedback: TemplateDefinition<SupportUserFeedbackData>;
