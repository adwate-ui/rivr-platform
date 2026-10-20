/**
 * @rivr/render: draws @rivr/ui components to PNG, PDF and MP4 in headless Chromium, so TV slides,
 * social cards, receipts, the membership card and the logo animation use the same CSS as the apps. Node only.
 */
export { renderFrameToPng, renderToMp4, renderToPdf, renderToPng, type RenderRequest, type VideoTiming } from './render.ts';
export { templates, type TemplateName, type TemplateProps } from './templates/index.ts';
export { invoiceDocumentProps, renderInvoicePdf, type StoredInvoice } from './invoice.ts';
