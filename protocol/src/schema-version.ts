/** Per-definition schema versioning for editor / export JSON migrations. */

export type DefinitionKind = 'plant' | 'insect' | 'bullet' | 'map' | 'mission';

/**
 * Current schema version stamped on definitions after migration.
 * Bump when adding a new migrator step; never reuse old numbers.
 */
export const DEFINITION_SCHEMA_VERSION = 1;

/** Missing / invalid schemaVersion is treated as legacy (pre-versioned) data. */
export function readSchemaVersion(raw: unknown): number {
  if (raw == null || typeof raw !== 'object') return 0;
  const value = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function stampSchemaVersion<T extends Record<string, unknown>>(
  definition: T,
  version: number = DEFINITION_SCHEMA_VERSION,
): T & { schemaVersion: number } {
  return { ...definition, schemaVersion: version };
}
