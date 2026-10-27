import { z } from 'zod';

/** What Glaza's menu holds (#123), as public.fnb_item_kind lists them. */
export const FNB_ITEM_KINDS = ['food', 'soft_drink', 'alcohol'] as const;
export type FnbItemKind = (typeof FNB_ITEM_KINDS)[number];

/** One line of an order as the app, the tablet or the console sends it: an item, 1 to 9 of it, and a short note. */
export const fnbLineSchema = z.object({
  item_id: z.uuid(),
  quantity: z.int().min(1).max(9),
  note: z.string().trim().max(120).optional(),
});
export type FnbLine = z.infer<typeof fnbLineSchema>;

/** An order: 1 to 20 lines. */
export const fnbOrderSchema = z.array(fnbLineSchema).min(1).max(20);

/** A menu item as staff who run F&B add or change it: its name, kind, place on the menu and whether it is on offer. */
export const fnbItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(FNB_ITEM_KINDS),
  isAvailable: z.boolean(),
  position: z.int().min(1).max(999),
});

/**
 * fnb.ordered's payload (#123): the KOT for the bar, naming no member, which the cage agent prints as the outbox
 * consumer bar_printer.
 */
export const fnbOrderedSchema = z.object({
  order_id: z.uuid(),
  kot_number: z.string(),
  table_name: z.string(),
  seat: z.int().min(1).max(10),
  items: z.array(z.object({ name: z.string(), quantity: z.int().min(1), note: z.string().nullable() })).min(1),
  ordered_at: z.string(),
  is_comp: z.boolean(),
});
export type FnbOrdered = z.infer<typeof fnbOrderedSchema>;
