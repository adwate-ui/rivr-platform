/**
 * The WhatsApp templates RIVR sends, as they must be approved in Meta's dashboard (decision 0043).
 * The body is the text submitted for approval, with Meta's numbered parameters; `urlButton` marks a
 * template whose button opens the template's base address plus a suffix given at send time, as a
 * payment link or a receipt does. English only (decision 0027).
 */
export const WHATSAPP_TEMPLATES = {
  seat_ready: {
    category: 'utility',
    body: 'Your seat is ready. {{1}}, seat {{2}}. Hold expires {{3}}.',
    urlButton: false,
  },
  receipt_ready: {
    category: 'utility',
    body: 'Your RIVR receipt for {{1}} is ready.',
    urlButton: true,
  },
  payment_link: {
    category: 'utility',
    body: 'Pay {{1}} for {{2}} with the link below.',
    urlButton: true,
  },
  promotion: {
    category: 'marketing',
    body: '{{1}} Reply STOP to stop these messages.',
    urlButton: false,
  },
} as const;

/** The name of a template RIVR sends. */
export type WhatsAppTemplateName = keyof typeof WHATSAPP_TEMPLATES;
