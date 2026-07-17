import type { InsectClientAssets, InsectDefinition } from '../insect';
import { DEFINITION_SCHEMA_VERSION, readSchemaVersion, stampSchemaVersion } from '../schema-version';

type Loose = Record<string, unknown>;

/** v0 → v1: stamp version; preserve all authored client fields. */
function insectV0ToV1(raw: Loose): Loose {
  const next: Loose = { ...raw };
  if (next.client != null && typeof next.client === 'object' && !Array.isArray(next.client)) {
    next.client = { ...(next.client as InsectClientAssets) };
  }
  return stampSchemaVersion(next, 1);
}

const INSECT_STEPS: Array<(raw: Loose) => Loose> = [insectV0ToV1];

export function migrateInsectDefinition(raw: unknown): InsectDefinition {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid insect definition');
  }
  let current: Loose = { ...(raw as Loose) };
  let version = readSchemaVersion(current);
  while (version < DEFINITION_SCHEMA_VERSION) {
    const step = INSECT_STEPS[version];
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
  return current as unknown as InsectDefinition;
}
