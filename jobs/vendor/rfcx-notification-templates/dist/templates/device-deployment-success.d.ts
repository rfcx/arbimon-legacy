import type { TemplateDefinition } from '../types.js';
/**
 * Human-friendly device type label used in copy.
 * Mirrors the mapping previously hard-coded in device-api.
 */
export type DeviceType = 'Guardian' | 'Song Meter' | 'AudioMoth' | 'recording';
export interface DeviceDeploymentSuccessData {
    /** Display label for the device type. */
    deviceType: DeviceType | string;
    /** Localised date string, e.g. "5/16/2025". */
    date: string;
    /** Localised time string, e.g. "3:24:00 PM". */
    time: string;
}
export declare const deviceDeploymentSuccess: TemplateDefinition<DeviceDeploymentSuccessData>;
