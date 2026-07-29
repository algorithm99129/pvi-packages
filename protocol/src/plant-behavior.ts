import type { PlantClientAssets, PlantRole } from './plant';
import type { EntityStateGraph, StateActionKind } from './entity-state-graph';

/** Data-driven plant combat behavior — prefer status-graph actions for gameplay. */
export type PlantBehaviorKind =
  | 'shooter'
  | 'producer'
  | 'blocker'
  | 'instant_explode'
  | 'armed_trap'
  | 'melee_trap'
  | 'chomper'
  | 'disruptor';

export interface PlantBehaviorConfig {
  kind: PlantBehaviorKind;
  /** Seconds after placement before an armed trap can trigger (Potato Mine). */
  prepareSeconds?: number;
  /** Delay before instant explosives detonate (Cherry Bomb). */
  detonateDelaySeconds?: number;
  /** Column distance for contact / melee trigger. */
  triggerColumnRange?: number;
  /** Lane radius for area damage (0 = same lane only). */
  triggerLaneRange?: number;
  /** Remove the plant after it triggers. */
  removeOnTrigger?: boolean;
  /** Play aim clip before attack (Squash). */
  aimBeforeAttack?: boolean;
  /**
   * Explode VFX style fallback when the graph action omits `vfxStyle`.
   * Use {@link ExplodeVfxStyle} ids: boom | fire | lane_fire | ice
   * (legacy Boom / JalapenoExplode / IceShroomSnow still accepted).
   */
  explodeGfx?: string;
  /** Chomper: seconds spent in digest before returning to idle. */
  digestSeconds?: number;
  /** Sunflower family: seconds between produce pulses. */
  produceIntervalSeconds?: number;
  /** Scaredy-shroom: column distance that triggers hide (closer than attack range). */
  hideProximityColumns?: number;
}

const INSTANT_EXPLODE_IDS = new Set(['cherry_bomb', 'jalapeno', 'ice_shroom']);
const PRODUCER_IDS = new Set(['sun_flower', 'sun_shroom', 'twin_sunflower']);

export const DEFAULT_PLANT_BEHAVIOR: PlantBehaviorConfig = { kind: 'shooter' };

/** True when the plant fires projectile bullets (not melee / traps / explosives). */
export function plantShootsBullets(input: {
  id: string;
  role: PlantRole;
  client: PlantClientAssets;
  behavior?: PlantBehaviorConfig;
}): boolean {
  return resolvePlantBehavior(input).kind === 'shooter';
}

/** True when any status-graph node runs the given engine action. */
export function graphHasAction(
  graph: EntityStateGraph | null | undefined,
  type: StateActionKind,
): boolean {
  if (!graph?.nodes?.length) return false;
  for (const node of graph.nodes) {
    const actions = node?.actions;
    if (!actions?.length) continue;
    for (const action of actions) {
      if (action?.type === type) return true;
    }
  }
  return false;
}

/** True when the plant clears fog via status-graph `clear_fog` (Plantern). */
export function plantClearsFog(input: {
  id: string;
  client?: PlantClientAssets | null;
}): boolean {
  if (graphHasAction(input.client?.stateGraph, 'clear_fog')) return true;
  return input.id.trim().toLowerCase() === 'plantern';
}

/** Merge explicit JSON behavior with conventions from role, id, and animation clips. */
export function resolvePlantBehavior(input: {
  id: string;
  role: PlantRole;
  client: PlantClientAssets;
  behavior?: PlantBehaviorConfig;
}): PlantBehaviorConfig {
  if (input.behavior?.kind) {
    return { ...inferPlantBehavior(input), ...input.behavior };
  }

  return inferPlantBehavior(input);
}

function inferPlantBehavior(input: {
  id: string;
  role: PlantRole;
  client: PlantClientAssets;
}): PlantBehaviorConfig {
  const { id, role, client } = input;

  if (INSTANT_EXPLODE_IDS.has(id)) {
    return {
      kind: 'instant_explode',
      detonateDelaySeconds: id === 'cherry_bomb' ? 0.65 : 0.5,
      triggerLaneRange: id === 'jalapeno' ? 0 : 1,
      triggerColumnRange: id === 'jalapeno' ? 9 : 1.5,
      removeOnTrigger: true,
      explodeGfx:
        id === 'jalapeno' ? 'lane_fire' : id === 'ice_shroom' ? 'ice' : id === 'cherry_bomb' ? 'fire' : 'boom',
    };
  }

  if (PRODUCER_IDS.has(id)) {
    return { kind: 'producer', produceIntervalSeconds: 24 };
  }

  // Fog lantern / utility — not a shooter (fog clear is authored on the status graph).
  if (id === 'plantern' || role === 'utility') {
    return { kind: 'blocker' };
  }

  if (role === 'blocker') {
    return { kind: 'blocker' };
  }

  // Magnet-shroom, Garlic, Hypno-shroom, etc. — not projectile plants.
  if (role === 'disruptor' || id === 'magnet_shroom') {
    return { kind: 'disruptor' };
  }

  if (client.init) {
    return {
      kind: 'armed_trap',
      prepareSeconds: 15,
      triggerColumnRange: 0.45,
      removeOnTrigger: true,
    };
  }

  // Squash / Tangle Kelp / any graph that crushes — not projectile plants.
  // Tangle Kelp is spine-only (no client.attack clip), so role+attack alone missed it
  // and incorrectly fell through to shooter / bullet UI.
  if (
    id === 'squash' ||
    id === 'tangle_kelp' ||
    graphHasAction(client.stateGraph, 'squash_crush')
  ) {
    return {
      kind: 'melee_trap',
      triggerColumnRange: id === 'tangle_kelp' ? 1 : 1.15,
      removeOnTrigger: true,
      aimBeforeAttack: Boolean(client.aim) || id === 'squash',
    };
  }

  if (role === 'trap') {
    if (id === 'chomper') {
      return {
        kind: 'chomper',
        triggerColumnRange: 1.05,
        removeOnTrigger: false,
        digestSeconds: 42,
      };
    }

    return {
      kind: 'melee_trap',
      triggerColumnRange: 1.15,
      removeOnTrigger: true,
      aimBeforeAttack: Boolean(client.aim),
    };
  }

  if (role === 'shooter' || role === 'splash' || role === 'anti_air') {
    if (id === 'scaredy_shroom') {
      return { kind: 'shooter', hideProximityColumns: 1.5 };
    }
    return { kind: 'shooter' };
  }

  // Support / unknown: not a shooter by default (avoids false bullet UI).
  if (role === 'support') {
    return { kind: 'blocker' };
  }

  return DEFAULT_PLANT_BEHAVIOR;
}
