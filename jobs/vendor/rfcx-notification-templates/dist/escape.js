"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.safeUrl = safeUrl;
/**
 * Minimal HTML escaping for interpolated values in email bodies.
 * Zero-dependency by design so this package can be consumed by any Node app
 * (CJS or ESM) without pulling a templating engine into the dependency tree.
 */
const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
function escapeHtml(value) {
    return String(value !== null && value !== void 0 ? value : '').replace(/[&<>"']/g, (ch) => { var _a; return (_a = HTML_ENTITIES[ch]) !== null && _a !== void 0 ? _a : ch; });
}
/**
 * Escape an absolute http(s) URL for safe use inside an href attribute.
 * Falls back to '#' for anything that is not a plain http(s) URL, which
 * prevents javascript: and data: injection from untrusted inputs.
 */
function safeUrl(value) {
    const raw = String(value !== null && value !== void 0 ? value : '').trim();
    if (/^https?:\/\//i.test(raw)) {
        return escapeHtml(raw);
    }
    return '#';
}
