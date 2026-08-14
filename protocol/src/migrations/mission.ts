import type { MissionDefinition, MissionSpawn, MissionWave } from '../mission';
import { DEFINITION_SCHEMA_VERSION, readSchemaVersion, stampSchemaVersion } from '../schema-version';

type Loose = Record<string, unknown>;

/** v0 → v1: stamp version; keep authored waves / rules / rewards. */
function missionV0ToV1(raw: Loose): Loose {
  return stampSchemaVersion({ ...raw }, 1);
}

type LooseSpawn = Record<string, unknown>;
type LooseWave = {
  delayMs?: unknown;
  spawns?: unknown;
  label?: unknown;
  isHuge?: unknown;
};

function asFiniteInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function cloneSpawn(spawn: LooseSpawn, extraOffsetMs: number): MissionSpawn {
  const prior = asFiniteInt(spawn.offsetMs, 0);
  const next: MissionSpawn = {
    insectId: String(spawn.insectId ?? ''),
    lane: asFiniteInt(spawn.lane, 0),
  };
  if (spawn.level != null) next.level = asFiniteInt(spawn.level, 1);
  if (spawn.count != null) next.count = Math.max(1, asFiniteInt(spawn.count, 1));
  if (spawn.staggerMs != null) next.staggerMs = asFiniteInt(spawn.staggerMs, 0);
  const offsetMs = prior + extraOffsetMs;
  if (offsetMs > 0) next.offsetMs = offsetMs;
  return next;
}

/**
 * Merge consecutive non-huge wave entries into one Wave.
 * Huge entries stay as their own Waves. Spawn times become offsetMs from the merged wave start.
 */
export function mergeMissionWaves(waves: unknown): MissionWave[] {
  if (!Array.isArray(waves) || waves.length === 0) return [];

  const sorted = waves
    .filter((w): w is LooseWave => w != null && typeof w === 'object')
    .map((w) => ({
      delayMs: asFiniteInt(w.delayMs, 0),
      isHuge: Boolean(w.isHuge),
      label: typeof w.label === 'string' && w.label.trim() ? w.label : undefined,
      spawns: Array.isArray(w.spawns) ? (w.spawns as LooseSpawn[]) : [],
    }))
    .sort((a, b) => a.delayMs - b.delayMs);

  const merged: MissionWave[] = [];
  let pending: MissionWave | null = null;

  const flushPending = () => {
    if (pending) {
      merged.push(pending);
      pending = null;
    }
  };

  for (const entry of sorted) {
    if (entry.isHuge) {
      flushPending();
      const wave: MissionWave = {
        delayMs: entry.delayMs,
        isHuge: true,
        spawns: entry.spawns.map((s) => cloneSpawn(s, 0)),
      };
      if (entry.label) wave.label = entry.label;
      merged.push(wave);
      continue;
    }

    if (!pending) {
      pending = {
        delayMs: entry.delayMs,
        spawns: entry.spawns.map((s) => cloneSpawn(s, 0)),
      };
      if (entry.label) pending.label = entry.label;
      continue;
    }

    const extraOffset = Math.max(0, entry.delayMs - pending.delayMs);
    for (const spawn of entry.spawns) {
      pending.spawns.push(cloneSpawn(spawn, extraOffset));
    }
    // Keep the first label; ignore later labels in a merged normal segment.
  }

  flushPending();
  return merged;
}

/** v1 → v2: true Waves — merge consecutive normals; appearances use offsetMs. */
function missionV1ToV2(raw: Loose): Loose {
  const waves = mergeMissionWaves(raw.waves);
  return stampSchemaVersion({ ...raw, waves }, 2);
}

const MISSION_STEPS: Array<(raw: Loose) => Loose> = [missionV0ToV1, missionV1ToV2];

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
