import type { AlertsEventData } from './templates/alerts-event.js';
import type { ArbimonExportAnalysisResultsRfmData } from './templates/arbimon-export-analysis-results-rfm.js';
import type { ArbimonExportDetectionsData } from './templates/arbimon-export-detections.js';
import type { ArbimonExportRecordingsData } from './templates/arbimon-export-recordings.js';
import type { ArbimonProjectBackupData } from './templates/arbimon-project-backup.js';
import type { ArbimonProjectBackupFailedData } from './templates/arbimon-project-backup-failed.js';
import type { DeviceDeploymentSuccessData } from './templates/device-deployment-success.js';
import type { SupportContactFormData } from './templates/support-contact-form.js';
import type { SupportUserFeedbackData } from './templates/support-user-feedback.js';
import type { UserActivateAccountData } from './templates/user-activate-account.js';
import type { UserResetPasswordData } from './templates/user-reset-password.js';
import type { RenderedEmail } from './types.js';
export type { RenderedEmail, TemplateDefinition } from './types.js';
export type { Brand } from './layout.js';
export { DEFAULT_FROM } from './layout.js';
export { escapeHtml, safeUrl } from './escape.js';
export type { DeviceDeploymentSuccessData, DeviceType } from './templates/device-deployment-success.js';
export type { AlertsEventData } from './templates/alerts-event.js';
export type { ArbimonExportDetectionsData } from './templates/arbimon-export-detections.js';
export type { ArbimonExportRecordingsData, ArbimonExportDeliveryMode } from './templates/arbimon-export-recordings.js';
export type { ArbimonExportAnalysisResultsRfmData, ArbimonDownloadMode } from './templates/arbimon-export-analysis-results-rfm.js';
export type { ArbimonProjectBackupData } from './templates/arbimon-project-backup.js';
export type { ArbimonProjectBackupFailedData } from './templates/arbimon-project-backup-failed.js';
export type { SupportContactFormData } from './templates/support-contact-form.js';
export type { SupportUserFeedbackData } from './templates/support-user-feedback.js';
export type { UserActivateAccountData } from './templates/user-activate-account.js';
export type { UserResetPasswordData } from './templates/user-reset-password.js';
/**
 * Maps each template name to its typed data shape so `renderEmail` is fully
 * type-checked at every call site.
 */
export interface TemplateDataMap {
    'device.deploymentSuccess': DeviceDeploymentSuccessData;
    'arbimon.projectBackup': ArbimonProjectBackupData;
    'arbimon.projectBackupFailed': ArbimonProjectBackupFailedData;
    'arbimon.exportDetections': ArbimonExportDetectionsData;
    'arbimon.exportRecordings': ArbimonExportRecordingsData;
    'arbimon.exportAnalysisResultsRFM': ArbimonExportAnalysisResultsRfmData;
    'user.activateAccount': UserActivateAccountData;
    'user.resetPassword': UserResetPasswordData;
    'support.contactForm': SupportContactFormData;
    'support.userFeedback': SupportUserFeedbackData;
    'alerts.event': AlertsEventData;
}
export type TemplateName = keyof TemplateDataMap;
/**
 * Render a template by name to `{ subject, text, html }`.
 *
 * Transport-agnostic: callers wrap the result in whatever message envelope
 * their transport requires (notify gateway generic payload, Mandrill-lite, etc.).
 */
export declare function renderEmail<TName extends TemplateName>(templateName: TName, data: TemplateDataMap[TName]): RenderedEmail;
export declare const templateNames: TemplateName[];
