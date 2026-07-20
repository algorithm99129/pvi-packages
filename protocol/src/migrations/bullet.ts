import type { BulletDefinition } from '../bullet';
import { normalizeBulletDefinition } from '../bullet';
import { DEFINITION_SCHEMA_VERSION, readSchemaVersion, stampSchemaVersion } from '../schema-version';

type Loose = Record<string, unknown>;

/**
 * v0 → v1: run additive bullet normalize (fills missing cellWidthFill/scale)
 * without dropping authored flying presentation.
 */
function bulletV0ToV1(raw: Loose): Loose {
  const normalized = normalizeBulletDefinition(raw);
  if (!normalized) {
    return stampSchemaVersion({ ...raw }, 1);
  }
  return stampSchemaVersion({ ...normalized } as unknown as Loose, 1);
}

const BULLET_STEPS: Array<(raw: Loose) => Loose> = [bulletV0ToV1];

export function migrateBulletDefinition(raw: unknown): BulletDefinition {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid bullet definition');
  }
  let current: Loose = { ...(raw as Loose) };
  let version = readSchemaVersion(current);
  while (version < DEFINITION_SCHEMA_VERSION) {
    const step = BULLET_STEPS[version];
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
  return current as unknown as BulletDefinition;
}
