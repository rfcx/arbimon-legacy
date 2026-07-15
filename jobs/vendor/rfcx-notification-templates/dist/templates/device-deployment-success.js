"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceDeploymentSuccess = void 0;
const escape_js_1 = require("../escape.js");
const layout_js_1 = require("../layout.js");
const UPLOADER_TYPES = new Set(['AudioMoth', 'Song Meter']);
function nextStepsHtml(deviceType) {
    const safeType = (0, escape_js_1.escapeHtml)(deviceType);
    return `              <h3 style="color: #000;"> Next steps…</h3>
              <p style="color: #000;">1. When you are done recording with the ${safeType}, switch it to the OFF position and remove the SD card.</p>
              <p style="color: #000;">2. Upload the files using the Arbimon Uploader by download the <a href='https://rf.cx/ingest-app-latest-win'> Arbimon Uploader for Windows </a> or the <a href='https://rf.cx/ingest-app-latest-mac'>Arbimon Uploader for Mac</a> here.</p>
              <p style="color: #000;">3. Open <a href='https://arbimon.rfcx.org/'> Arbimon</a> to analyse an unlimited amount of audio from your ${safeType} device.</p>`;
}
exports.deviceDeploymentSuccess = {
    name: 'device.deploymentSuccess',
    brand: 'rfcx',
    subject: (data) => `Your ${data.deviceType} device was deployed successfully`,
    text: (data) => `Your ${data.deviceType} device was successfully deployed on ${data.date} at ${data.time} UTC.`,
    html: (data) => {
        const safeType = (0, escape_js_1.escapeHtml)(data.deviceType);
        const safeDate = (0, escape_js_1.escapeHtml)(data.date);
        const safeTime = (0, escape_js_1.escapeHtml)(data.time);
        const nextSteps = UPLOADER_TYPES.has(data.deviceType) ? `\n${nextStepsHtml(data.deviceType)}` : '';
        const body = `              <h1 style="color: #000;">${safeType} deployment complete!</h1>
              <p style="color: #000;">Your ${safeType} device was successfully deployed on ${safeDate} at ${safeTime} UTC.</p>${nextSteps}`;
        return (0, layout_js_1.renderLayout)({ bodyHtml: body, brand: 'rfcx' });
    }
};
