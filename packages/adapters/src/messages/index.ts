// Outbox consumers that turn events into messages. Kept off the main entry: they format with
// @rivr/i18n, which only the functions that send them map (#283).
export { createWhatsAppConsumer, WHATSAPP_EVENT_TYPES, type FindRecipient, type MessageRecipient } from './consumer.ts';
