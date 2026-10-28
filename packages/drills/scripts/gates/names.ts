/**
 * The eight drill gates' names, in the order they run: apart from the gates, so the command line and the gates
 * can both read them without importing each other.
 */
export const GATE_NAMES = ['sources', 'generator', 'winnable', 'overclaim', 'feedback', 'variety', 'lines', 'mece'] as const;
export type GateName = typeof GATE_NAMES[number];
