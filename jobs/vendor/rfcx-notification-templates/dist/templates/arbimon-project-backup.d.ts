import type { TemplateDefinition } from '../types.js';
export interface ArbimonProjectBackupData {
    /** Signed download URL for the backup bundle (expires ~7 days). */
    url: string;
    /** Human-readable project name. */
    projectName: string;
}
/**
 * "Your project backup is ready" — sent by the arbimon CLI
 * (apps/cli/src/backup) when a user-requested project backup completes.
 * Ported from arbimon CLI `_services/mail/templates.ts` (`project-backup`).
 */
export declare const arbimonProjectBackup: TemplateDefinition<ArbimonProjectBackupData>;
