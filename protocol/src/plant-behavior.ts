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
  | 'pitcher_snare'
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
   * Use {@link ExplodeVfxStyle} ids: boom | fire | lane_fire | sand_storm | ice
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

const PRODUCER_IDS = new Set(['sunleaf_banker', 'honeycomb_clover']);

export const DEFAULT_PLANT_BEHAVIOR: PlantBehaviorConfig = { kind: 'shooter' };

const MELEE_ACTIONS: ReadonlyArray<StateActionKind> = [
  'deal_contact_damage',
  'squash_crush',
  'chomp_devour',
  'knockback_insects',
];

/** True when any node runs explode with mode=pulse (close fan / cone). */
function graphHasPulseExplode(graph: EntityStateGraph | null | undefined): boolean {
  if (!graph?.nodes?.length) return false;
  for (const node of graph.nodes) {
    const actions = node?.actions;
    if (!actions?.length) continue;
    for (const action of actions) {
      if (action?.type === 'explode' && action.mode === 'pulse') return true;
    }
  }
  return false;
}

/**
 * True when the unit strikes in place (contact, cone, crush, snare, knockback)
 * and never launches a projectile.
 */
export function entityUsesMeleeAttack(input: {
  client?: { stateGraph?: EntityStateGraph | null } | null;
}): boolean {
  const graph = input.client?.stateGraph;
  if (!graph?.nodes?.length) return false;
  if (graphHasAction(graph, 'fire_bullet')) return false;
  if (graphHasPulseExplode(graph)) return true;
  return MELEE_ACTIONS.some((type) => graphHasAction(graph, type));
}

/**
 * True when the plant strikes in place (contact, cone, crush, snare, knockback)
 * and never launches a projectile.
 */
export function plantUsesMeleeAttack(input: {
  client?: { stateGraph?: EntityStateGraph | null } | null;
}): boolean {
  return entityUsesMeleeAttack(input);
}

/**
 * True when the plant fires projectile bullets.
 * A status graph is authoritative: bullets are authored only if it contains `fire_bullet`.
 * Melee, support, and trap graphs must not show projectile fields.
 */
export function plantShootsBullets(input: {
  id: string;
  role: PlantRole;
  client: PlantClientAssets;
  behavior?: PlantBehaviorConfig;
}): boolean {
  const graph = input.client?.stateGraph;
  if (graph?.nodes?.length) return graphHasAction(graph, 'fire_bullet');
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
  return input.id.trim().toLowerCase() === 'lantern_lily';
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

/**
 * Infer fallback behavior from the status graph first, then role.
 * Avoid plant-id switch lists — authored graph + behavior JSON are source of truth.
 */
function inferPlantBehavior(input: {
  id: string;
  role: PlantRole;
  client: PlantClientAssets;
}): PlantBehaviorConfig {
  const { id, role, client } = input;
  const graph = client?.stateGraph;

  if (graphHasAction(graph, 'explode')) {
    return {
      kind: 'instant_explode',
      detonateDelaySeconds: 0.5,
      triggerLaneRange: 1,
      triggerColumnRange: 1.5,
      removeOnTrigger: true,
      explodeGfx: 'boom',
    };
  }

  if (graphHasAction(graph, 'produce_sun') || PRODUCER_IDS.has(id)) {
    return { kind: 'producer', produceIntervalSeconds: 24 };
  }

  if (graphHasAction(graph, 'clear_fog') || id === 'lantern_lily' || role === 'utility') {
    return { kind: 'blocker' };
  }

  if (role === 'blocker') {
    return { kind: 'blocker' };
  }

  if (
    role === 'disruptor' ||
    graphHasAction(graph, 'reflect_projectile') ||
    graphHasAction(graph, 'apply_slow') ||
    id === 'mirror_ivy'
  ) {
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

  if (
    graphHasAction(graph, 'squash_crush') ||
    id === 'mallet_mushroom' ||
    id === 'tangle_root'
  ) {
    return {
      kind: 'melee_trap',
      triggerColumnRange: id === 'tangle_root' ? 1 : 1.15,
      removeOnTrigger: true,
      aimBeforeAttack: Boolean(client.aim) || id === 'mallet_mushroom',
    };
  }

  if (role === 'trap' || graphHasAction(graph, 'chomp_devour')) {
    if (id === 'pitcher_snare' || graphHasAction(graph, 'chomp_devour')) {
      return {
        kind: 'pitcher_snare',
        triggerColumnRange: 1.05,
        removeOnTrigger: false,
        digestSeconds: 15,
      };
    }

    return {
      kind: 'melee_trap',
      triggerColumnRange: 1.15,
      removeOnTrigger: true,
      aimBeforeAttack: Boolean(client.aim),
    };
  }

  if (graphHasAction(graph, 'fire_bullet') || role === 'shooter' || role === 'splash' || role === 'anti_air') {
    if (id === 'mimosa_flinch') {
      return { kind: 'shooter', hideProximityColumns: 1.5 };
    }
    return { kind: 'shooter' };
  }

  if (role === 'support') {
    return { kind: 'blocker' };
  }

  if (entityUsesMeleeAttack({ client })) {
    return {
      kind: 'melee_trap',
      triggerColumnRange: 1.15,
      removeOnTrigger: false,
    };
  }

  return DEFAULT_PLANT_BEHAVIOR;
}
