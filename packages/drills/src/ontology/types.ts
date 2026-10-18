/**
 * The ontology, as TypeScript: one import surface over the files that hold it.
 *
 * `poker-ontology-v1.schema.json` beside these files is authoritative; this is a
 * hand-written mirror, reconciled with it by `types.conformance.test.ts`.
 */
export * from './vocabulary.ts';
export * from './rules.ts';
export * from './payload.ts';
export * from './labels.ts';
export * from './schemaEnums.ts';
