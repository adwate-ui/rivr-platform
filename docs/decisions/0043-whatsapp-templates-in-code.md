# 0043 WhatsApp templates are kept in code, beside the consumer that sends them

Date: 19 Oct 2026. Task #62.

Issue #62 named a `message_template` table. Nothing edits templates: each must match, word for word, a template Meta has approved in the business account, and only a new release could send a new one. A table would hold a copy that could drift from the code that fills its parameters.

So the templates are `WHATSAPP_TEMPLATES` in `@rivr/adapters/whatsapp`: name, category and the body as submitted to Meta, and whether its button takes a link suffix (a payment link or a receipt). The consumer fills each one from its event, and the message type requires a marketing opt-in time for a marketing template. English only (decision 0027).

Revisit when marketing wants to add templates without a release: then a table, with the console showing Meta's approval status.
