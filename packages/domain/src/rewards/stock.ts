/** Under this many left, the console says Low (decision 0543). */
export const LOW_STOCK = 5;

/** How a reward's stock stands: none left, few left, or enough (or no limit). */
export type StockLevel = 'sold_out' | 'low' | 'enough';

/** A reward's stock level; `null` stock is no limit (F-072). */
export function stockLevel(stock: number | null): StockLevel {
  if (stock === 0) return 'sold_out';
  return stock !== null && stock < LOW_STOCK ? 'low' : 'enough';
}

/** The same rewards in the same order, those with none left at the end (F-072, F-187). */
export function soldOutLast<Item extends { readonly stock: number | null }>(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => Number(a.stock === 0) - Number(b.stock === 0));
}
