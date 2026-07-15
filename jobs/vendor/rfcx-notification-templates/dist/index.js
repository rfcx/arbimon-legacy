"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateNames = exports.safeUrl = exports.escapeHtml = exports.DEFAULT_FROM = void 0;
exports.renderEmail = renderEmail;
const alerts_event_js_1 = require("./templates/alerts-event.js");
const arbimon_export_analysis_results_rfm_js_1 = require("./templates/arbimon-export-analysis-results-rfm.js");
const arbimon_export_detections_js_1 = require("./templates/arbimon-export-detections.js");
const arbimon_export_recordings_js_1 = require("./templates/arbimon-export-recordings.js");
const arbimon_project_backup_js_1 = require("./templates/arbimon-project-backup.js");
const arbimon_project_backup_failed_js_1 = require("./templates/arbimon-project-backup-failed.js");
const device_deployment_success_js_1 = require("./templates/device-deployment-success.js");
const support_contact_form_js_1 = require("./templates/support-contact-form.js");
const support_user_feedback_js_1 = require("./templates/support-user-feedback.js");
const user_activate_account_js_1 = require("./templates/user-activate-account.js");
const user_reset_password_js_1 = require("./templates/user-reset-password.js");
const types_js_1 = require("./types.js");
var layout_js_1 = require("./layout.js");
Object.defineProperty(exports, "DEFAULT_FROM", { enumerable: true, get: function () { return layout_js_1.DEFAULT_FROM; } });
var escape_js_1 = require("./escape.js");
Object.defineProperty(exports, "escapeHtml", { enumerable: true, get: function () { return escape_js_1.escapeHtml; } });
Object.defineProperty(exports, "safeUrl", { enumerable: true, get: function () { return escape_js_1.safeUrl; } });
/**
 * Registry of all known templates keyed by their stable dotted name.
 * Add new templates here as applications are migrated.
 */
const TEMPLATES = {
    'device.deploymentSuccess': device_deployment_success_js_1.deviceDeploymentSuccess,
    'arbimon.projectBackup': arbimon_project_backup_js_1.arbimonProjectBackup,
    'arbimon.projectBackupFailed': arbimon_project_backup_failed_js_1.arbimonProjectBackupFailed,
    'arbimon.exportDetections': arbimon_export_detections_js_1.arbimonExportDetections,
    'arbimon.exportRecordings': arbimon_export_recordings_js_1.arbimonExportRecordings,
    'arbimon.exportAnalysisResultsRFM': arbimon_export_analysis_results_rfm_js_1.arbimonExportAnalysisResultsRfm,
    'user.activateAccount': user_activate_account_js_1.userActivateAccount,
    'user.resetPassword': user_reset_password_js_1.userResetPassword,
    'support.contactForm': support_contact_form_js_1.supportContactForm,
    'support.userFeedback': support_user_feedback_js_1.supportUserFeedback,
    'alerts.event': alerts_event_js_1.alertsEvent
};
/**
 * Render a template by name to `{ subject, text, html }`.
 *
 * Transport-agnostic: callers wrap the result in whatever message envelope
 * their transport requires (notify gateway generic payload, Mandrill-lite, etc.).
 */
function renderEmail(templateName, data) {
    const template = TEMPLATES[templateName];
    return (0, types_js_1.renderTemplate)(template, data);
}
exports.templateNames = Object.keys(TEMPLATES);
