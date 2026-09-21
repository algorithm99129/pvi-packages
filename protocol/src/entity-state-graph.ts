/**
 * Entity status graph — data-driven status machine for plants & insects.
 *
 * Canonical runtime & authoring contract: docs/ENTITY_STATUS_GRAPH.md
 *
 * This is NOT an animation graph. Statuses are gameplay states; each status may
 * optionally play a Spine clip from the unit’s single skeleton file.
 *
 * Edges carry AND-combined conditions. When every condition on an edge is true,
 * the unit transitions to the target status.
 *
 * Statuses call predefined engine actions (fire_bullet, chomp_devour, …). The
 * runtime implements each action once; new units are authored by composing
 * statuses + conditions + actions — not by writing per-plant code.
 *
 * Die is special: not edged. HP ≤ 0 always enters die (plays die.spineAnim or
 * die.explodeSpineAnim, then despawns when the clip ends).
 */

import {
  BUILTIN_DURATION_ATTRIBUTE_OPTIONS,
  LEGACY_BEHAVIOR_DURATION_OPTIONS,
  getExtraNumber,
  parseExtraPath,
  type ExtraAttributes,
} from './extra-attributes';

export type EntityGraphKind = 'plant' | 'insect';

/** Built-in plant statuses (nodes pick from this set). */
export type PlantGraphStatus =
  | 'idle'
  | 'init'
  | 'armed'
  | 'aim'
  | 'attack'
  | 'digest'
  | 'hide'
  | 'produce'
  | 'special'
  | 'temporal'
  | 'die';

/** Built-in insect statuses. */
export type InsectGraphStatus =
  | 'idle'
  | 'walk'
  | 'attack'
  | 'enrage'
  | 'vault'
  | 'burrow'
  | 'emerge'
  | 'swim'
  | 'fly'
  | 'aim'
  | 'summon'
  | 'throw'
  | 'special'
  | 'temporal'
  | 'die';

export type EntityGraphStatus = PlantGraphStatus | InsectGraphStatus;

/** Hold-only status: no Spine clip, no engine actions — wait on edge conditions. */
export function isTemporalStatus(status: string | null | undefined): boolean {
  return status === 'temporal';
}

/**
 * Plants normally allow one node per status; insects may duplicate.
 * Temporal is always multi-instance (several cooldown / delay holds in one graph).
 */
export function allowsDuplicateGraphStatus(
  kind: EntityGraphKind,
  status: EntityGraphStatus,
): boolean {
  if (isTemporalStatus(status)) return true;
  return kind === 'insect';
}

export const PLANT_GRAPH_STATUSES: ReadonlyArray<{
  id: PlantGraphStatus;
  label: string;
  hint: string;
  defaultLoop: boolean;
}> = [
  { id: 'idle', label: 'Idle', hint: 'Default resting status', defaultLoop: true },
  { id: 'init', label: 'Init', hint: 'Arming / emerging (Potato Mine)', defaultLoop: false },
  { id: 'armed', label: 'Armed', hint: 'Ready to trigger', defaultLoop: true },
  { id: 'aim', label: 'Aim', hint: 'Wind-up before attack (Squash)', defaultLoop: false },
  { id: 'attack', label: 'Attack', hint: 'Fire / crush / explode / bite', defaultLoop: false },
  {
    id: 'digest',
    label: 'Digest / Hold',
    hint: 'Recovery after chomp, or holding stolen metal (Magnet-shroom)',
    defaultLoop: true,
  },
  { id: 'hide', label: 'Hide', hint: 'Withdrawn / folded / dormant curl', defaultLoop: true },
  { id: 'produce', label: 'Produce', hint: 'Sun / resource / support pulse', defaultLoop: false },
  {
    id: 'special',
    label: 'Special',
    hint: 'Brace, reflect pulse, or other non-attack ability (Ironwood Guard)',
    defaultLoop: false,
  },
  {
    id: 'temporal',
    label: 'Temporal',
    hint: 'Hold only — no animation or actions; exit via cooldown / after_seconds / range',
    defaultLoop: true,
  },
  { id: 'die', label: 'Die', hint: 'Special — HP≤0 only; not edged', defaultLoop: false },
];

export const INSECT_GRAPH_STATUSES: ReadonlyArray<{
  id: InsectGraphStatus;
  label: string;
  hint: string;
  defaultLoop: boolean;
}> = [
  { id: 'idle', label: 'Idle', hint: 'Standing / waiting (no march)', defaultLoop: true },
  { id: 'walk', label: 'Walk', hint: 'Lane locomotion', defaultLoop: true },
  { id: 'attack', label: 'Attack', hint: 'Bite / smash', defaultLoop: false },
  { id: 'enrage', label: 'Enrage', hint: 'Faster after armor break', defaultLoop: true },
  { id: 'vault', label: 'Vault', hint: 'Jump first plant', defaultLoop: false },
  { id: 'burrow', label: 'Burrow', hint: 'Underground travel', defaultLoop: true },
  { id: 'emerge', label: 'Emerge', hint: 'Surface from burrow', defaultLoop: false },
  { id: 'swim', label: 'Swim', hint: 'Underwater / pool travel (Dive Skimmer)', defaultLoop: true },
  { id: 'fly', label: 'Fly', hint: 'Air locomotion', defaultLoop: true },
  {
    id: 'aim',
    label: 'Aim / hang',
    hint: 'Wind-up while dangling over a plant (Drop Spider)',
    defaultLoop: true,
  },
  { id: 'summon', label: 'Summon', hint: 'Call backup insects', defaultLoop: false },
  { id: 'throw', label: 'Throw', hint: 'Hurl Imp / projectile', defaultLoop: false },
  { id: 'special', label: 'Special', hint: 'One-shot ability (ladder, etc.)', defaultLoop: false },
  {
    id: 'temporal',
    label: 'Temporal',
    hint: 'Hold only — no animation or actions; exit via cooldown / after_seconds / range',
    defaultLoop: true,
  },
  { id: 'die', label: 'Die', hint: 'Special — HP≤0 only; not edged', defaultLoop: false },
];

/** Edge conditions — all must be true (AND) for the transition. */
export type StateConditionKind =
  | 'enemy_in_range'
  | 'no_enemy_in_range'
  | 'enemy_in_proximity'
  | 'no_enemy_in_proximity'
  | 'metal_in_range'
  | 'no_metal_in_range'
  | 'holding_metal'
  | 'no_holding_metal'
  | 'has_equipment'
  | 'no_equipment'
  | 'attack_interval_ready'
  | 'anim_ended'
  | 'after_seconds'
  | 'prepare_complete'
  | 'on_damaged'
  | 'health_below'
  | 'armor_broken'
  | 'being_bitten'
  | 'player_command'
  | 'player_controlled'
  | 'ai_controlled'
  | 'vault_ready'
  | 'throw_ready'
  | 'special_ready'
  | 'reached_target';

export type StateCondition =
  | { type: 'enemy_in_range' }
  | { type: 'no_enemy_in_range' }
  | { type: 'enemy_in_proximity' }
  | { type: 'no_enemy_in_proximity' }
  | { type: 'metal_in_range' }
  | { type: 'no_metal_in_range' }
  | { type: 'holding_metal' }
  | { type: 'no_holding_metal' }
  | { type: 'has_equipment' }
  | { type: 'no_equipment' }
  | { type: 'attack_interval_ready' }
  | { type: 'anim_ended' }
  | { type: 'after_seconds'; value: StateDurationValue }
  | { type: 'prepare_complete' }
  | { type: 'on_damaged' }
  | { type: 'health_below'; ratio: number }
  | { type: 'armor_broken' }
  | { type: 'being_bitten' }
  | { type: 'player_command' }
  | { type: 'player_controlled' }
  | { type: 'ai_controlled' }
  | { type: 'vault_ready' }
  | { type: 'throw_ready' }
  | { type: 'special_ready' }
  | { type: 'reached_target' };

/**
 * Duration for `after_seconds` — literal, unit attribute, or logic constant.
 * Timer starts when entering the source status (not after anim ends).
 */
export type StateDurationValue =
  | { kind: 'literal'; seconds: number }
  | { kind: 'attribute'; path: string }
  | { kind: 'constant'; id: string };

/** Common unit attribute paths that resolve to seconds (or ms → seconds). */
export const DURATION_ATTRIBUTE_OPTIONS: ReadonlyArray<{
  path: string;
  label: string;
  hint: string;
  kind?: EntityGraphKind | 'both';
  /** If true, runtime divides by 1000 (milliseconds → seconds). */
  fromMs?: boolean;
}> = [
  ...BUILTIN_DURATION_ATTRIBUTE_OPTIONS,
  ...LEGACY_BEHAVIOR_DURATION_OPTIONS.map(({ path, label, hint, kind, fromMs }) => ({
    path,
    label,
    hint,
    kind,
    fromMs,
  })),
];
export function literalDuration(seconds: number): StateDurationValue {
  return { kind: 'literal', seconds: Math.max(0, seconds) };
}

export function attributeDuration(path: string): StateDurationValue {
  return { kind: 'attribute', path };
}

export function constantDuration(id: string): StateDurationValue {
  return { kind: 'constant', id };
}

export function durationLabel(value: StateDurationValue): string {
  switch (value.kind) {
    case 'literal':
      return `Elapsed ${value.seconds}s`;
    case 'attribute':
      return `Elapsed ← ${value.path}`;
    case 'constant':
      return `Elapsed ← $${value.id}`;
    default:
      return 'Elapsed';
  }
}

/**
 * Resolve an after_seconds duration to seconds for the runtime.
 * Attribute paths read from the unit definition; constants from logic variables.
 */
export function resolveStateDuration(
  value: StateDurationValue,
  ctx: {
    stats?: { attackIntervalMs?: number };
    behavior?: Record<string, unknown> | null;
    extraAttributes?: ExtraAttributes | null;
    constants?: Readonly<Record<string, unknown>>;
  },
): number {
  if (value.kind === 'literal') {
    return Math.max(0, Number(value.seconds) || 0);
  }
  if (value.kind === 'constant') {
    const raw = ctx.constants?.[value.id];
    return Math.max(0, Number(raw) || 0);
  }
  const path = value.path.trim();
  const meta = DURATION_ATTRIBUTE_OPTIONS.find((o) => o.path === path);
  let raw: unknown;

  if (path === 'stats.attackIntervalMs') {
    raw = ctx.stats?.attackIntervalMs;
  } else {
    const extraKey = parseExtraPath(path);
    if (extraKey) {
      raw = getExtraNumber(ctx.extraAttributes, extraKey);
    } else if (path.startsWith('behavior.')) {
      const legacyKey = path.slice('behavior.'.length);
      // Prefer matching extra attribute when present.
      const fromExtra = getExtraNumber(ctx.extraAttributes, legacyKey);
      if (fromExtra !== undefined) raw = fromExtra;
      else if (ctx.behavior) raw = ctx.behavior[legacyKey];
    }
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    // Classic Chomper digest — never treat a missing digest as "already done".
    if (
      path === 'extra.digestSeconds' ||
      path === 'behavior.digestSeconds'
    ) {
      return 42;
    }
    return 0;
  }
  const seconds = Math.max(0, meta?.fromMs ? n / 1000 : n);
  if (
    seconds <= 0 &&
    (path === 'extra.digestSeconds' || path === 'behavior.digestSeconds')
  ) {
    return 42;
  }
  return seconds;
}


