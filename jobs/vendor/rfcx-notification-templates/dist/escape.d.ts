export declare function escapeHtml(value: unknown): string;
/**
 * Escape an absolute http(s) URL for safe use inside an href attribute.
 * Falls back to '#' for anything that is not a plain http(s) URL, which
 * prevents javascript: and data: injection from untrusted inputs.
 */
export declare function safeUrl(value: unknown): string;
