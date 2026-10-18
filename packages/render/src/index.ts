/**
 * @rivr/render: draws @rivr/ui components to PNG and PDF in headless Chromium, so TV slides,
 * social cards, receipts and the membership card use the same CSS as the apps. Node only.
 */
export { renderToPdf, renderToPng, type RenderRequest } from './render.ts';
export { templates, type TemplateName, type TemplateProps } from './templates/index.ts';