export const STATE_CONDITION_OPTIONS: ReadonlyArray<{
  type: StateConditionKind;
  label: string;
  hint: string;
  needsSeconds?: boolean;
  needsRatio?: boolean;
}> = [
  {
    type: 'enemy_in_range',
    label: 'Target in range',
    hint: 'A valid combat target is within this unit’s attack range',
  },
  {
    type: 'no_enemy_in_range',
    label: 'No target in range',
    hint: 'No valid combat target is within attack range',
  },
  {
    type: 'enemy_in_proximity',
    label: 'Enemy in proximity',
    hint: 'Enemy closer than hide/scare distance (Scaredy-shroom)',
  },
  {
    type: 'no_enemy_in_proximity',
    label: 'No enemy in proximity',
    hint: 'No enemy within hide/scare distance',
  },
  {
    type: 'metal_in_range',
    label: 'Metal equipment in range',
    hint: 'An insect with stealable metal armor is within attack range (Magnet-shroom)',
  },
  {
    type: 'no_metal_in_range',
    label: 'No metal in range',
    hint: 'No insect with stealable metal armor is within attack range',
  },
  {
    type: 'holding_metal',
    label: 'Holding stolen metal',
    hint: 'Magnet successfully stole metal and is still holding it',
  },
  {
    type: 'no_holding_metal',
    label: 'Not holding metal',
    hint: 'Magnet is not currently holding stolen metal',
  },
  {
    type: 'has_equipment',
    label: 'Has equipment',
    hint: 'This insect still has its armor / equipment piece (bucket, cone, …)',
  },
  {
    type: 'no_equipment',
    label: 'No equipment',
    hint: 'Armor / equipment is gone (broken, magnet-stolen, or never had any)',
  },
  {
    type: 'attack_interval_ready',
    label: 'Attack cooldown elapsed',
    hint: 'Attack interval timer has finished (stats.attackIntervalMs)',
  },
  {
    type: 'anim_ended',
    label: 'Animation completed',
    hint: 'The current status animation finished one cycle (immediate if none)',
  },
  {
    type: 'after_seconds',
    label: 'Elapsed time',
    hint: 'Time spent in the source status (literal, unit attribute, or constant)',
    needsSeconds: true,
  },
  {
    type: 'prepare_complete',
    label: 'Arming finished',
    hint: 'Init / prepare timer has completed',
  },
  {
    type: 'on_damaged',
    label: 'Damage received',
    hint: 'This unit took damage',
  },
  {
    type: 'health_below',
    label: 'Health below threshold',
    hint: 'Current health as a fraction of max health is below the threshold',
    needsRatio: true,
  },
  {
    type: 'armor_broken',
    label: 'Equipment lost',
    hint: 'Assigned equipment HP hit 0 or was stolen (Magnet). Drive a bare/enrage Spine status from here — equipment art lives on the insect avatar/Spine, not a separate overlay.',
  },
  {
    type: 'being_bitten',
    label: 'Being bitten',
    hint: 'An insect started chewing this plant',
  },
  {
    type: 'player_command',
    label: 'Player command',
    hint: 'Manual fire / ability pulse (tap Cob Cannon when player-controlled)',
  },
  {
    type: 'player_controlled',
    label: 'Player controlled',
    hint: 'Human plant side — manual Cob (tap cannon, then tap lawn). False when garden is under attack or plant side is AI.',
  },
  {
    type: 'ai_controlled',
    label: 'AI controlled',
    hint: 'Garden defense under attack, or AI plant player — Cob auto-fires at enemies in range',
  },
  {
    type: 'vault_ready',
    label: 'Vault ready',
    hint: 'Has not used vault_over_plant yet this life',
  },
  {
    type: 'throw_ready',
    label: 'Throw ready',
    hint: 'Has Imp and has not thrown yet; also requires ~6 columns from the house (classic Colossus)',
  },
  {
    type: 'special_ready',
    label: 'Special ready',
    hint: 'Has not used a one-shot special (ladder, etc.) yet',
  },
  {
    type: 'reached_target',
    label: 'Reached march target',
    hint: 'Lane mover arrived at its current target (house / first column, or reverse-march edge)',
  },
];

/**
 * Predefined engine functions. Implemented once in the runtime; graphs compose them.
 * Prefer these over per-plant C# / server branches.
 */
export type StateActionKind =
  | 'fire_bullet'
  | 'begin_charge'
  | 'deal_contact_damage'
  | 'deal_area_damage'
  | 'squash_crush'
  | 'chomp_devour'
  | 'explode'
  | 'produce_sun'
  | 'clear_fog'
  | 'clear_all_fog'
  | 'blow_away_flying'
  | 'blow_away'
  | 'despawn'
  | 'reset_attack_timer'
  | 'stop_moving'
  | 'start_moving'
  | 'vault_over_plant'
  | 'enter_burrow'
  | 'exit_burrow'
  | 'reverse_march'
  | 'enter_fly'
  | 'exit_fly'
  | 'redirect_lane'
  | 'charm_insect'
  | 'steal_metal'
  | 'digest_metal'
  | 'destroy_egg_group'
  | 'leave_crater'
  | 'summon_insect'
  | 'throw_unit'
  | 'place_ladder'
  | 'steal_plant'
  | 'aerial_drop'
  | 'aerial_aim'
  | 'apply_freeze'
  | 'smash_plant'
  | 'heal_ally'
  | 'buff_attack_speed'
  | 'knockback_insects'
  | 'grant_shield'
  | 'sip_economy'
  | 'summon_temp_plant'
  | 'brace'
  | 'chain_damage'
  | 'leave_slick'
  | 'reduce_ally_cooldown'
  | 'pull_insect'
  | 'apply_slow'
  | 'buff_move_speed'
  | 'weaken_attack'

export type StateActionWhen = 'on_enter' | 'after_anim' | 'on_exit';

/**
 * Optional numeric params on engine actions.
 * Prefer `attribute` paths like `extra.triggerColumnRange` so Extra attributes drive combat.
 * Reuses {@link StateDurationValue} (literal.seconds holds any numeric value, not only time).
 */
export interface StateAction {
  type: StateActionKind;
  /**
   * When to run this action in the status:
   * - on_enter — as soon as the status begins
   * - after_anim — after the status Spine clip ends (or immediately if none / looping)
   * - on_exit — when leaving the status
   * Default: after_anim if a non-looping spineAnim is set, else on_enter.
   */
  when?: StateActionWhen;
  /** Explode / area blast: column radius in cells. */
  columnRange?: StateDurationValue;
  /** Explode / area blast: lane radius (0 = same lane only). */
  laneRange?: StateDurationValue;
  /** apply_freeze: full freeze duration (seconds). */
  freezeDuration?: StateDurationValue;
  /** apply_freeze: chill/slow duration after thaw (seconds). */
  chillDuration?: StateDurationValue;
  /** squash_crush: splash column radius around impact. */
  splashColumnRange?: StateDurationValue;
  /** squash_crush: splash lane radius around impact. */
  splashLaneRange?: StateDurationValue;
  /** knockback_insects: how many cells to push the insect back along the lane. */
  knockbackCells?: StateDurationValue;
  /** knockback_insects: damage dealt with the shove. Prefer stats.baseDamage. */
  damage?: StateDurationValue;
  /** knockback_insects: push only on every Nth attack. 1 = every attack. */
  knockbackEvery?: StateDurationValue;
  /** knockback_insects: only insects with no equipment. */
  unequippedOnly?: boolean;
  /**
   * squash_crush: how the plant reaches the target.
   * Prefer this over hardcoding by plant id in the client (Squash hop vs Tangle Kelp pull).
   */
  crushStyle?: SquashCrushStyle;
  /**
   * explode: visual style (point boom, fire, lane fire sweep, ice).
   * Prefer this over hardcoding by plant id in the client.
   */
  vfxStyle?: ExplodeVfxStyle;
}

/** Motion style for the `squash_crush` action. */
export type SquashCrushStyle = 'hop' | 'pull_under';

export const SQUASH_CRUSH_STYLE_OPTIONS: ReadonlyArray<{
  id: SquashCrushStyle;
  label: string;
  hint: string;
}> = [
  {
    id: 'hop',
    label: 'Hop (Squash)',
    hint: 'Leap in an arc onto the target, then crush',
  },
  {
    id: 'pull_under',
    label: 'Pull under (Tangle Kelp)',
    hint: 'Drag the target under at the plant cell (water traps)',
  },
];

const SQUASH_CRUSH_STYLE_SET = new Set<string>(SQUASH_CRUSH_STYLE_OPTIONS.map((o) => o.id));

/** Normalize authored crush motion keys. */
export function normalizeSquashCrushStyle(raw: unknown): SquashCrushStyle | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase().replace(/-/g, '_');
  if (!s) return undefined;
  if (SQUASH_CRUSH_STYLE_SET.has(s)) return s as SquashCrushStyle;
  if (s === 'kelp' || s === 'pull' || s === 'drown' || s === 'drag') return 'pull_under';
  if (s === 'jump' || s === 'leap' || s === 'mallet_mushroom') return 'hop';
  return undefined;
}

/** Visual styles for the `explode` action (and behavior.explodeGfx fallback). */
export type ExplodeVfxStyle = 'boom' | 'fire' | 'lane_fire' | 'ice';

export const EXPLODE_VFX_STYLE_OPTIONS: ReadonlyArray<{
  id: ExplodeVfxStyle;
  label: string;
  hint: string;
}> = [
  {
    id: 'boom',
    label: 'Boom',
    hint: 'Single blast at the plant',
  },
  {
    id: 'fire',
    label: 'Fire blast',
    hint: 'Fire explosion at the plant (Cherry Bomb)',
  },
  {
    id: 'lane_fire',
    label: 'Lane fire',
    hint: 'Fire sweeps across the whole lane (Jalapeno)',
  },
  {
    id: 'ice',
    label: 'Ice blast',
    hint: 'Ice burst at the plant',
  },
];

