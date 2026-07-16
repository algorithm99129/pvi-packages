import type { PlantClientAssets, PlantRole } from './plant';

/** Data-driven plant combat behavior — add new plants via JSON, not code branches. */
export type PlantBehaviorKind =
  | 'shooter'
  | 'producer'
  | 'blocker'
  | 'instant_explode'
  | 'armed_trap'
  | 'melee_trap'
  | 'chomper';

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
  /** Screen FX key override for explosions. */
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
      explodeGfx: id === 'jalapeno' ? 'JalapenoExplode' : id === 'ice_shroom' ? 'IceShroomSnow' : 'Boom',
    };
  }

  if (PRODUCER_IDS.has(id)) {
    return { kind: 'producer', produceIntervalSeconds: 24 };
  }

  if (role === 'blocker') {
    return { kind: 'blocker' };
  }

  if (client.init) {
    return {
      kind: 'armed_trap',
      prepareSeconds: 15,
      triggerColumnRange: 0.45,
      removeOnTrigger: true,
    };
  }

  if (role === 'trap' && client.attack) {
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

  if (role === 'shooter' || role === 'splash') {
    if (id === 'scaredy_shroom') {
      return { kind: 'shooter', hideProximityColumns: 1.5 };
    }
    return { kind: 'shooter' };
  }

  return DEFAULT_PLANT_BEHAVIOR;
}
