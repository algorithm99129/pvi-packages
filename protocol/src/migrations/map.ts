import type { MapTemplateDefinition } from '../map';
import { DEFINITION_SCHEMA_VERSION, readSchemaVersion, stampSchemaVersion } from '../schema-version';

type Loose = Record<string, unknown>;

/** v0 → v1: stamp version; keep authored grid / lanes / client art. */
function mapV0ToV1(raw: Loose): Loose {
  return stampSchemaVersion({ ...raw }, 1);
}

const MAP_STEPS: Array<(raw: Loose) => Loose> = [mapV0ToV1];

export function migrateMapDefinition(raw: unknown): MapTemplateDefinition {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid map definition');
  }
  let current: Loose = { ...(raw as Loose) };
  let version = readSchemaVersion(current);
  while (version < DEFINITION_SCHEMA_VERSION) {
    const step = MAP_STEPS[version];
    if (!step) {
      current = stampSchemaVersion(current, DEFINITION_SCHEMA_VERSION);
      break;
    }
    current = step(current);
    const nextVersion = readSchemaVersion(current);
    if (nextVersion <= version) {
      current = stampSchemaVersion(current, version + 1);
    }
    version = readSchemaVersion(current);
  }
  return current as unknown as MapTemplateDefinition;
}
