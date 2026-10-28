import { fromPaise, type Paise } from '../money/index.ts';
import { glazaPayable } from './payable.ts';

/** What a line of Glaza's is. */
export type GlazaKind = 'food' | 'soft_drink' | 'alcohol';

/** A line of Glaza's month: what it was, how many, its unit cost and price, and whether RIVR comped it. */
export interface GlazaStatementLine {
  readonly kind: GlazaKind;
  readonly quantity: bigint;
  readonly unitCost: Paise;
  readonly unitPrice: Paise;
  readonly isComp: boolean;
}

/** A month's statement: the comps at cost by kind, the alcohol sold with its cost and margin, RIVR's half and the payable. */
export interface GlazaStatement {
  readonly foodComps: Paise;
  readonly softDrinkComps: Paise;
  readonly alcoholComps: Paise;
  readonly comps: Paise;
  readonly alcoholSales: Paise;
  readonly alcoholCost: Paise;
  readonly alcoholMargin: Paise;
  readonly rivrShare: Paise;
  readonly payable: Paise;
}

/**
 * A month of Glaza's lines as its statement (#109; question #580; decision 0265): a comped line is owed at cost (its
 * quantity at its unit cost), by kind; an alcohol line sold is in the alcohol sales at its price and in their cost at
 * its cost; food and soft drinks sold are Glaza's alone. Then glazaPayable on the comps and the alcohol margin. The
 * database's private.glaza_statement_of is proved equal on packages/testing/golden/glaza.json.
 */
export function glazaStatement(lines: readonly GlazaStatementLine[]): GlazaStatement {
  if (lines.some((line) => line.quantity < 1n || line.unitCost < 0n || line.unitPrice < 0n)) {
    throw new RangeError('Quantities are at least 1 and amounts never negative');
  }
  const total = (isCounted: (line: GlazaStatementLine) => boolean, unit: (line: GlazaStatementLine) => Paise) =>
    lines.filter(isCounted).reduce((sum, line) => sum + line.quantity * unit(line), 0n);
  const compsOf = (kind: GlazaKind) => total((line) => line.isComp && line.kind === kind, (line) => line.unitCost);
  const isAlcoholSold = (line: GlazaStatementLine) => !line.isComp && line.kind === 'alcohol';
  const [food, softDrink, alcohol] = [compsOf('food'), compsOf('soft_drink'), compsOf('alcohol')];
  const sales = total(isAlcoholSold, (line) => line.unitPrice);
  const cost = total(isAlcoholSold, (line) => line.unitCost);
  const { rivrShare, payable } = glazaPayable(fromPaise(food + softDrink + alcohol), fromPaise(sales - cost));
  return {
    foodComps: fromPaise(food), softDrinkComps: fromPaise(softDrink), alcoholComps: fromPaise(alcohol), comps: fromPaise(food + softDrink + alcohol),
    alcoholSales: fromPaise(sales), alcoholCost: fromPaise(cost), alcoholMargin: fromPaise(sales - cost), rivrShare, payable,
  };
}
