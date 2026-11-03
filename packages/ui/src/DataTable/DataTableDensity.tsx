import { createContext, useContext, type ReactNode } from 'react';

/** How tall a table's rows are from 1180 px: comfortable, 42 px, or compact, 34 px. */
export type TableDensity = 'comfortable' | 'compact';

const DensityContext = createContext<TableDensity>('comfortable');

/**
 * The staff member's own density for every table inside (console v3, decision 0442): the console's frame holds it, read
 * from their setting. A table's own `density` still wins.
 */
export function DataTableDensityProvider({ density, children }: { density: TableDensity; children: ReactNode }) {
  return <DensityContext.Provider value={density}>{children}</DensityContext.Provider>;
}

/** The density the tables here take unless they set their own. */
export function useTableDensity(): TableDensity {
  return useContext(DensityContext);
}
