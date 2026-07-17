import type { PlantBulletShot, PlantClientAssets, PlantDefinition } from '../plant';
import { createBulletShot } from '../plant';
import { DEFINITION_SCHEMA_VERSION, readSchemaVersion, stampSchemaVersion } from '../schema-version';

type Loose = Record<string, unknown>;

/**
 * v0 → v1: preserve authored client fields; only synthesize missing bulletShots
 * from legacy bulletSpawn. Never invent or strip stateGraph.
 */
function plantV0ToV1(raw: Loose): Loose {
  const next: Loose = { ...raw };
  const clientRaw = next.client;
  if (clientRaw != null && typeof clientRaw === 'object' && !Array.isArray(clientRaw)) {
    const client = { ...(clientRaw as PlantClientAssets) };
    const shots = client.bulletShots;
    if ((!shots || shots.length === 0) && client.bulletSpawn) {
      const migrated: PlantBulletShot = createBulletShot({
        id: 'legacy_spawn',
        spawn: { ...client.bulletSpawn },
        directionDeg: 0,
        trajectory: 'linear',
        delayMs: 0,
      });
      client.bulletShots = [migrated];
    } else if (shots && shots.length > 0) {
      // Re-normalize each shot while preserving laneOffset / curved / delays.
      client.bulletShots = shots.map((s) => createBulletShot(s, () => s.id));
    }
    next.client = client;
  }
  return stampSchemaVersion(next, 1);
}

/** Index = fromVersion. PLANT_STEPS[0] migrates schemaVersion 0 → 1. */
const PLANT_STEPS: Array<(raw: Loose) => Loose> = [plantV0ToV1];

/** Migrate a plant definition up to DEFINITION_SCHEMA_VERSION (idempotent). */
export function migratePlantDefinition(raw: unknown): PlantDefinition {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid plant definition');
  }
  let current: Loose = { ...(raw as Loose) };
  let version = readSchemaVersion(current);
  while (version < DEFINITION_SCHEMA_VERSION) {
    const step = PLANT_STEPS[version];
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
  return current as unknown as PlantDefinition;
}
