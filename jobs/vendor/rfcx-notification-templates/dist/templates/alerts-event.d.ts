import type { TemplateDefinition } from '../types.js';
export interface AlertsEventData {
    /** Stream / site display name where the detection happened. */
    streamName: string;
    /** Human-readable classification (species / sound) detected. */
    classificationName: string;
    /** Local time string of the detection. */
    time: string;
}
/**
 * Event-alert email to subscribed users when a classification is detected.
 * Ported from rfcx-api `noncore/views/email/event-alert.handlebars` +
 * `core/events/bl/notifications.js` (which rendered the subject in-app and
 * relied on provider-side Handlebars merge vars — now rendered here instead,
 * removing the dependence on provider merge features).
 */
export declare const alertsEvent: TemplateDefinition<AlertsEventData>;
