import type { tournamentTemplateSchema } from '@rivr/contracts/tournaments';
import type { TemplateOrder, TournamentTemplate } from '@rivr/db';
import { fromRupees, type Paise } from '@rivr/domain/money';
import { formatRupeesForInput } from '@rivr/i18n';
import type { z } from 'zod';

/** A template as the form holds it: every figure as typed. */
export type TemplateValues = z.input<typeof tournamentTemplateSchema>;
type TemplateOutput = z.output<typeof tournamentTemplateSchema>;

/** A new template's empty form, on the first structure if there is one. */
export function emptyTemplate(structureId: string): TemplateValues {
  return {
    name: '', format: 're_entry', buyIn: '', fee: '', startingStack: '', structureId, lastRegistrationLevel: '', maxBuys: '', addOn: '', addOnFee: '',
    addOnChips: '', placesPaid: '', guarantee: '',
  };
}

const typed = (paise: Paise | null) => (paise === null ? '' : formatRupeesForInput(paise));

/** The form's values for a template being changed. */
export function templateValues(template: TournamentTemplate): TemplateValues {
  return {
    name: template.name, format: template.format, buyIn: typed(template.buyIn), fee: typed(template.fee), startingStack: String(template.startingStack),
    structureId: template.structureId, lastRegistrationLevel: String(template.lastRegistrationLevel),
    maxBuys: template.maxBuys === null ? '' : String(template.maxBuys), addOn: typed(template.addOn?.price ?? null),
    addOnFee: typed(template.addOn?.fee ?? null), addOnChips: template.addOn === null ? '' : String(template.addOn.chips),
    placesPaid: String(template.placesPaid), guarantee: typed(template.guarantee),
  };
}

const rupees = (text: string) => fromRupees(BigInt(text));

/** The template as the database saves it, amounts in paise. */
export function templateOrder(values: TemplateOutput, templateId: string | null): TemplateOrder {
  return {
    templateId, name: values.name, format: values.format, buyIn: rupees(values.buyIn), fee: rupees(values.fee), startingStack: values.startingStack,
    structureId: values.structureId, lastRegistrationLevel: values.lastRegistrationLevel, maxBuys: values.maxBuys === '' ? null : Number(values.maxBuys),
    addOn: values.addOn === '' ? null : { price: rupees(values.addOn), fee: rupees(values.addOnFee), chips: Number(values.addOnChips) },
    placesPaid: values.placesPaid, guarantee: values.guarantee === '' ? null : rupees(values.guarantee),
  };
}
