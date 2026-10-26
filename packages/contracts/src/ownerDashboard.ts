import { z } from 'zod';

// Paise and counts as the database's jsonb gives them: whole JSON numbers.
const whole = z.number().int();

/** What the owner dashboard shows at once, as private.owner_snapshot gives it (#101, decision 0192). */
export const ownerSnapshotSchema = z.object({
  rake_tonight_paise: whole,
  hands_tonight: whole,
  tables_open: whole,
  seated: whole,
  in_the_room: whole,
  cash: z.array(z.object({ name: z.string(), balance_paise: whole })),
  players_money_paise: whole,
  chips_out_paise: whole,
  alerts: z.array(z.object({ id: z.uuid(), kind: z.string(), raised_at: z.string() })),
  nights: z.array(z.object({ day: z.string(), rake_paise: whole })),
});

export type OwnerSnapshotJson = z.output<typeof ownerSnapshotSchema>;