const EXPLODE_VFX_STYLE_SET = new Set<string>(EXPLODE_VFX_STYLE_OPTIONS.map((o) => o.id));

/** Normalize authored / legacy explode GFX keys to a known style id. */
export function normalizeExplodeVfxStyle(raw: unknown): ExplodeVfxStyle | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const lower = s.toLowerCase().replace(/-/g, '_');
  if (EXPLODE_VFX_STYLE_SET.has(lower)) return lower as ExplodeVfxStyle;
  if (lower === 'jalapenoexplode' || lower === 'storm_tulip' || lower === 'lanefire') return 'lane_fire';
  if (lower === 'fireexplosion' || lower === 'cherry' || lower === 'storm_tulip') return 'fire';
  if (lower === 'iceshroomsnow' || lower === 'mint_mist' || lower === 'freeze') return 'ice';
  if (lower === 'explosion' || lower === 'default') return 'boom';
  return undefined;
}

/** Inspector fields for actions that take graph-configurable numbers. */
export const STATE_ACTION_PARAM_FIELDS: ReadonlyArray<{
  action: StateActionKind;
  key:
    | 'columnRange'
    | 'laneRange'
    | 'freezeDuration'
    | 'chillDuration'
    | 'splashColumnRange'
    | 'splashLaneRange'
    | 'knockbackCells'
    | 'damage'
    | 'knockbackEvery';
  label: string;
  hint: string;
  /** Default Extra attribute path when inserting the action. */
  defaultAttribute: string;
}> = [
  {
    action: 'explode',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Blast radius in columns (Cherry ~1.5, Jalapeno ~12)',
    defaultAttribute: 'extra.triggerColumnRange',
  },
  {
    action: 'explode',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Lane radius (0 = same lane only; 1 = ±1 lane)',
    defaultAttribute: 'extra.triggerLaneRange',
  },
  {
    action: 'deal_area_damage',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Area damage column radius',
    defaultAttribute: 'extra.triggerColumnRange',
  },
  {
    action: 'deal_area_damage',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Area damage lane radius',
    defaultAttribute: 'extra.triggerLaneRange',
  },
  {
    action: 'apply_freeze',
    key: 'freezeDuration',
    label: 'Freeze duration',
    hint: 'Seconds insects stay fully frozen',
    defaultAttribute: 'extra.freezeDurationSeconds',
  },
  {
    action: 'apply_freeze',
    key: 'chillDuration',
    label: 'Chill duration',
    hint: 'Seconds of slow after freeze thaws',
    defaultAttribute: 'extra.chillDurationSeconds',
  },
  {
    action: 'squash_crush',
    key: 'splashColumnRange',
    label: 'Splash column range',
    hint: 'Crush splash around the primary target',
    defaultAttribute: 'extra.splashColumnRange',
  },
  {
    action: 'squash_crush',
    key: 'splashLaneRange',
    label: 'Splash lane range',
    hint: 'Lane radius for squash splash (usually 0)',
    defaultAttribute: 'extra.splashLaneRange',
  },
  {
    action: 'leave_crater',
    key: 'columnRange',
    label: 'Crater radius (cells)',
    hint: 'Chebyshev crater radius (0 = plant cell only)',
    defaultAttribute: 'extra.craterRadiusCells',
  },
  {
    action: 'clear_fog',
    key: 'columnRange',
    label: 'Clear radius (cells)',
    hint: 'Chebyshev fog clear radius (1 = classic Plantern 3×3)',
    defaultAttribute: 'extra.fogClearRadius',
  },
  {
    action: 'knockback_insects',
    key: 'knockbackCells',
    label: 'Knockback distance (cells)',
    hint: 'How many cells the insect is pushed back. It keeps marching afterward.',
    defaultAttribute: 'extra.knockbackCells',
  },
  {
    action: 'knockback_insects',
    key: 'damage',
    label: 'Knockback damage',
    hint: 'Damage dealt with the shove. Attribute stats.baseDamage uses this plant’s damage.',
    defaultAttribute: 'stats.baseDamage',
  },
  {
    action: 'knockback_insects',
    key: 'knockbackEvery',
    label: 'Every Nth attack',
    hint: 'Push only on this attack count. 1 pushes every attack. 3 pushes on the 3rd, 6th, and so on.',
    defaultAttribute: 'extra.knockbackEvery',
  },
];

export function actionParamFieldsFor(type: StateActionKind) {
  return STATE_ACTION_PARAM_FIELDS.filter((f) => f.action === type);
}

/** Seed default attribute-bound params when adding an action in the editor. */
export function defaultActionParams(type: StateActionKind): Partial<StateAction> {
  const fields = actionParamFieldsFor(type);
  const out: Partial<StateAction> = {};
  for (const f of fields) {
    (out as Record<string, StateDurationValue>)[f.key] = attributeDuration(f.defaultAttribute);
  }
  if (type === 'explode') {
    out.vfxStyle = 'boom';
  }
  if (type === 'squash_crush') {
    out.crushStyle = 'hop';
  }
  return out;
}

export const STATE_ACTION_OPTIONS: ReadonlyArray<{
  type: StateActionKind;
  label: string;
  hint: string;
  kind?: EntityGraphKind | 'both';
}> = [
  {
    type: 'fire_bullet',
    label: 'Fire bullet',
    hint: 'Launch projectile volley from client.bulletShots (plants + catapult insects)',
    kind: 'both',
  },
  {
    type: 'begin_charge',
    label: 'Begin charge',
    hint: 'Start the prepare timer again. The plant cannot fire until prepare completes.',
    kind: 'plant',
  },
  {
    type: 'deal_contact_damage',
    label: 'Deal contact damage',
    hint: 'Melee hit against current target',
  },
  {
    type: 'deal_area_damage',
    label: 'Deal area damage',
    hint: 'Damage every enemy in range (close area pulse)',
    kind: 'plant',
  },
  {
    type: 'squash_crush',
    label: 'Squash crush',
    hint: 'Crush a target — set crush style (hop vs pull under) on the action',
    kind: 'plant',
  },
  {
    type: 'chomp_devour',
    label: 'Chomp devour',
    hint: 'Swallow one target, then recover (Pitcher Snare)',
    kind: 'plant',
  },
  {
    type: 'explode',
    label: 'Explode',
    hint: 'Area / lane blast — set column/lane range on the action (extra.trigger*)',
  },
  {
    type: 'produce_sun',
    label: 'Produce sun',
    hint: 'Spawn sun / photosynthesis pulse',
    kind: 'plant',
  },
  {
    type: 'clear_fog',
    label: 'Clear fog',
    hint: 'Reveal a hole in raid fog while this status is active (Lantern Lily)',
    kind: 'plant',
  },
  {
    type: 'clear_all_fog',
    label: 'Clear all fog',
    hint: 'Wipe the entire fog bank (Gale Bloom)',
    kind: 'plant',
  },
  {
    type: 'blow_away_flying',
    label: 'Blow away flying',
    hint: 'Remove every flying insect on the board (Gale Bloom)',
    kind: 'plant',
  },
  {
    type: 'blow_away',
    label: 'Blow away',
    hint: 'Clear all fog and remove flying insects (Gale Bloom combo)',
    kind: 'plant',
  },
  {
    type: 'despawn',
    label: 'Despawn',
    hint: 'Remove this unit from the board',
  },
  {
    type: 'reset_attack_timer',
    label: 'Reset attack timer',
    hint: 'Restart attackIntervalMs cooldown',
  },
  {
    type: 'stop_moving',
    label: 'Stop moving',
    hint: 'Halt lane locomotion (insects)',
    kind: 'insect',
  },
  {
    type: 'start_moving',
    label: 'Start moving',
    hint: 'Resume lane locomotion',
    kind: 'insect',
  },
  {
    type: 'vault_over_plant',
    label: 'Vault over plant',
    hint: 'Jump the first plant in lane',
    kind: 'insect',
  },
  {
    type: 'enter_burrow',
    label: 'Enter burrow',
    hint: 'Go underground / untargetable travel',
    kind: 'insect',
  },
  {
    type: 'exit_burrow',
    label: 'Exit burrow',
    hint: 'Surface and resume normal combat',
    kind: 'insect',
  },
  {
    type: 'reverse_march',
    label: 'Reverse march',
    hint: 'Turn around and walk back toward the spawn edge (Earthworm Tunneler after surfacing)',
    kind: 'insect',
  },
  {
    type: 'enter_fly',
    label: 'Enter fly',
    hint: 'Switch travel layer to flying (Butterfly Glider while lifted)',
    kind: 'insect',
  },
  {
    type: 'exit_fly',
    label: 'Exit fly / land',
    hint: 'Drop to the ground travel layer after lift is lost',
    kind: 'insect',
  },
  {
    type: 'redirect_lane',
    label: 'Redirect lane',
    hint: 'Send the biting insect into an adjacent lane (Lane Warden)',
    kind: 'plant',
  },
  {
    type: 'charm_insect',
    label: 'Charm insect',
    hint: 'Turn the biting insect to fight for the garden (Turncoat Bloom)',
    kind: 'plant',
  },
  {
    type: 'steal_metal',
    label: 'Steal metal',
    hint: 'Pull metal armor onto this plant and hold it (Lodestone Bloom)',
    kind: 'plant',
  },
  {
    type: 'digest_metal',
    label: 'Digest metal',
    hint: 'Destroy held metal after the hold so this plant can steal again',
    kind: 'plant',
  },
  {
    type: 'destroy_egg_group',
    label: 'Destroy egg group',
    hint: 'Remove the dirty egg group under this plant (Nest Breaker)',
    kind: 'plant',
  },
  {
    type: 'leave_crater',
    label: 'Leave crater',
    hint: 'Mark cells unplantable (Crater Cap). Radius via extra.craterRadiusCells (0 = own cell).',
    kind: 'plant',
  },
  {
    type: 'summon_insect',
    label: 'Summon insect',
    hint: 'Spawn allied insects in this lane (Firefly Lantern)',
    kind: 'insect',
  },
  {
    type: 'throw_unit',
    label: 'Throw / lob unit',
    hint: 'Hurl a small ally or lobbed shot ahead (Bumble Queen, Damselfly Dancer)',
    kind: 'insect',
  },
  {
    type: 'place_ladder',
    label: 'Place ladder',
    hint: 'Deploy a ladder on the blocking plant (Ant Builder)',
    kind: 'insect',
  },
  {
    type: 'aerial_drop',
    label: 'Aerial drop',
    hint: 'Pick a plant cell and drop from the sky onto it (Silk Snatcher)',
    kind: 'insect',
  },
  {
    type: 'aerial_aim',
    label: 'Aerial aim',
    hint: 'Hang and aim while locked onto a plant (Silk Snatcher)',
    kind: 'insect',
  },
  {
    type: 'steal_plant',
    label: 'Steal plant',
    hint: 'Grab the plant underfoot and lift it away (Silk Snatcher). Blocked by Canopy Leaf.',
    kind: 'insect',
  },
  {
    type: 'apply_freeze',
    label: 'Apply freeze',
    hint: 'Freeze or chill targets in the blast or on contact (Frost Bloom, Pebble Beetle roll)',
  },
  {
    type: 'smash_plant',
    label: 'Smash plant',
    hint: 'Instantly destroy the plant being chewed (Bumble Queen smash)',
    kind: 'insect',
  },
  {
    type: 'heal_ally',
    label: 'Heal ally',
    hint: 'Heal the most damaged nearby plant (Nectar Nurse)',
    kind: 'plant',
  },
  {
    type: 'buff_attack_speed',
    label: 'Buff attack speed',
    hint: 'Briefly speed up nearby plants (Drum Gourd / Compass Fern)',
    kind: 'plant',
  },
  {
    type: 'knockback_insects',
    label: 'Knockback insects',
    hint: 'Push insects in this lane back a set number of cells and deal damage. They keep walking. Can be limited to unequipped insects and every Nth attack.',
    kind: 'plant',
  },
  {
    type: 'grant_shield',
    label: 'Grant shield',
    hint: 'Give this plant and the plant behind it a temporary absorb shield (Bubble Aloe)',
    kind: 'plant',
  },
  {
    type: 'sip_economy',
    label: 'Sip economy',
    hint: 'Temporarily reduce an economy plant’s production (Aphid Nibbler)',
    kind: 'insect',
  },
  {
    type: 'summon_temp_plant',
    label: 'Summon temp plant',
    hint: 'Spawn a short-lived ally sprout ahead in the lane (Seedling Swarm / Dandelion Courier)',
    kind: 'plant',
  },
  {
    type: 'brace',
    label: 'Brace',
    hint: 'Temporarily reduce incoming damage (Ironwood Guard / Snail Shellback)',
  },
  {
    type: 'chain_damage',
    label: 'Chain damage',
    hint: 'Jump damage across nearby insects (Peppercoil)',
    kind: 'plant',
  },
  {
    type: 'leave_slick',
    label: 'Leave slick',
    hint: 'Leave a short slow trail in this lane (Slug Slimer)',
    kind: 'insect',
  },
  {
    type: 'reduce_ally_cooldown',
    label: 'Reduce ally cooldown',
    hint: 'Shorten nearby plants’ attack timers (Clockvine)',
    kind: 'plant',
  },
  {
    type: 'pull_insect',
    label: 'Pull insect',
    hint: 'Pull a light insect toward this plant (Cattail Harpooner)',
    kind: 'plant',
  },
  {
    type: 'apply_slow',
    label: 'Apply slow',
    hint: 'Slow insects in a small area (Mint Mist / Velcro hooks)',
    kind: 'plant',
  },
  {
    type: 'buff_move_speed',
    label: 'Buff move speed',
    hint: 'Briefly speed up nearby insects (Bumblebee Buzzer / Glowworm Trail)',
    kind: 'insect',
  },
  {
    type: 'weaken_attack',
    label: 'Weaken attack',
    hint: 'Delay nearby plant attacks or soften insect damage (Cricket Chirper / Spore Lantern)',
  },
];

