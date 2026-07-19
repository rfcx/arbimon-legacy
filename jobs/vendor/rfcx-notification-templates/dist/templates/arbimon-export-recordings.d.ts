import type { TemplateDefinition } from '../types.js';
/**
 * Delivery variant for the recordings/report export email:
 *  - 'signed-url-button': download rendered as a button (was the Gmail path).
 *  - 'signed-url-link':   download rendered as a plain inline link.
 *  - 'attachment':        no in-body link; the report is attached by the
 *                         transport (the caller adds the attachment to the
 *                         notify-gateway payload — this package never does IO).
 *
 * Historically arbimon-legacy chose the button vs link path by sniffing the
 * recipient's address for '@gmail.com'. That routing decision stays in the
 * caller; the template just renders whichever variant it is told to.
 */
export type ArbimonExportDeliveryMode = 'signed-url-button' | 'signed-url-link' | 'attachment';
export interface ArbimonExportRecordingsData {
    /** Project name shown in the body. */
    projectName: string;
    /** How the export is delivered (see ArbimonExportDeliveryMode). */
    mode: ArbimonExportDeliveryMode;
    /** Signed download URL. Required for the two 'signed-url-*' modes; ignored for 'attachment'. */
    url?: string;
}
/**
 * "Your export report is ready" — sent by arbimon-legacy's recording-export
 * job. Ported from `jobs/arbimon-recording-export-job/index.js` `sendEmail()`
 * (subject "Arbimon export", from no-reply@arbimon.org).
 */
export declare const arbimonExportRecordings: TemplateDefinition<ArbimonExportRecordingsData>;
