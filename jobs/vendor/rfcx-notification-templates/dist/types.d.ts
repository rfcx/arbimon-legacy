import type { Brand } from './layout.js';
/**
 * The rendered output of a template: everything a transport (notify gateway,
 * Mandrill, etc.) needs to build a message, minus recipient/from routing.
 */
export interface RenderedEmail {
    subject: string;
    text: string;
    html: string;
}
/**
 * A template is a pure function set: given typed data, produce subject/text/html.
 * Templates never perform IO and never know about transports.
 */
export interface TemplateDefinition<TData> {
    name: string;
    brand: Brand;
    subject: (data: TData) => string;
    text: (data: TData) => string;
    html: (data: TData) => string;
}
export declare function renderTemplate<TData>(template: TemplateDefinition<TData>, data: TData): RenderedEmail;