/** Absolute overrides applied while the unit remains in this status. */
export interface StateStatModifiers {
  attackIntervalMs?: number;
  moveSpeed?: number;
  range?: number;
  /**
   * Fraction of the unit clipped below the waterline (0 = fully above, 1 = fully under).
   * Prefer `attributeDuration('extra.underwaterClipHeight')` so Extra attributes drive the value.
   * Cleared on status exit. Used by pool / snorkel visuals.
   */
  underwaterClipHeight?: StateDurationValue;
  /**
   * Fraction of the unit clipped below the ground line (0 = fully above, 1 = fully under).
   * Prefer `attributeDuration('extra.undergroundClipHeight')`. Same clip method as snorkel,
   * but the plane is the authored sprite/cell bottom instead of the pool waterline.
   */
  undergroundClipHeight?: StateDurationValue;
}

export interface EntityStateNode {
  id: string;
  status: EntityGraphStatus;
  /** Optional editor label; defaults to status name. */
  label?: string;
  /**
   * Spine animation while in this status.
   * When the unit has equipment, this is the **with-equipment** clip.
   * Units without equipment (or after armor break) use {@link spineAnimUnarmed} when set.
   * Ignored for {@link isTemporalStatus temporal} nodes (never play a clip).
   */
  spineAnim?: string;
  /**
   * Spine clip after equipment is lost (bucket / cone / door / balloon).
   * Omit when the status uses the same clip with or without equipment.
   * Ignored for temporal nodes.
   */
  spineAnimUnarmed?: string;
  /** Defaults from status catalog when omitted. Temporal nodes always loop (hold). */
  loop?: boolean;
  /**
   * @deprecated Prefer {@link spineAnim} + {@link spineAnimUnarmed} on one node.
   * When true/false, this node is only matched while equipment is present/absent
   * (legacy dual-node graphs). Omit for always-available nodes.
   */
  requiresEquipment?: boolean;
  modifiers?: StateStatModifiers;
  /**
   * Predefined engine actions run while / around this status.
   * Temporal nodes never run actions (stripped on normalize).
   */
  actions?: StateAction[];
  /** Canvas position in the status graph editor. */
  position: { x: number; y: number };
}

/** Bidirectional handle on the left or right of a status node. */
export type StateGraphPortSide = 'left' | 'right';

export interface StateGraphPortRef {
  side: StateGraphPortSide;
  /** 0-based slot along that side (top → bottom). */
  index: number;
}

export interface EntityStateEdge {
  id: string;
  from: string;
  to: string;
  /** All conditions must be true (AND) to take this transition. */
  conditions: StateCondition[];
  /**
   * Editor port anchors (bidirectional). Optional — runtime ignores these;
   * the graph editor uses them to avoid crossed wires.
   */
  fromPort?: StateGraphPortRef;
  toPort?: StateGraphPortRef;
}

/** Always-on death config — not an edged status. */
export interface EntityDieConfig {
  /** Normal death clip (HP depleted by bullets, bites, etc.). */
  spineAnim?: string;
  /** Death clip when killed by an explode blast (Cherry Bomb, Jalapeno, mine, …). */
  explodeSpineAnim?: string;
  /** Normal death after equipment is gone (bucket / cone / door). */
  spineAnimUnarmed?: string;
  /** Explode death after equipment is gone. */
  explodeSpineAnimUnarmed?: string;
}

export interface EntityStateGraph {
  version: 1;
  entryNodeId: string;
  nodes: EntityStateNode[];
  edges: EntityStateEdge[];
  die: EntityDieConfig;
}

let _seq = 0;
function nid(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

export function createStateNodeId(): string {
  return nid('n');
}

export function createStateEdgeId(): string {
  return nid('e');
}

export function statusCatalog(kind: EntityGraphKind) {
  return kind === 'plant' ? PLANT_GRAPH_STATUSES : INSECT_GRAPH_STATUSES;
}

export function defaultLoopForStatus(kind: EntityGraphKind, status: EntityGraphStatus): boolean {
  const row = statusCatalog(kind).find((s) => s.id === status);
  return row?.defaultLoop ?? false;
}

export function defaultActionWhen(node: Pick<EntityStateNode, 'spineAnim' | 'loop'>): StateActionWhen {
  if (node.spineAnim?.trim() && node.loop === false) return 'after_anim';
  return 'on_enter';
}

export function createEmptyStateGraph(kind: EntityGraphKind): EntityStateGraph {
  const entryStatus = kind === 'plant' ? 'idle' : 'walk';
  const entryId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: entryId,
    nodes: [
      {
        id: entryId,
        status: entryStatus,
        loop: true,
        position: { x: 80, y: 160 },
      },
    ],
    edges: [],
    die: {},
  };
}

function cond(...conditions: StateCondition[]): StateCondition[] {
  return conditions;
}

