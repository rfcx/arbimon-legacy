/**
 * Shared, brand-consistent email layout (header + body + footer).
 *
 * This is intentionally a single reusable shell so every application renders
 * the same header banner, container styling and RFCx footer. Individual
 * templates only produce the inner body markup and hand it to `renderLayout`.
 */
export type Brand = 'rfcx' | 'arbimon';
export interface LayoutOptions {
    /** Inner HTML for the message body (already escaped by the template). */
    bodyHtml: string;
    /** Brand controls header/footer wording and default from address. */
    brand?: Brand;
    /** Render the shared RFCx footer (501c3 / social / address). Default true. */
    footer?: boolean;
    /** Render the shared RFCx header banner image. Default true. */
    header?: boolean;
}
export declare function renderLayout(options: LayoutOptions): string;
export declare const DEFAULT_FROM: Record<Brand, {
    email: string;
    name: string;
}>;
