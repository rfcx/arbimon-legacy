import type { TemplateDefinition } from '../types.js';
export interface ArbimonExportDetectionsData {
    /** Signed download URL for the exported detections (expires ~7 days). */
    url: string;
    /** Classifier (CNN) job id that was exported. */
    jobId: number;
}
/**
 * "Your CNN export is ready" — sent by the arbimon CLI
 * (apps/cli/src/export-cnn) when a classifier-job detection export completes.
 * Ported from arbimon CLI `_services/mail/templates.ts` (`export-detections`).
 */
export declare const arbimonExportDetections: TemplateDefinition<ArbimonExportDetectionsData>;
