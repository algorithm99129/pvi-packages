import type { MissionDefinition } from '../mission';
import { DEFINITION_SCHEMA_VERSION, readSchemaVersion, stampSchemaVersion } from '../schema-version';

type Loose = Record<string, unknown>;

/** v0 → v1: stamp version; keep authored waves / rules / rewards. */
function missionV0ToV1(raw: Loose): Loose {
  return stampSchemaVersion({ ...raw }, 1);
}

const MISSION_STEPS: Array<(raw: Loose) => Loose> = [missionV0ToV1];

export function migrateMissionDefinition(raw: unknown): MissionDefinition {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid mission definition');
  }
  let current: Loose = { ...(raw as Loose) };
  let version = readSchemaVersion(current);
  while (version < DEFINITION_SCHEMA_VERSION) {
    const step = MISSION_STEPS[version];
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
  return current as unknown as MissionDefinition;
}
