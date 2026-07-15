"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
function renderTemplate(template, data) {
    return {
        subject: template.subject(data),
        text: template.text(data),
        html: template.html(data)
    };
}