/** Classic shooter: idle ↔ attack. Fire when in range and cooldown ready. */
export function createShooterStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const hasAttackAnim = Boolean(opts?.attackAnim?.trim());
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'fire_bullet', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
          { type: 'reset_attack_timer', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: hasAttackAnim
          ? cond({ type: 'anim_ended' })
          : cond({ type: 'after_seconds', value: literalDuration(0) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Squash-style: idle → aim → attack (crush) → despawn. */
export function createAimAttackStateGraph(opts?: {
  idleAnim?: string;
  aimAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const aimId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 60, y: 160 },
      },
      {
        id: aimId,
        status: 'aim',
        spineAnim: opts?.aimAnim,
        loop: false,
        position: { x: 280, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          {
            type: 'squash_crush',
            when: 'after_anim',
            crushStyle: 'hop',
            splashColumnRange: attributeDuration('extra.splashColumnRange'),
            splashLaneRange: attributeDuration('extra.splashLaneRange'),
          },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 500, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: aimId,
        conditions: cond({ type: 'enemy_in_range' }),
      },
      {
        id: createStateEdgeId(),
        from: aimId,
        to: attackId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Cherry Bomb / Jalapeno: idle → attack (explode). */
export function createInstantExplodeStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  delaySeconds?: number;
  /** When true, delay reads extra.detonateDelaySeconds instead of a literal. */
  delayFromExtra?: boolean;
  /** Explode visual style (default boom). */
  vfxStyle?: ExplodeVfxStyle;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const delay = opts?.delaySeconds ?? 0.65;
  const delayValue = opts?.delayFromExtra
    ? attributeDuration('extra.detonateDelaySeconds')
    : literalDuration(delay);
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          {
            type: 'explode',
            when: 'after_anim',
            columnRange: attributeDuration('extra.triggerColumnRange'),
            laneRange: attributeDuration('extra.triggerLaneRange'),
            vfxStyle: opts?.vfxStyle ?? 'boom',
          },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'after_seconds', value: delayValue }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/**
 * Ice-shroom: brief wind-up, then freeze the board and despawn.
 * Uses `apply_freeze` (not `explode`) — classic PvZ ice blast.
 */
export function createIceShroomStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  delaySeconds?: number;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const delay = opts?.delaySeconds ?? 0.5;
  const hasAttackAnim = Boolean(opts?.attackAnim?.trim());
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim ?? opts?.idleAnim,
        loop: false,
        actions: [
          {
            type: 'apply_freeze',
            when: hasAttackAnim ? 'after_anim' : 'on_enter',
            freezeDuration: attributeDuration('extra.freezeDurationSeconds'),
            chillDuration: attributeDuration('extra.chillDurationSeconds'),
          },
          { type: 'despawn', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(delay) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Chomper: idle → attack → digest → idle. */
export function createChomperStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  digestAnim?: string;
  dieAnim?: string;
  /** @deprecated Prefer extra.digestSeconds on the plant; edge uses attribute by default. */
  digestSeconds?: number;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const digestId = createStateNodeId();
  const digestDuration: StateDurationValue =
    opts?.digestSeconds !== undefined
      ? literalDuration(opts.digestSeconds)
      : attributeDuration('extra.digestSeconds');
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 60, y: 120 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [{ type: 'chomp_devour', when: 'after_anim' }],
        position: { x: 300, y: 120 },
      },
      {
        id: digestId,
        status: 'digest',
        spineAnim: opts?.digestAnim,
        loop: true,
        modifiers: { attackIntervalMs: 999999 },
        position: { x: 540, y: 120 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: digestId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: digestId,
        to: idleId,
        conditions: cond({ type: 'after_seconds', value: digestDuration }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Insect lane walker: Idle (entry) ↔ Walk ↔ Attack (general insect flow). */
export function createInsectWalkerStateGraph(opts?: {
  idleAnim?: string;
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  dieExplodeAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const cooldownId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 200 },
      },
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 320, y: 80 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 560, y: 200 },
      },
      {
        id: cooldownId,
        status: 'temporal',
        label: 'Attack cooldown',
        loop: true,
        position: { x: 560, y: 360 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: walkId,
        conditions: cond({ type: 'no_enemy_in_range' }),
      },
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: cooldownId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: cooldownId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: cooldownId,
        to: idleId,
        conditions: cond({ type: 'no_enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
    ],
    die: {
      spineAnim: opts?.dieAnim,
      explodeSpineAnim: opts?.dieExplodeAnim || opts?.dieAnim,
    },
  };
}

/**
 * Armored walker (Bucket Weevil, cone, screen-door, …): one node per status with
 * optional dual clips — `spineAnim` (equipped) + `spineAnimUnarmed` (bare).
 * Runtime picks the clip from current equipment; armor break refreshes playback.
 */
export function createInsectArmoredWalkerStateGraph(opts?: {
  idleAnim?: string;
  walkArmedAnim?: string;
  walkUnarmedAnim?: string;
  attackArmedAnim?: string;
  attackUnarmedAnim?: string;
  dieArmedAnim?: string;
  dieUnarmedAnim?: string;
  dieExplodeArmedAnim?: string;
  dieExplodeUnarmedAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const cooldownId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        label: 'Idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 200 },
      },
      {
        id: walkId,
        status: 'walk',
        label: 'Walk',
        spineAnim: opts?.walkArmedAnim,
        spineAnimUnarmed: opts?.walkUnarmedAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 320, y: 80 },
      },
      {
        id: attackId,
        status: 'attack',
        label: 'Attack',
        spineAnim: opts?.attackArmedAnim,
        spineAnimUnarmed: opts?.attackUnarmedAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 560, y: 200 },
      },
      {
        id: cooldownId,
        status: 'temporal',
        label: 'Attack cooldown',
        loop: true,
        position: { x: 560, y: 360 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: walkId,
        conditions: cond({ type: 'no_enemy_in_range' }),
      },
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: cooldownId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: cooldownId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: cooldownId,
        to: idleId,
        conditions: cond({ type: 'no_enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
    ],
    die: {
      spineAnim: opts?.dieArmedAnim,
      spineAnimUnarmed: opts?.dieUnarmedAnim,
      explodeSpineAnim: opts?.dieExplodeArmedAnim || opts?.dieArmedAnim,
      explodeSpineAnimUnarmed: opts?.dieExplodeUnarmedAnim || opts?.dieUnarmedAnim,
    },
  };
}

/** Idle-only / passive plants (blockers, pads, aura supports). */
export function createIdleOnlyStateGraph(opts?: {
  idleAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
    ],
    edges: [],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Sunflower family: idle ↔ produce. */
export function createProducerStateGraph(opts?: {
  idleAnim?: string;
  produceAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const produceId = createStateNodeId();
  const hasProduceAnim = Boolean(opts?.produceAnim?.trim());
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: produceId,
        status: 'produce',
        spineAnim: opts?.produceAnim,
        loop: false,
        actions: [
          { type: 'produce_sun', when: hasProduceAnim ? 'after_anim' : 'on_enter' },
          { type: 'reset_attack_timer', when: hasProduceAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: produceId,
        conditions: cond({
          type: 'after_seconds',
          value: attributeDuration('extra.produceIntervalSeconds'),
        }),
      },
      {
        id: createStateEdgeId(),
        from: produceId,
        to: idleId,
        conditions: hasProduceAnim
          ? cond({ type: 'anim_ended' })
          : cond({ type: 'after_seconds', value: literalDuration(0) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Potato Mine: init → armed → attack (explode). */
export function createArmedTrapStateGraph(opts?: {
  idleAnim?: string;
  initAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const initId = createStateNodeId();
  const armedId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: initId,
    nodes: [
      {
        id: initId,
        status: 'init',
        spineAnim: opts?.initAnim,
        loop: false,
        position: { x: 40, y: 160 },
      },
      {
        id: armedId,
        status: 'armed',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 280, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'explode', when: 'after_anim', columnRange: attributeDuration('extra.triggerColumnRange'), laneRange: attributeDuration('extra.triggerLaneRange') },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 520, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: initId,
        to: armedId,
        conditions: cond({ type: 'prepare_complete' }),
      },
      {
        id: createStateEdgeId(),
        from: armedId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Spikeweed / Spikerock: idle ↔ attack contact DPS. */
export function createContactDamageStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const hasAttackAnim = Boolean(opts?.attackAnim?.trim());
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'deal_contact_damage', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
          { type: 'reset_attack_timer', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: hasAttackAnim
          ? cond({ type: 'anim_ended' })
          : cond({ type: 'after_seconds', value: literalDuration(0) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Scaredy-shroom: hide when close, otherwise shoot. */
export function createScaredyStateGraph(opts?: {
  idleAnim?: string;
  hideAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const hideId = createStateNodeId();
  const attackId = createStateNodeId();
  const hasAttackAnim = Boolean(opts?.attackAnim?.trim());
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 200 },
      },
      {
        id: hideId,
        status: 'hide',
        spineAnim: opts?.hideAnim ?? opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 40 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'fire_bullet', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
          { type: 'reset_attack_timer', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 360, y: 200 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: hideId,
        conditions: cond({ type: 'enemy_in_proximity' }),
      },
      {
        id: createStateEdgeId(),
        from: hideId,
        to: idleId,
        conditions: cond({ type: 'no_enemy_in_proximity' }),
      },
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond(
          { type: 'enemy_in_range' },
          { type: 'no_enemy_in_proximity' },
          { type: 'attack_interval_ready' },
        ),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: hasAttackAnim
          ? cond({ type: 'anim_ended' })
          : cond({ type: 'after_seconds', value: literalDuration(0) }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: hideId,
        conditions: cond({ type: 'enemy_in_proximity' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Cob Cannon: reload → armed, then manual (human) or auto (AI) fire. */
export function createPlayerCommandStateGraph(opts?: {
  idleAnim?: string;
  armedAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const reloadId = createStateNodeId();
  const armedId = createStateNodeId();
  const attackId = createStateNodeId();
  const hasAttackAnim = Boolean(opts?.attackAnim?.trim());
  const reloadAnim = opts?.idleAnim;
  const armedAnim = opts?.armedAnim?.trim() ? opts.armedAnim : opts?.idleAnim;
  return {
    version: 1,
    entryNodeId: reloadId,
    nodes: [
      {
        id: reloadId,
        status: 'idle',
        spineAnim: reloadAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: armedId,
        status: 'armed',
        spineAnim: armedAnim,
        loop: true,
        position: { x: 280, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'fire_bullet', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
          { type: 'reset_attack_timer', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 480, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: reloadId,
        to: armedId,
        conditions: cond({ type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: armedId,
        to: attackId,
        conditions: cond({ type: 'player_controlled' }, { type: 'player_command' }),
      },
      {
        id: createStateEdgeId(),
        from: armedId,
        to: attackId,
        conditions: cond({ type: 'ai_controlled' }, { type: 'enemy_in_range' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: reloadId,
        conditions: hasAttackAnim
          ? cond({ type: 'anim_ended' })
          : cond({ type: 'after_seconds', value: literalDuration(0) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Garlic: redirect when bitten. */
export function createGarlicStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [{ type: 'redirect_lane', when: 'on_enter' }],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'being_bitten' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Hypno-shroom: charm on bite, then despawn. */
export function createHypnoStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'charm_insect', when: 'on_enter' },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'being_bitten' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Magnet-shroom: pull metal when in range, hold it on the plant, then digest. */
export function createMagnetStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  holdAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const holdId = createStateNodeId();
  const hasAttackAnim = Boolean(opts?.attackAnim?.trim());
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'steal_metal', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
        ],
        position: { x: 320, y: 160 },
      },
      {
        id: holdId,
        status: 'digest',
        label: 'Hold metal',
        spineAnim: opts?.holdAnim ?? opts?.idleAnim,
        loop: true,
        actions: [{ type: 'digest_metal', when: 'on_exit' }],
        position: { x: 560, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'metal_in_range' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: holdId,
        conditions: hasAttackAnim
          ? cond({ type: 'anim_ended' }, { type: 'holding_metal' })
          : cond(
              { type: 'after_seconds', value: literalDuration(0.05) },
              { type: 'holding_metal' },
            ),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: hasAttackAnim
          ? cond({ type: 'anim_ended' }, { type: 'no_holding_metal' })
          : cond(
              { type: 'after_seconds', value: literalDuration(0.35) },
              { type: 'no_holding_metal' },
            ),
      },
      {
        id: createStateEdgeId(),
        from: holdId,
        to: idleId,
        conditions: cond({
          type: 'after_seconds',
          value: attributeDuration('extra.magnetHoldSeconds'),
        }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Egg Eater: destroy dirty egg group after short chew. */
export function createEggEaterStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  chewSeconds?: number;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const chew = opts?.chewSeconds ?? 3;
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'digest',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'destroy_egg_group', when: 'after_anim' },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(chew) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Tangle Kelp / one-shot melee consume. */
export function createMeleeConsumeStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: idleId,
    nodes: [
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.idleAnim,
        loop: true,
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          {
            type: 'squash_crush',
            when: 'after_anim',
            crushStyle: 'pull_under',
            splashColumnRange: attributeDuration('extra.splashColumnRange'),
            splashLaneRange: attributeDuration('extra.splashLaneRange'),
          },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Dive Skimmer: swim submerged → surface to bite → re-submerge. */
export function createDiveStateGraph(opts?: {
  swimAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const swimId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: swimId,
    nodes: [
      {
        id: swimId,
        status: 'swim',
        spineAnim: opts?.swimAnim,
        loop: true,
        modifiers: {
          underwaterClipHeight: attributeDuration('extra.underwaterClipHeight'),
        },
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        // Surface (head up) while biting — literal override of the swim extra.
        modifiers: { underwaterClipHeight: literalDuration(0) },
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: swimId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: swimId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Flyer with balloon equipment: fly until armor_broken / balloon lost, then walk ↔ attack. */
export function createInsectFlyerStateGraph(opts?: {
  flyAnim?: string;
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const flyId = createStateNodeId();
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const groundAnim = opts?.walkAnim ?? opts?.flyAnim;
  return {
    version: 1,
    entryNodeId: flyId,
    nodes: [
      {
        id: flyId,
        status: 'fly',
        spineAnim: opts?.flyAnim,
        loop: true,
        actions: [
          { type: 'enter_fly', when: 'on_enter' },
          { type: 'start_moving', when: 'on_enter' },
        ],
        position: { x: 80, y: 200 },
      },
      {
        id: walkId,
        status: 'walk',
        spineAnim: groundAnim,
        loop: true,
        actions: [
          { type: 'exit_fly', when: 'on_enter' },
          { type: 'start_moving', when: 'on_enter' },
        ],
        position: { x: 80, y: 40 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 120 },
      },
    ],
    edges: [
      // Balloon / equipment lost → land and walk on the ground.
      {
        id: createStateEdgeId(),
        from: flyId,
        to: walkId,
        conditions: cond({ type: 'armor_broken' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Vaulting insect: walk → vault once when plant ahead, then walk ↔ attack. */
export function createInsectVaultStateGraph(opts?: {
  walkAnim?: string;
  vaultAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const vaultId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 200 },
      },
      {
        id: vaultId,
        status: 'vault',
        spineAnim: opts?.vaultAnim ?? opts?.walkAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'vault_over_plant', when: 'after_anim' },
        ],
        position: { x: 80, y: 40 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 200 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: walkId,
        to: vaultId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'vault_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: vaultId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Burrower: underground clip to first column → emerge → wait → reverse-walk ↔ attack. */
export function createInsectBurrowStateGraph(opts?: {
  burrowAnim?: string;
  emergeAnim?: string;
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const burrowId = createStateNodeId();
  const emergeId = createStateNodeId();
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: burrowId,
    nodes: [
      {
        id: burrowId,
        status: 'burrow',
        spineAnim: opts?.burrowAnim ?? opts?.walkAnim,
        loop: true,
        modifiers: {
          undergroundClipHeight: attributeDuration('extra.undergroundClipHeight'),
        },
        actions: [
          { type: 'enter_burrow', when: 'on_enter' },
          { type: 'start_moving', when: 'on_enter' },
        ],
        position: { x: 40, y: 160 },
      },
      {
        id: emergeId,
        status: 'emerge',
        spineAnim: opts?.emergeAnim ?? opts?.walkAnim,
        loop: true,
        // Literal 0 eases the clip off like snorkel surfacing.
        modifiers: { undergroundClipHeight: literalDuration(0) },
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'exit_burrow', when: 'on_enter' },
          // Turn once when leaving emerge — not on every walk re-enter.
          { type: 'reverse_march', when: 'on_exit' },
        ],
        position: { x: 260, y: 160 },
      },
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 480, y: 200 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 480, y: 40 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: burrowId,
        to: emergeId,
        conditions: cond({ type: 'reached_target' }),
      },
      {
        id: createStateEdgeId(),
        from: emergeId,
        to: walkId,
        conditions: cond({
          type: 'after_seconds',
          value: attributeDuration('extra.emergeWaitSeconds'),
        }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Newspaper-style: walk ↔ attack, enrage after armor break. */
export function createInsectEnrageStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  enrageAnim?: string;
  dieAnim?: string;
  enrageMoveSpeed?: number;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const enrageId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 200 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 200 },
      },
      {
        id: enrageId,
        status: 'enrage',
        spineAnim: opts?.enrageAnim ?? opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        modifiers: { moveSpeed: opts?.enrageMoveSpeed ?? 0.55 },
        position: { x: 80, y: 40 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: enrageId,
        conditions: cond({ type: 'anim_ended' }, { type: 'armor_broken' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: enrageId,
        conditions: cond({ type: 'armor_broken' }),
      },
      {
        id: createStateEdgeId(),
        from: enrageId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Surprise-flea style: walk then explode. */
export function createInsectExplodeStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  fuseSeconds?: number;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const fuse = opts?.fuseSeconds ?? 8;
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 160 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'explode', when: 'after_anim' },
          { type: 'despawn', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(fuse) }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Dancing Firefly: walk ↔ attack, periodic summon. */
export function createInsectSummonStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  summonSeconds?: number;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const summonId = createStateNodeId();
  const summonSeconds = opts?.summonSeconds ?? 12;
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 200 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 200 },
      },
      {
        id: summonId,
        status: 'summon',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'summon_insect', when: 'after_anim' },
        ],
        position: { x: 360, y: 40 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: summonId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(summonSeconds) }),
      },
      {
        id: createStateEdgeId(),
        from: summonId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/**
 * Lobber insect (Catapult Aphid) — matches PvZ Catapult Zombie cadence:
 * drive until a plant is in range, stop, lob, idle-reload (~attackIntervalMs),
 * lob again; only resume walking when the lane is clear.
 */
export function createInsectCatapultStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const idleId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 200 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          // Fire on enter (like Cabbage-pult) so missing Spine clips still honor attackIntervalMs.
          { type: 'fire_bullet', when: 'on_enter' },
          { type: 'reset_attack_timer', when: 'on_enter' },
        ],
        position: { x: 360, y: 80 },
      },
      {
        id: idleId,
        status: 'idle',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'stop_moving', when: 'on_enter' }],
        position: { x: 360, y: 240 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: cond({
          type: 'after_seconds',
          value: { kind: 'literal', seconds: 0.05 },
        }),
      },
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: idleId,
        to: walkId,
        conditions: cond({ type: 'no_enemy_in_range' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Colossus: walk ↔ attack (smash), throw Imp when health low (priority over smash). */
export function createInsectThrowStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  throwHealthRatio?: number;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const throwId = createStateNodeId();
  const ratio = opts?.throwHealthRatio ?? 0.5;
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 200 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'smash_plant', when: 'after_anim' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 200 },
      },
      {
        id: throwId,
        status: 'throw',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          // Release mid-windup so the Imp arc is the visible throw (classic ~74% of anim).
          { type: 'throw_unit', when: 'on_enter' },
        ],
        position: { x: 360, y: 40 },
      },
    ],
    edges: [
      // Throw has priority over smash when HP is low (classic UpdateZombieColossus order).
      {
        id: createStateEdgeId(),
        from: walkId,
        to: throwId,
        conditions: cond({ type: 'health_below', ratio }, { type: 'throw_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: throwId,
        to: walkId,
        conditions: cond({
          type: 'after_seconds',
          value: { kind: 'literal', seconds: 0.85 },
        }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** Ladder ant: walk → place ladder on plant, else attack. */
export function createInsectLadderStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const ladderId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: walkId,
    nodes: [
      {
        id: walkId,
        status: 'walk',
        spineAnim: opts?.walkAnim,
        loop: true,
        actions: [{ type: 'start_moving', when: 'on_enter' }],
        position: { x: 80, y: 200 },
      },
      {
        id: ladderId,
        status: 'special',
        label: 'Place ladder',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'place_ladder', when: 'after_anim' },
        ],
        position: { x: 360, y: 40 },
      },
      {
        id: attackId,
        status: 'attack',
        spineAnim: opts?.attackAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 200 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: walkId,
        to: ladderId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'special_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: ladderId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
      {
        id: createStateEdgeId(),
        from: walkId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** @deprecated Use {@link createDiveStateGraph}. */
export const createSnorkelStateGraph = createDiveStateGraph;

/** Drop Spider: drop onto a plant → aim / hang → steal upward (or leave empty-handed). */
export function createInsectAerialStealStateGraph(opts?: {
  flyAnim?: string;
  aimAnim?: string;
  stealAnim?: string;
  dieAnim?: string;
  aimSeconds?: number;
}): EntityStateGraph {
  const dropId = createStateNodeId();
  const aimId = createStateNodeId();
  const stealId = createStateNodeId();
  const aimSeconds = opts?.aimSeconds ?? 2.5;
  const flyAnim = opts?.flyAnim;
  const aimAnim = opts?.aimAnim ?? opts?.flyAnim;
  const stealAnim = opts?.stealAnim ?? opts?.flyAnim;
  return {
    version: 1,
    entryNodeId: dropId,
    nodes: [
      {
        id: dropId,
        status: 'fly',
        label: 'Drop',
        spineAnim: flyAnim,
        loop: true,
        actions: [
          { type: 'enter_fly', when: 'on_enter' },
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'aerial_drop', when: 'on_enter' },
        ],
        position: { x: 40, y: 200 },
      },
      {
        id: aimId,
        status: 'aim',
        label: 'Aim / hang',
        spineAnim: aimAnim,
        loop: true,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'aerial_aim', when: 'on_enter' },
        ],
        position: { x: 240, y: 200 },
      },
      {
        id: stealId,
        status: 'special',
        label: 'Steal plant',
        spineAnim: stealAnim,
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'steal_plant', when: 'on_enter' },
        ],
        position: { x: 440, y: 200 },
      },
    ],
    edges: [
      // Drop anim holds placement; once Update resumes, settle into aim.
      {
        id: createStateEdgeId(),
        from: dropId,
        to: aimId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(0.05) }),
      },
      // Drop Spider is flying (SkipsPlantContact), so do not gate on enemy_in_range —
      // steal_plant resolves the plant underfoot (or retreats empty-handed).
      {
        id: createStateEdgeId(),
        from: aimId,
        to: stealId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(aimSeconds) }),
      },
    ],
    die: { spineAnim: opts?.dieAnim },
  };
}

/** @deprecated Use {@link createInsectAerialStealStateGraph}. */
export const createInsectBungeeStateGraph = createInsectAerialStealStateGraph;

/** Mirror flat legacy clip fields from the graph for older readers. */
export function mirrorPlantClipsFromGraph(graph: EntityStateGraph): {
  idle: string;
  attack?: string;
  aim?: string;
  init?: string;
  die?: string;
  dieExplode?: string;
} {
  const nodes = graph?.nodes ?? [];
  const byStatus = (s: EntityGraphStatus) =>
    nodes.find((n) => n?.status === s)?.spineAnim?.trim() || undefined;
  const idle =
    byStatus('idle') ||
    nodes.find((n) => n?.id === graph?.entryNodeId)?.spineAnim?.trim() ||
    '';
  return {
    idle,
    attack: byStatus('attack'),
    aim: byStatus('aim'),
    init: byStatus('init'),
    die: graph?.die?.spineAnim?.trim() || undefined,
    dieExplode: graph?.die?.explodeSpineAnim?.trim() || undefined,
  };
}

export function mirrorInsectClipsFromGraph(graph: EntityStateGraph): {
  idle?: string;
  walk: string;
  attack?: string;
  die?: string;
  dieExplode?: string;
} {
  const nodes = graph?.nodes ?? [];
  const byStatus = (s: EntityGraphStatus) =>
    nodes.find((n) => n?.status === s)?.spineAnim?.trim() || undefined;
  const walk =
    byStatus('walk') ||
    nodes.find((n) => n?.id === graph?.entryNodeId)?.spineAnim?.trim() ||
    '';
  return {
    idle: byStatus('idle'),
    walk,
    attack: byStatus('attack'),
    die: graph?.die?.spineAnim?.trim() || byStatus('die') || undefined,
    dieExplode: graph?.die?.explodeSpineAnim?.trim() || undefined,
  };
}

/**
 * Build a graph from legacy flat clip fields when stateGraph is missing.
 */
export function migratePlantClientToGraph(client: {
  idle?: string;
  attack?: string;
  aim?: string;
  init?: string;
  die?: string;
}): EntityStateGraph {
  if (client.aim && client.attack) {
    return createAimAttackStateGraph({
      idleAnim: client.idle,
      aimAnim: client.aim,
      attackAnim: client.attack,
      dieAnim: client.die,
    });
  }
  if (client.init) {
    return createArmedTrapStateGraph({
      idleAnim: client.idle,
      initAnim: client.init,
      attackAnim: client.attack,
      dieAnim: client.die,
    });
  }
  if (client.attack) {
    return createShooterStateGraph({
      idleAnim: client.idle,
      attackAnim: client.attack,
      dieAnim: client.die,
    });
  }
  const g = createEmptyStateGraph('plant');
  g.nodes[0].spineAnim = client.idle;
  g.die = { spineAnim: client.die };
  return g;
}

export function migrateInsectClientToGraph(client: {
  idle?: string;
  walk?: string;
  attack?: string;
  die?: string;
  dieExplode?: string;
}): EntityStateGraph {
  return createInsectWalkerStateGraph({
    idleAnim: client.idle || client.walk,
    walkAnim: client.walk,
    attackAnim: client.attack,
    dieAnim: client.die,
    dieExplodeAnim: client.dieExplode || client.die,
  });
}

const ACTION_ALIASES: Record<string, StateActionKind> = {
  launch_bullet: 'fire_bullet',
  destroy_grave: 'destroy_egg_group',
  fire_bullet: 'fire_bullet',
  begin_charge: 'begin_charge',
  deal_contact_damage: 'deal_contact_damage',
  deal_area_damage: 'deal_area_damage',
  squash_crush: 'squash_crush',
  chomp_devour: 'chomp_devour',
  explode: 'explode',
  produce_sun: 'produce_sun',
  clear_fog: 'clear_fog',
  light_fog: 'clear_fog',
  clear_all_fog: 'clear_all_fog',
  blow_fog: 'clear_all_fog',
  blow_away_flying: 'blow_away_flying',
  kill_flying: 'blow_away_flying',
  blow_away: 'blow_away',
  despawn: 'despawn',
  reset_attack_timer: 'reset_attack_timer',
  stop_moving: 'stop_moving',
  start_moving: 'start_moving',
  vault_over_plant: 'vault_over_plant',
  enter_burrow: 'enter_burrow',
  exit_burrow: 'exit_burrow',
  reverse_march: 'reverse_march',
  enter_fly: 'enter_fly',
  exit_fly: 'exit_fly',
  redirect_lane: 'redirect_lane',
  charm_insect: 'charm_insect',
  steal_metal: 'steal_metal',
  digest_metal: 'digest_metal',
  destroy_egg_group: 'destroy_egg_group',
  leave_crater: 'leave_crater',
  summon_insect: 'summon_insect',
  throw_unit: 'throw_unit',
  place_ladder: 'place_ladder',
  steal_plant: 'steal_plant',
  aerial_drop: 'aerial_drop',
  aerial_aim: 'aerial_aim',
  bungee_drop: 'aerial_drop',
  bungee_aim: 'aerial_aim',
  apply_freeze: 'apply_freeze',
  smash_plant: 'smash_plant',
  heal_ally: 'heal_ally',
  buff_attack_speed: 'buff_attack_speed',
  knockback_insects: 'knockback_insects',
  grant_shield: 'grant_shield',
  sip_economy: 'sip_economy',
  summon_temp_plant: 'summon_temp_plant',
  brace: 'brace',
  chain_damage: 'chain_damage',
  leave_slick: 'leave_slick',
  reduce_ally_cooldown: 'reduce_ally_cooldown',
  pull_insect: 'pull_insect',
  apply_slow: 'apply_slow',
  buff_move_speed: 'buff_move_speed',
  weaken_attack: 'weaken_attack',
};

function normalizeAction(raw: unknown): StateAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const type = typeof a.type === 'string' ? ACTION_ALIASES[a.type] : undefined;
  if (!type) return null;
  const when =
    a.when === 'on_enter' || a.when === 'after_anim' || a.when === 'on_exit' ? a.when : undefined;
  const action: StateAction = when ? { type, when } : { type };
  const paramKeys = [
    'columnRange',
    'laneRange',
    'freezeDuration',
    'chillDuration',
    'splashColumnRange',
    'splashLaneRange',
    'knockbackCells',
    'damage',
    'knockbackEvery',
  ] as const;
  for (const key of paramKeys) {
    if (a[key] != null) {
      const parsed = normalizeDurationValue(a[key]);
      if (parsed) (action as unknown as Record<string, StateDurationValue>)[key] = parsed;
    }
  }
  if (a.unequippedOnly === true) action.unequippedOnly = true;
  if (type === 'explode') {
    const style = normalizeExplodeVfxStyle(a.vfxStyle ?? a.explodeGfx);
    if (style) action.vfxStyle = style;
  }
  if (type === 'squash_crush') {
    const crush = normalizeSquashCrushStyle(a.crushStyle ?? a.motionStyle ?? a.style);
    if (crush) action.crushStyle = crush;
  }
  return action;
}

/** Migrate old single `trigger` field into AND conditions. */
export function migrateLegacyTrigger(raw: unknown): StateCondition[] {
  if (!raw || typeof raw !== 'object') return [];
  const t = raw as { type?: string; seconds?: number; ratio?: number };
  switch (t.type) {
    case 'on_attack':
      return [{ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }];
    case 'enemy_in_range':
      return [{ type: 'enemy_in_range' }];
    case 'anim_ended':
      return [{ type: 'anim_ended' }];
    case 'after_seconds':
      return [
        {
          type: 'after_seconds',
          value: normalizeDurationValue(t),
        },
      ];
    case 'prepare_complete':
      return [{ type: 'prepare_complete' }];
    case 'on_damaged':
      return [{ type: 'on_damaged' }];
    case 'no_enemy_in_range':
      return [{ type: 'no_enemy_in_range' }];
    case 'attack_interval_ready':
      return [{ type: 'attack_interval_ready' }];
    case 'health_below':
      return [{ type: 'health_below', ratio: Number(t.ratio) || 0.5 }];
    default:
      return [];
  }
}

function normalizeCondition(raw: unknown): StateCondition | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as { type?: string; seconds?: number; ratio?: number };
  switch (c.type) {
    case 'enemy_in_range':
    case 'no_enemy_in_range':
    case 'enemy_in_proximity':
    case 'no_enemy_in_proximity':
    case 'metal_in_range':
    case 'no_metal_in_range':
    case 'holding_metal':
    case 'no_holding_metal':
    case 'has_equipment':
    case 'no_equipment':
    case 'attack_interval_ready':
    case 'anim_ended':
    case 'prepare_complete':
    case 'on_damaged':
    case 'armor_broken':
    case 'being_bitten':
    case 'player_command':
    case 'player_controlled':
    case 'ai_controlled':
    case 'vault_ready':
    case 'throw_ready':
    case 'special_ready':
    case 'reached_target':
      return { type: c.type };
    case 'after_seconds':
      return { type: 'after_seconds', value: normalizeDurationValue(c) };
    case 'health_below':
      return {
        type: 'health_below',
        ratio: Math.min(1, Math.max(0, Number(c.ratio) || 0.5)),
      };
    case 'on_attack':
      // Should be expanded by migrateLegacyTrigger; treat as interval+range if alone
      return { type: 'enemy_in_range' };
    default:
      return null;
  }
}

function normalizePort(raw: unknown): StateGraphPortRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as { side?: string; index?: number };
  if (p.side !== 'left' && p.side !== 'right') return undefined;
  const index = Number.isFinite(p.index) ? Math.max(0, Math.floor(p.index as number)) : 0;
  return { side: p.side, index };
}

export function normalizeEntityStateGraph(
  raw: unknown,
  kind: EntityGraphKind,
): EntityStateGraph | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<EntityStateGraph> & {
    edges?: Array<
      Partial<EntityStateEdge> & { trigger?: unknown; conditions?: unknown[] }
    >;
  };
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) return null;
  const nodes = g.nodes
    .filter((n) => n && typeof n.id === 'string' && typeof n.status === 'string')
    .map((n) => {
      const status = n.status as EntityGraphStatus;
      const temporal = isTemporalStatus(status);
      return {
        id: n.id,
        status,
        label: typeof n.label === 'string' ? n.label : undefined,
        spineAnim: temporal
          ? undefined
          : typeof n.spineAnim === 'string'
            ? n.spineAnim
            : undefined,
        spineAnimUnarmed: temporal
          ? undefined
          : typeof (n as EntityStateNode).spineAnimUnarmed === 'string'
            ? (n as EntityStateNode).spineAnimUnarmed
            : undefined,
        loop: temporal
          ? true
          : typeof n.loop === 'boolean'
            ? n.loop
            : defaultLoopForStatus(kind, status),
        requiresEquipment:
          typeof (n as EntityStateNode).requiresEquipment === 'boolean'
            ? (n as EntityStateNode).requiresEquipment
            : undefined,
        modifiers: temporal ? undefined : normalizeStatModifiers(n.modifiers),
        actions: temporal
          ? undefined
          : Array.isArray(n.actions)
            ? n.actions.map(normalizeAction).filter((a): a is StateAction => Boolean(a))
            : undefined,
        position: {
          x: Number.isFinite(n.position?.x) ? (n.position!.x as number) : 80,
          y: Number.isFinite(n.position?.y) ? (n.position!.y as number) : 120,
        },
      };
    });
  if (nodes.length === 0) return null;
  const collapsed = collapseLegacyEquipmentNodes(nodes);
  const playable = collapsed.filter((n) => n.status !== 'die');
  if (playable.length === 0) return null;

  const idRemap = new Map<string, string>();
  for (const n of nodes) {
    if (playable.some((p) => p.id === n.id)) continue;
    // Legacy unarmed/armed sibling removed — point edges at the kept armed/primary node.
    const keep = playable.find((p) => p.status === n.status);
    if (keep) idRemap.set(n.id, keep.id);
  }

  const edges = (Array.isArray(g.edges) ? g.edges : [])
    .filter((e) => e && typeof e.id === 'string' && typeof e.from === 'string' && typeof e.to === 'string')
    .map((e) => {
      const legacy = e as Partial<EntityStateEdge> & {
        trigger?: unknown;
        conditions?: unknown[];
        fromPort?: unknown;
        toPort?: unknown;
      };
      let conditions: StateCondition[] = [];
      if (Array.isArray(legacy.conditions) && legacy.conditions.length > 0) {
        conditions = legacy.conditions
          .map(normalizeCondition)
          .filter((c): c is StateCondition => Boolean(c));
        if (
          conditions.length === 1 &&
          (legacy.conditions[0] as { type?: string })?.type === 'on_attack'
        ) {
          conditions = migrateLegacyTrigger(legacy.conditions[0]);
        }
      } else if (legacy.trigger) {
        conditions = migrateLegacyTrigger(legacy.trigger);
      }
      // After collapsing dual armed/bare nodes, equipment gates on those edges are redundant.
      if (idRemap.size > 0) {
        conditions = conditions.filter(
          (c) => c.type !== 'has_equipment' && c.type !== 'no_equipment',
        );
      }
      const from = idRemap.get(e.from!) ?? e.from!;
      const to = idRemap.get(e.to!) ?? e.to!;
      return {
        id: e.id!,
        from,
        to,
        conditions,
        fromPort: normalizePort(legacy.fromPort),
        toPort: normalizePort(legacy.toPort),
      };
    })
    .filter(
      (e) =>
        e.conditions.length > 0 &&
        e.from !== e.to &&
        playable.some((n) => n.id === e.from) &&
        playable.some((n) => n.id === e.to),
    );

  // Deduplicate edges that became identical after remap.
  const seenEdge = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.from}->${e.to}:${e.conditions.map((c) => c.type).join('+')}`;
    if (seenEdge.has(key)) return false;
    seenEdge.add(key);
    return true;
  });

  const entryRaw =
    typeof g.entryNodeId === 'string' ? idRemap.get(g.entryNodeId) ?? g.entryNodeId : '';
  const entryNodeId =
    entryRaw && playable.some((n) => n.id === entryRaw) ? entryRaw : playable[0].id;
  const dieAnim =
    typeof g.die?.spineAnim === 'string'
      ? g.die.spineAnim
      : nodes.find((n) => n.status === 'die')?.spineAnim;
  const explodeDieAnim =
    typeof g.die?.explodeSpineAnim === 'string' ? g.die.explodeSpineAnim : undefined;
  const dieUnarmed =
    typeof g.die?.spineAnimUnarmed === 'string' ? g.die.spineAnimUnarmed : undefined;
  const explodeUnarmed =
    typeof g.die?.explodeSpineAnimUnarmed === 'string'
      ? g.die.explodeSpineAnimUnarmed
      : undefined;
  return {
    version: 1,
    entryNodeId,
    nodes: playable,
    edges: uniqueEdges,
    die: {
      spineAnim: dieAnim || undefined,
      explodeSpineAnim: explodeDieAnim?.trim() || undefined,
      spineAnimUnarmed: dieUnarmed?.trim() || undefined,
      explodeSpineAnimUnarmed: explodeUnarmed?.trim() || undefined,
    },
  };
}

/**
 * Merge legacy pairs of status nodes that only differed by `requiresEquipment`
 * into one node with `spineAnim` (armed) + `spineAnimUnarmed` (bare).
 */
function collapseLegacyEquipmentNodes(nodes: EntityStateNode[]): EntityStateNode[] {
  const byStatus = new Map<string, EntityStateNode[]>();
  for (const n of nodes) {
    const list = byStatus.get(n.status) ?? [];
    list.push(n);
    byStatus.set(n.status, list);
  }

  const out: EntityStateNode[] = [];
  for (const [, group] of byStatus) {
    const armed = group.find((n) => n.requiresEquipment === true);
    const bare = group.find((n) => n.requiresEquipment === false);
    if (armed && bare) {
      out.push({
        ...armed,
        label: armed.label?.replace(/\s*\(armed\)\s*/i, '').trim() || undefined,
        spineAnim: armed.spineAnim,
        spineAnimUnarmed: bare.spineAnim || armed.spineAnimUnarmed,
        requiresEquipment: undefined,
      });
      // Keep any extra ungated siblings for this status.
      for (const n of group) {
        if (n === armed || n === bare) continue;
        if (n.requiresEquipment == null) out.push({ ...n, requiresEquipment: undefined });
      }
      continue;
    }

    for (const n of group) {
      out.push({
        ...n,
        requiresEquipment: undefined,
        spineAnimUnarmed: n.spineAnimUnarmed,
      });
    }
  }
  return out;
}

function normalizeStatModifiers(raw: unknown): StateStatModifiers | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const out: StateStatModifiers = {};
  if (typeof m.attackIntervalMs === 'number' && Number.isFinite(m.attackIntervalMs)) {
    out.attackIntervalMs = m.attackIntervalMs;
  }
  if (typeof m.moveSpeed === 'number' && Number.isFinite(m.moveSpeed)) {
    out.moveSpeed = m.moveSpeed;
  }
  if (typeof m.range === 'number' && Number.isFinite(m.range)) {
    out.range = m.range;
  }
  if (m.underwaterClipHeight !== undefined && m.underwaterClipHeight !== null) {
    out.underwaterClipHeight = normalizeDurationValue(m.underwaterClipHeight);
  }
  if (m.undergroundClipHeight !== undefined && m.undergroundClipHeight !== null) {
    out.undergroundClipHeight = normalizeDurationValue(m.undergroundClipHeight);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeDurationValue(raw: unknown): StateDurationValue {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return literalDuration(raw);
  }
  if (!raw || typeof raw !== 'object') return literalDuration(0);
  const r = raw as {
    kind?: string;
    seconds?: number;
    path?: string;
    id?: string;
    value?: unknown;
    attribute?: string;
    constantId?: string;
  };
  // Nested value from already-normalized or new JSON
  if (r.value && typeof r.value === 'object') {
    return normalizeDurationValue(r.value);
  }
  if (r.kind === 'attribute' && typeof r.path === 'string' && r.path.trim()) {
    return attributeDuration(r.path.trim());
  }
  if (r.kind === 'constant' && typeof r.id === 'string' && r.id.trim()) {
    return constantDuration(r.id.trim());
  }
  if (r.kind === 'literal') {
    return literalDuration(Number(r.seconds) || 0);
  }
  // Legacy / shorthand fields on the condition itself
  if (typeof r.attribute === 'string' && r.attribute.trim()) {
    return attributeDuration(r.attribute.trim());
  }
  if (typeof r.constantId === 'string' && r.constantId.trim()) {
    return constantDuration(r.constantId.trim());
  }
  if (typeof r.path === 'string' && r.path.trim() && r.seconds === undefined) {
    return attributeDuration(r.path.trim());
  }
  return literalDuration(Number(r.seconds) || 0);
}

export function conditionLabel(condition: StateCondition): string {
  switch (condition.type) {
    case 'enemy_in_range':
      return 'Target in range';
    case 'no_enemy_in_range':
      return 'No target in range';
    case 'enemy_in_proximity':
      return 'Enemy in proximity';
    case 'no_enemy_in_proximity':
      return 'No enemy in proximity';
    case 'metal_in_range':
      return 'Metal in range';
    case 'no_metal_in_range':
      return 'No metal in range';
    case 'holding_metal':
      return 'Holding stolen metal';
    case 'no_holding_metal':
      return 'Not holding metal';
    case 'has_equipment':
      return 'Has equipment';
    case 'no_equipment':
      return 'No equipment';
    case 'attack_interval_ready':
      return 'Cooldown elapsed';
    case 'anim_ended':
      return 'Animation completed';
    case 'after_seconds':
      return durationLabel(condition.value);
    case 'prepare_complete':
      return 'Arming finished';
    case 'on_damaged':
      return 'Damage received';
    case 'health_below':
      return `Health < ${Math.round(condition.ratio * 100)}%`;
    case 'armor_broken':
      return 'Equipment lost';
    case 'being_bitten':
      return 'Being bitten';
    case 'player_command':
      return 'Player command';
    case 'player_controlled':
      return 'Player controlled';
    case 'ai_controlled':
      return 'AI controlled';
    case 'vault_ready':
      return 'Vault ready';
    case 'throw_ready':
      return 'Throw ready';
    case 'special_ready':
      return 'Special ready';
    case 'reached_target':
      return 'Reached march target';
    default:
      return 'Condition';
  }
}

export function conditionsLabel(conditions: StateCondition[]): string {
  if (!conditions.length) return 'No conditions';
  if (conditions.length === 1) return conditionLabel(conditions[0]);
  return conditions.map(conditionLabel).join(' + ');
}

/** @deprecated Use conditionsLabel */
export function triggerLabel(trigger: { type: string; seconds?: number }): string {
  return conditionsLabel(migrateLegacyTrigger(trigger));
}

export function defaultCondition(kind: StateConditionKind): StateCondition {
  if (kind === 'after_seconds') return { type: 'after_seconds', value: literalDuration(1) };
  if (kind === 'health_below') return { type: 'health_below', ratio: 0.5 };
  return { type: kind } as StateCondition;
}
