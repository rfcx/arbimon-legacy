import type { TemplateDefinition } from '../types.js';
export interface ArbimonProjectBackupFailedData {
    /** Human-readable project name. */
    projectName: string;
}
/**
 * "Your project backup failed" — sent by the arbimon CLI when a
 * user-requested project backup errors out.
 * Ported from arbimon CLI `_services/mail/templates.ts` (`project-backup-failed`).
 */
export declare const arbimonProjectBackupFailed: TemplateDefinition<ArbimonProjectBackupFailedData>;
