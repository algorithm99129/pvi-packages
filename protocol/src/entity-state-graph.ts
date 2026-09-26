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

/** Hold-only status: no Spine clip — wait on edge conditions. Engine actions are allowed. */
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
  { id: 'idle', label: 'Idle', hint: 'Label only — put resting behavior in actions if needed', defaultLoop: true },
  { id: 'init', label: 'Init', hint: 'Label for arming / setup nodes (use after_seconds + actions)', defaultLoop: false },
  { id: 'armed', label: 'Armed', hint: 'Label for primed / waiting nodes', defaultLoop: true },
  { id: 'aim', label: 'Aim', hint: 'Label for wind-up nodes (play clip + actions)', defaultLoop: false },
  {
    id: 'attack',
    label: 'Attack',
    hint: 'Label only — deal damage / fire via engine actions on this node',
    defaultLoop: false,
  },
  {
    id: 'digest',
    label: 'Digest / Hold',
    hint: 'Label for recovery / hold nodes (actions still required)',
    defaultLoop: true,
  },
  {
    id: 'hide',
    label: 'Hide',
    hint: 'Label only — add hide / enter_burrow actions for real hide or burrow',
    defaultLoop: true,
  },
  {
    id: 'produce',
    label: 'Produce',
    hint: 'Label for produce nodes — use produce_sun (or similar) actions',
    defaultLoop: false,
  },
  {
    id: 'special',
    label: 'Special',
    hint: 'Label for non-attack ability nodes — wire engine actions explicitly',
    defaultLoop: false,
  },
  {
    id: 'temporal',
    label: 'Temporal',
    hint: 'Hold with no animation; optional engine actions; exit via cooldown / after_seconds / range',
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
  { id: 'idle', label: 'Idle', hint: 'Label for standing / waiting nodes — use stop_moving if needed', defaultLoop: true },
  { id: 'walk', label: 'Walk', hint: 'Label for march nodes — use start_moving action', defaultLoop: true },
  { id: 'attack', label: 'Attack', hint: 'Label only — bite / smash via deal_contact_damage (etc.)', defaultLoop: false },
  { id: 'enrage', label: 'Enrage', hint: 'Label for post-armor-break nodes (buff via actions/modifiers)', defaultLoop: true },
  { id: 'vault', label: 'Vault', hint: 'Label for jump nodes — use vault_over_plant action', defaultLoop: false },
  {
    id: 'burrow',
    label: 'Burrow',
    hint: 'Label only — use enter_burrow action for underground / untargetable',
    defaultLoop: true,
  },
  { id: 'emerge', label: 'Emerge', hint: 'Label for surface nodes — use exit_burrow + actions', defaultLoop: false },
  { id: 'swim', label: 'Swim', hint: 'Label for pool travel nodes', defaultLoop: true },
  { id: 'fly', label: 'Fly', hint: 'Label for air nodes — use enter_fly / exit_fly actions', defaultLoop: true },
  {
    id: 'aim',
    label: 'Aim / hang',
    hint: 'Label for wind-up / hang nodes (Drop Spider)',
    defaultLoop: true,
  },
  { id: 'summon', label: 'Summon', hint: 'Label for summon nodes — use summon_insect action', defaultLoop: false },
  { id: 'throw', label: 'Throw', hint: 'Label for throw nodes — use throw_unit action', defaultLoop: false },
  { id: 'special', label: 'Special', hint: 'Label for one-shot ability nodes — wire actions explicitly', defaultLoop: false },
  {
    id: 'temporal',
    label: 'Temporal',
    hint: 'Hold with no animation; optional engine actions; exit via cooldown / after_seconds / range',
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
  | 'not_damaged_for'
  | 'damage_hits_at_least'
  | 'health_below'
  | 'health_above'
  | 'armor_broken'
  | 'chomp_killed'
  | 'no_chomp_killed'
  | 'being_bitten'
  | 'player_command'
  | 'player_controlled'
  | 'ai_controlled'
  | 'vault_ready'
  | 'throw_ready'
  | 'special_ready'
  | 'reached_target'
  | 'boomerang_returned';

export type StateCondition =
  | { type: 'enemy_in_range'; minRange?: StateDurationValue }
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
  /** True when this unit has taken no damage for at least `value` seconds. */
  | { type: 'not_damaged_for'; value: StateDurationValue }
  | { type: 'damage_hits_at_least'; value: StateDurationValue }
  | { type: 'health_below'; ratio: number }
  | { type: 'health_above'; ratio: number }
  | { type: 'armor_broken' }
  | { type: 'chomp_killed' }
  | { type: 'no_chomp_killed' }
  | { type: 'being_bitten' }
  | { type: 'player_command' }
  | { type: 'player_controlled' }
  | { type: 'ai_controlled' }
  | { type: 'vault_ready' }
  | { type: 'throw_ready' }
  | { type: 'special_ready' }
  | { type: 'reached_target' }
  | { type: 'boomerang_returned' };

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
  /** enemy_in_range: optional minimum column distance (Pinecone Mortar). */
  needsMinRange?: boolean;
}> = [
  {
    type: 'enemy_in_range',
    label: 'Target in range',
    hint:
      'A valid combat target is within attack range. Optional min range (e.g. extra.minRangeColumns) skips enemies that are too close (Pinecone Mortar).',
    needsMinRange: true,
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
    type: 'not_damaged_for',
    label: 'Not damaged for',
    hint:
      'No damage taken for at least this many seconds (Bubble Aloe idle heal). Prefer extra.healIdleSeconds.',
    needsSeconds: true,
  },
  {
    type: 'damage_hits_at_least',
    label: 'Damage hits at least',
    hint: 'Body/armor hit count since last reset (Pillbug coil after N hits). value = threshold.',
    needsSeconds: true,
  },
  {
    type: 'health_below',
    label: 'Health below threshold',
    hint: 'Current health as a fraction of max health is below the threshold',
    needsRatio: true,
  },
  {
    type: 'health_above',
    label: 'Health above threshold',
    hint: 'Current health as a fraction of max health is at or above the threshold',
    needsRatio: true,
  },
  {
    type: 'armor_broken',
    label: 'Equipment lost',
    hint: 'Assigned equipment HP hit 0 or was stolen (Magnet). Drive a bare/enrage Spine status from here — equipment art lives on the insect avatar/Spine, not a separate overlay.',
  },
  {
    type: 'chomp_killed',
    label: 'Chomp ate target',
    hint: 'Last chomp_devour killed a Light insect (set until leaving this node). Pitcher / Maw digest path.',
  },
  {
    type: 'no_chomp_killed',
    label: 'Chomp did not eat',
    hint: 'Last chomp_devour missed or only slowed a Heavy (no kill). Use for rearm without digest.',
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
  {
    type: 'boomerang_returned',
    label: 'Boomerang returned',
    hint: 'No owned boomerang projectile is still in flight (Lotus Discus — ready to throw again)',
  },
];

/**
 * Predefined engine functions. Implemented once in the runtime; graphs compose them.
 * Prefer these over per-plant C# / server branches.
 */
export type StateActionKind =
  | 'fire_bullet'
  | 'deal_contact_damage'
  | 'squash_crush'
  | 'chomp_devour'
  | 'explode'
  | 'produce_sun'
  | 'clear_fog'
  | 'reveal_camouflage'
  | 'force_burrow_emerge'
  | 'blow_away_flying'
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
  | 'become_flyer'
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
  | 'suppress_special'
  | 'retreat_columns'
  | 'brace'
  | 'chain_damage'
  | 'leave_slick'
  | 'leave_gel'
  | 'reduce_ally_cooldown'
  | 'pull_insect'
  | 'apply_slow'
  | 'buff_move_speed'
  | 'weaken_attack'
  | 'dash'
  | 'arm_burst'
  | 'fly_to_ally'
  | 'heal_insect'
  | 'fly_to_empty'
  | 'place_egg_group'
  | 'mark_priority_target'
  | 'delay_plant_attack'
  | 'column_skip'
  | 'hop_evade'
  | 'coil_roll'
  | 'trap_skip'
  | 'grant_leaf_screen'
  | 'apply_camouflage'
  | 'dust_veil'
  | 'hide'
  | 'unhide'
  | 'cleanse_move_debuff'
  | 'leave_speed_trail'
  | 'echo_special'
  | 'reflect_projectile'
  | 'discard_aerial_impact'
  | 'bounce_hopper'
  | 'bounce_bullet'

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
  /** knockback_insects: how many cells to push the insect back along the lane.
   * bounce_hopper: shove distance when a hop/vault insect targets this plant. */
  knockbackCells?: StateDurationValue;
  /**
   * knockback_insects / deal_contact_damage: damage dealt.
   * Prefer `stats.baseDamage` or `extra.retaliationDamage` attribute paths.
   */
  damage?: StateDurationValue;
  /** knockback_insects: push only on every Nth attack. 1 = every attack. */
  knockbackEvery?: StateDurationValue;
  /** knockback_insects / bounce_hopper: only light ground insects (no flying / heavy / living equipment). */
  unequippedOnly?: boolean;
  /**
   * discard_aerial_impact: absorb lobbed / curved insect bullets in the canopy.
   * Omit or true = enabled; false = ignore bullets.
   */
  blockBullets?: boolean;
  /**
   * discard_aerial_impact: bounce thrown insects that would land in the canopy.
   * Omit or true = enabled; false = ignore thrown landings.
   */
  blockThrown?: boolean;
  /**
   * discard_aerial_impact: bounce aerial drops / steal attempts in the canopy.
   * Omit or true = enabled; false = ignore aerial drop / steal.
   */
  blockAerialDrop?: boolean;
  /**
   * deal_contact_damage: who to hit.
   * `nearest` = FindNearestEnemy; `biting` = insect currently chewing this plant.
   */
  contactTarget?: ContactTargetMode;
  /** arm_burst: fuse length before explode (prefer `extra.fuseSeconds`). */
  fuseDuration?: StateDurationValue;
  /**
   * Legacy summon plant id (prefer `targetId` for summon_insect / throw_unit).
   * Kept for older graphs that still author summonId.
   */
  summonId?: string;
  /**
   * summon_insect / throw_unit: catalog insect id to spawn (literal string).
   * Prefer this over traits.summonInsectId / traits.throwInsectId when set.
   */
  targetId?: string;
  /**
   * Mode enum for multi-mode verbs (grant_shield, weaken_attack, buff_attack_speed, …).
   * Prefer this over traits.*Mode when set.
   */
  mode?: string;
  /**
   * Generic amount: produce_sun, heal_ally, grant_leaf_screen HP,
   * explode burstDamage, chain_damage maxJumps, reduce_ally_cooldown seconds.
   */
  amount?: StateDurationValue;
  /**
   * Generic duration (seconds): shield / reflect / brace / mark / camouflage /
   * trail / buff / contact stun / dash / slow / weaken /
   * knockback_insects impact priority mark (`extra.impactMarkSeconds`);
   * bounce_hopper bounce immunity (`extra.bounceImmuneSeconds`).
   */
  duration?: StateDurationValue;
  /**
   * Generic scale: attackSpeedScale, weaken scale, shield pct, brace incoming,
   * slow scale, mark damage, dash / trail / camouflage / hop miss, explode maxHpPercent;
   * bounce_bullet optional shooter damage scale (`extra.bounceBulletDamageScale`).
   */
  scale?: StateDurationValue;
  /**
   * Generic cap: attackSpeedBuffCap, markAllyCap, leafScreenCharges,
   * delayMaxTargets, speedBuffCap, explode damageCap / pulse max targets.
   */
  cap?: StateDurationValue;
  /**
   * explode mode=pulse: damage multiplier for the 1st / 2nd / 3rd contact (near→far).
   * Prefer `extra.hitDamageScale0` / `hitDamageScale1` / `hitDamageScale2`.
   */
  hitScale0?: StateDurationValue;
  hitScale1?: StateDurationValue;
  hitScale2?: StateDurationValue;
  /**
   * dash: post-burst recover scale (move slow when &lt; 1, incoming damage mult when &gt; 1).
   * Prefer `extra.dashRecoverScale`.
   */
  recoverScale?: StateDurationValue;
  /**
   * dash: post-burst recover window seconds. Prefer `extra.dashRecoverSeconds`.
   */
  recoverSeconds?: StateDurationValue;
  /**
   * deal_contact_damage: stun on every Nth hit (prefer `extra.stunEveryNth`).
   * Also used as contactEvery alias in older graphs.
   */
  everyNth?: StateDurationValue;
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

/** Who `deal_contact_damage` hits. */
export type ContactTargetMode = 'nearest' | 'biting';

export const CONTACT_TARGET_OPTIONS: ReadonlyArray<{
  id: ContactTargetMode;
  label: string;
  hint: string;
}> = [
  {
    id: 'nearest',
    label: 'Nearest enemy',
    hint: 'Spikeweed-style scrape: nearest enemy in range',
  },
  {
    id: 'biting',
    label: 'Biting insect',
    hint: 'Bramble-style thorns: only the insect currently chewing this plant',
  },
];

/** Common `mode` values for multi-mode engine actions. */
export const STATE_ACTION_MODE_OPTIONS: ReadonlyArray<{
  action: StateActionKind;
  id: string;
  label: string;
  hint: string;
}> = [
  {
    action: 'grant_shield',
    id: 'self_nearby',
    label: 'Self + nearby',
    hint: 'Shield self and nearby allies',
  },
  {
    action: 'grant_shield',
    id: 'self_behind',
    label: 'Host under shell',
    hint: 'Shield the plant sharing this cell (shell / pad host)',
  },
  {
    action: 'grant_shield',
    id: 'lowest_hp_ally',
    label: 'Lowest-HP ally',
    hint: 'Shield the most damaged ally in range (Honeybee Courier)',
  },
  {
    action: 'heal_ally',
    id: 'lowest_missing',
    label: 'Lowest-HP ally',
    hint: 'Heal the most damaged nearby plant (Nectar Nurse)',
  },
  {
    action: 'heal_ally',
    id: 'self',
    label: 'Self',
    hint: 'Heal this plant only',
  },
  {
    action: 'heal_ally',
    id: 'self_behind',
    label: 'Self + host',
    hint: 'Heal this shell and the plant sharing its cell (Bubble Aloe)',
  },
  {
    action: 'fly_to_ally',
    id: 'lowest_hp',
    label: 'Lowest HP ally',
    hint: 'Fly to the ally insect with the lowest current HP (Honeybee Courier)',
  },
  {
    action: 'fly_to_ally',
    id: 'random',
    label: 'Random ally',
    hint: 'Fly to a random ally insect',
  },
  {
    action: 'fly_to_ally',
    id: 'return',
    label: 'Return home',
    hint: 'Optional: fly back to the spawn-edge column (Honeybee stays at the ally by default)',
  },
  {
    action: 'heal_insect',
    id: 'lowest_hp',
    label: 'Lowest HP ally',
    hint: 'Heal the lowest-HP ally insect (or SupportTarget from fly_to_ally)',
  },
  {
    action: 'heal_insect',
    id: 'random',
    label: 'Random ally',
    hint: 'Heal a random ally insect',
  },
  {
    action: 'become_flyer',
    id: 'full',
    label: 'Full HP',
    hint: 'Heal to max HP on metamorphosis (default)',
  },
  {
    action: 'become_flyer',
    id: 'remain',
    label: 'Keep current HP',
    hint: 'Do not heal — keep the HP that triggered the convert',
  },
  {
    action: 'become_flyer',
    id: 'fill',
    label: 'Fill some HP',
    hint: 'Heal by amount (<1 = fraction of max HP, ≥1 = flat). Prefer extra.metamorphHealAmount.',
  },
  {
    action: 'chomp_devour',
    id: 'trap',
    label: 'Eat light only',
    hint: 'Kill one Light ground insect. Skip Heavy / flying. Sets chomp_killed when successful.',
  },
  {
    action: 'chomp_devour',
    id: 'trap_or_slow',
    label: 'Eat light / slow heavy',
    hint:
      'Light: kill (chomp_killed). Heavy: chill for duration at scale (no_chomp_killed). Prefer extra.heavySlowSeconds + extra.heavySlowScale.',
  },
  {
    action: 'weaken_attack',
    id: 'damage_weaken',
    label: 'Damage weaken',
    hint: 'Plant pulse: reduce insect outgoing attack damage (Spore Lantern)',
  },
  {
    action: 'weaken_attack',
    id: 'plant_damage_weaken',
    label: 'Plant damage weaken',
    hint: 'Insect bite: reduce a plant\'s outgoing attack damage by scale for duration (Aphid Nibbler). everyNth≥1 = first contact only.',
  },
  {
    action: 'weaken_attack',
    id: 'bite_slow',
    label: 'Bite slow',
    hint: 'Slow plant attack interval (Caterpillar)',
  },
  {
    action: 'weaken_attack',
    id: 'song_delay',
    label: 'Song delay',
    hint: 'Delay plant attack timers (Cicada song)',
  },
  {
    action: 'weaken_attack',
    id: 'silk_tether',
    label: 'Silk tether',
    hint: 'Stronger plant attack-interval slow (legacy silk tether mode)',
  },
  {
    action: 'buff_attack_speed',
    id: 'aura',
    label: 'Aura',
    hint: 'Buff nearby allies in range',
  },
  {
    action: 'buff_attack_speed',
    id: 'self',
    label: 'Self only',
    hint: 'Buff only the caster',
  },
  {
    action: 'buff_move_speed',
    id: 'aura',
    label: 'Aura',
    hint: 'Speed-buff nearby insect allies',
  },
  {
    action: 'buff_move_speed',
    id: 'boss_pulse',
    label: 'Boss pulse',
    hint: 'Wider ally speed pulse (Bumble Queen)',
  },
  {
    action: 'buff_move_speed',
    id: 'trail',
    label: 'Speed trail',
    hint: 'Leave a temporary speed trail',
  },
  {
    action: 'buff_move_speed',
    id: 'cleanse_pulse',
    label: 'Cleanse pulse',
    hint: 'Clear move debuffs instead of buffing',
  },
  {
    action: 'explode',
    id: 'blast',
    label: 'Blast',
    hint: 'One-shot area blast (ArmorFirst, explode VFX). Default.',
  },
  {
    action: 'explode',
    id: 'pulse',
    label: 'Pulse',
    hint: 'Repeating close area hit (Pierce, melee VFX). Use for fans / cones.',
  },
  {
    action: 'clear_fog',
    id: 'aura',
    label: 'Aura',
    hint: 'Local fog hole while this unit is alive (Lantern Lily). Pair with reveal_camouflage / force_burrow_emerge for Plantern reveal. Default.',
  },
  {
    action: 'clear_fog',
    id: 'all',
    label: 'All fog',
    hint: 'Permanently clear the entire fog bank for the rest of the raid.',
  },
  {
    action: 'blow_away_flying',
    id: 'push',
    label: 'Push',
    hint: 'Shove flying insects toward spawn by columnRange; they land and keep marching. Default.',
  },
  {
    action: 'blow_away_flying',
    id: 'offscreen',
    label: 'Off-screen (Blover)',
    hint: 'Blow flying insects off the lawn and remove them. Plays yellow pollen burst. Classic Blover / Sneezeweed.',
  },
  {
    action: 'despawn',
    id: 'puff',
    label: 'Puff',
    hint: 'Remove with the default plant exit puff. Default.',
  },
  {
    action: 'despawn',
    id: 'silent',
    label: 'Silent',
    hint: 'Remove with no exit puff (use when a prior action already played FX, e.g. pollen burst).',
  },
];

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
export type ExplodeVfxStyle = 'boom' | 'fire' | 'lane_fire' | 'sand_storm' | 'ice';

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
    id: 'sand_storm',
    label: 'Sand storm',
    hint: 'Storm swirls race from the plant to blast cells (Storm Tulip)',
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
  if (lower === 'sandstorm' || lower === 'storm_tulip') return 'sand_storm';
  if (lower === 'jalapenoexplode' || lower === 'lanefire') return 'lane_fire';
  if (lower === 'fireexplosion' || lower === 'cherry') return 'fire';
  if (lower === 'iceshroomsnow' || lower === 'mint_mist' || lower === 'freeze') return 'ice';
  if (lower === 'explosion' || lower === 'default') return 'boom';
  return undefined;
}

/** Inspector fields for actions that take graph-configurable numbers. */
export type StateActionParamKey =
  | 'columnRange'
  | 'laneRange'
  | 'freezeDuration'
  | 'chillDuration'
  | 'splashColumnRange'
  | 'splashLaneRange'
  | 'knockbackCells'
  | 'damage'
  | 'knockbackEvery'
  | 'fuseDuration'
  | 'amount'
  | 'duration'
  | 'scale'
  | 'cap'
  | 'hitScale0'
  | 'hitScale1'
  | 'hitScale2'
  | 'recoverScale'
  | 'recoverSeconds'
  | 'everyNth';

export const STATE_ACTION_PARAM_FIELDS: ReadonlyArray<{
  action: StateActionKind;
  key: StateActionParamKey;
  label: string;
  hint: string;
  /** Default Extra attribute path when inserting the action. */
  defaultAttribute: string;
  /**
   * When set, this param is only shown / seeded for these action `mode` ids.
   * Omit to show for every mode (including empty / Default).
   */
  modes?: ReadonlyArray<string>;
}> = [
  {
    action: 'explode',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Blast / pulse column radius (Cherry ~1.5, Jalapeno / Storm ~12). Prefer extra.triggerColumnRange.',
    defaultAttribute: 'extra.triggerColumnRange',
  },
  {
    action: 'explode',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Blast / pulse lane radius (0 = same lane only; 1 = ±1 lane). Prefer extra.triggerLaneRange.',
    defaultAttribute: 'extra.triggerLaneRange',
  },
  {
    action: 'explode',
    key: 'amount',
    label: 'Burst damage',
    hint: 'Flat damage (blast: extra.burstDamage; pulse: stats.baseDamage)',
    defaultAttribute: 'extra.burstDamage',
  },
  {
    action: 'explode',
    key: 'damage',
    label: 'Pulse damage',
    hint: 'Flat damage for mode=pulse (alias of amount). Prefer stats.baseDamage.',
    defaultAttribute: 'stats.baseDamage',
  },
  {
    action: 'explode',
    key: 'scale',
    label: 'Max-HP percent',
    hint: 'Blast only: fraction of target max HP (prefer extra.maxHpPercent)',
    defaultAttribute: 'extra.maxHpPercent',
  },
  {
    action: 'explode',
    key: 'cap',
    label: 'Cap',
    hint: 'Blast: %HP damage cap (extra.damageCap). Pulse: max targets (extra.sweepMaxTargets). 0 = unlimited.',
    defaultAttribute: 'extra.damageCap',
  },
  {
    action: 'explode',
    key: 'hitScale0',
    label: 'Pulse hit 1 scale',
    hint: 'Pulse only: damage multiplier for the nearest contact. Prefer extra.hitDamageScale0 (1 = 100%).',
    defaultAttribute: 'extra.hitDamageScale0',
  },
  {
    action: 'explode',
    key: 'hitScale1',
    label: 'Pulse hit 2 scale',
    hint: 'Pulse only: damage multiplier for the 2nd-nearest contact. Prefer extra.hitDamageScale1.',
    defaultAttribute: 'extra.hitDamageScale1',
  },
  {
    action: 'explode',
    key: 'hitScale2',
    label: 'Pulse hit 3 scale',
    hint: 'Pulse only: damage multiplier for the 3rd-nearest contact. Prefer extra.hitDamageScale2.',
    defaultAttribute: 'extra.hitDamageScale2',
  },
  {
    action: 'blow_away_flying',
    key: 'columnRange',
    label: 'Push columns',
    hint: 'Push mode: columns toward spawn. Offscreen mode: optional travel hint (default blows past the lawn edge). Prefer extra.blowAwayColumns.',
    defaultAttribute: 'extra.blowAwayColumns',
  },
  {
    action: 'fire_bullet',
    key: 'damage',
    label: 'Shot damage',
    hint: 'Damage this projectile deals. Prefer stats.baseDamage unless this shot differs from the unit.',
    defaultAttribute: 'stats.baseDamage',
  },
  {
    action: 'fire_bullet',
    key: 'columnRange',
    label: 'Travel / jump radius',
    hint:
      'Projectile travel columns, or chain lightning jump radius (extra.jumpRadiusCells). Prefer extra.travelColumns / extra.jumpRadiusCells.',
    defaultAttribute: 'extra.travelColumns',
  },
  {
    action: 'fire_bullet',
    key: 'duration',
    label: 'Max air life (s)',
    hint: 'Seconds before the projectile disappears. Prefer extra.airLifeSeconds.',
    defaultAttribute: 'extra.airLifeSeconds',
  },
  {
    action: 'fire_bullet',
    key: 'cap',
    label: 'Pierce / max jumps',
    hint:
      'Pierce hit count, or chain lightning max jumps (extra.maxJumps). Prefer extra.pierceHits / extra.maxJumps.',
    defaultAttribute: 'extra.pierceHits',
  },
  {
    action: 'fire_bullet',
    key: 'amount',
    label: 'Pass over blockers',
    hint: 'Above 0.5, the shot flies over plants that block the lane. Prefer extra.overBlockers.',
    defaultAttribute: 'extra.overBlockers',
  },
  {
    action: 'deal_contact_damage',
    key: 'damage',
    label: 'Contact damage',
    hint: 'Prefer stats.baseDamage (Spikeweed) or extra.retaliationDamage (Bramble)',
    defaultAttribute: 'stats.baseDamage',
  },
  {
    action: 'deal_contact_damage',
    key: 'columnRange',
    label: 'Contact reach',
    hint: 'Melee search range in columns (prefer extra.triggerColumnRange)',
    defaultAttribute: 'extra.triggerColumnRange',
  },
  {
    action: 'deal_contact_damage',
    key: 'everyNth',
    label: 'Stun every Nth',
    hint: 'Stun on this attack count (prefer extra.stunEveryNth)',
    defaultAttribute: 'extra.stunEveryNth',
  },
  {
    action: 'deal_contact_damage',
    key: 'duration',
    label: 'Contact stun (s)',
    hint: 'Stun length when everyNth fires (prefer extra.contactStunSeconds)',
    defaultAttribute: 'extra.contactStunSeconds',
  },
  {
    action: 'deal_contact_damage',
    key: 'chillDuration',
    label: 'Contact chill (s)',
    hint: 'Chill bitten target (prefer extra.chillOnContactSeconds)',
    defaultAttribute: 'extra.chillOnContactSeconds',
  },
  {
    action: 'deal_contact_damage',
    key: 'cap',
    label: 'Sweep max targets',
    hint: 'Leaf/sweep melee: max enemies hit near→far. 0 or unset = single nearest (unless hit scales are bound). Prefer extra.sweepMaxTargets.',
    defaultAttribute: 'extra.sweepMaxTargets',
  },
  {
    action: 'deal_contact_damage',
    key: 'hitScale0',
    label: 'Sweep hit 1 scale',
    hint: 'Damage multiplier for the nearest contact. Prefer extra.hitDamageScale0 (1 = 100%).',
    defaultAttribute: 'extra.hitDamageScale0',
  },
  {
    action: 'deal_contact_damage',
    key: 'hitScale1',
    label: 'Sweep hit 2 scale',
    hint: 'Damage multiplier for the 2nd-nearest contact. Prefer extra.hitDamageScale1.',
    defaultAttribute: 'extra.hitDamageScale1',
  },
  {
    action: 'deal_contact_damage',
    key: 'hitScale2',
    label: 'Sweep hit 3 scale',
    hint: 'Damage multiplier for the 3rd-nearest contact. Prefer extra.hitDamageScale2.',
    defaultAttribute: 'extra.hitDamageScale2',
  },
  {
    action: 'knockback_insects',
    key: 'columnRange',
    label: 'Knockback reach',
    hint: 'How far ahead to shove insects (prefer extra.triggerColumnRange)',
    defaultAttribute: 'extra.triggerColumnRange',
  },
  {
    action: 'explode',
    key: 'duration',
    label: 'Interrupt (s)',
    hint: 'Optional special-interrupt duration on hit (prefer extra.interruptSpecialSeconds)',
    defaultAttribute: 'extra.interruptSpecialSeconds',
  },
  {
    action: 'produce_sun',
    key: 'amount',
    label: 'Sun amount',
    hint: 'Sun produced per pulse (prefer extra.produceSunAmount)',
    defaultAttribute: 'extra.produceSunAmount',
  },
  {
    action: 'heal_ally',
    key: 'amount',
    label: 'Heal amount',
    hint: 'Flat heal or percent via extra.healPercentMaxHp / healMaxHpPercent',
    defaultAttribute: 'extra.healPercentMaxHp',
  },
  {
    action: 'become_flyer',
    key: 'amount',
    label: 'Fill amount',
    hint: 'Only for mode=fill: <1 = fraction of max HP, ≥1 = flat HP. Prefer extra.metamorphHealAmount.',
    defaultAttribute: 'extra.metamorphHealAmount',
    modes: ['fill'],
  },
  {
    action: 'heal_ally',
    key: 'scale',
    label: 'Link heal copy',
    hint: 'Fraction of heal copied to a linked ally (extra.linkHealCopy)',
    defaultAttribute: 'extra.linkHealCopy',
  },
  {
    action: 'heal_ally',
    key: 'cap',
    label: 'Overheal shield %',
    hint: 'Shield fraction of max HP when heal overfills (extra.overhealShieldPercent)',
    defaultAttribute: 'extra.overhealShieldPercent',
  },
  {
    action: 'fly_to_ally',
    key: 'recoverSeconds',
    label: 'One-way flight time (s)',
    hint: 'Seconds for this flight leg (outbound or return). Prefer extra.flySeconds.',
    defaultAttribute: 'extra.flySeconds',
  },
  {
    action: 'fly_to_empty',
    key: 'recoverSeconds',
    label: 'One-way flight time (s)',
    hint: 'Seconds to reach the empty cell. Prefer extra.flySeconds.',
    defaultAttribute: 'extra.flySeconds',
  },
  {
    action: 'heal_insect',
    key: 'amount',
    label: 'Heal amount',
    hint: 'Flat HP restored. Prefer extra.healAmount (Honeybee Courier = 100).',
    defaultAttribute: 'extra.healAmount',
  },
  {
    action: 'buff_attack_speed',
    key: 'scale',
    label: 'Attack interval scale',
    hint: '<1 = faster (prefer extra.attackSpeedScale)',
    defaultAttribute: 'extra.attackSpeedScale',
  },
  {
    action: 'buff_attack_speed',
    key: 'duration',
    label: 'Buff duration (s)',
    hint: 'Prefer extra.attackSpeedBuffSeconds',
    defaultAttribute: 'extra.attackSpeedBuffSeconds',
  },
  {
    action: 'buff_attack_speed',
    key: 'cap',
    label: 'Ally cap',
    hint: 'Max allies buffed (prefer extra.attackSpeedBuffCap)',
    defaultAttribute: 'extra.attackSpeedBuffCap',
  },
  {
    action: 'mark_priority_target',
    key: 'duration',
    label: 'Mark duration (s)',
    hint: 'Prefer extra.markDurationSeconds',
    defaultAttribute: 'extra.markDurationSeconds',
  },
  {
    action: 'mark_priority_target',
    key: 'scale',
    label: 'Mark damage scale',
    hint: 'Prefer extra.markDamageScale',
    defaultAttribute: 'extra.markDamageScale',
  },
  {
    action: 'mark_priority_target',
    key: 'cap',
    label: 'Mark ally cap',
    hint: 'Prefer extra.markAllyCap',
    defaultAttribute: 'extra.markAllyCap',
  },
  {
    action: 'apply_slow',
    key: 'duration',
    label: 'Slow duration (s)',
    hint: 'Prefer extra.slowDurationSeconds',
    defaultAttribute: 'extra.slowDurationSeconds',
  },
  {
    action: 'apply_slow',
    key: 'scale',
    label: 'Slow scale',
    hint: 'Movement multiplier while slowed (prefer extra.slowScale)',
    defaultAttribute: 'extra.slowScale',
  },
  {
    action: 'apply_slow',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Target column radius in cells. Prefer extra.slowColumnRange.',
    defaultAttribute: 'extra.slowColumnRange',
  },
  {
    action: 'apply_slow',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Target lane radius (0 = same lane only). Prefer extra.slowLaneRange.',
    defaultAttribute: 'extra.slowLaneRange',
  },
  {
    action: 'discard_aerial_impact',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Canopy column radius in cells (1 = ±1 → 3-wide). Prefer extra.aerialProtectColumnRange.',
    defaultAttribute: 'extra.aerialProtectColumnRange',
  },
  {
    action: 'discard_aerial_impact',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Canopy lane radius in cells (1 = ±1 → 3-tall). Prefer extra.aerialProtectLaneRange.',
    defaultAttribute: 'extra.aerialProtectLaneRange',
  },
  {
    action: 'bounce_hopper',
    key: 'knockbackCells',
    label: 'Bounce distance (cells)',
    hint: 'How far hop/vault insects are shoved when they land on this plant. Prefer extra.knockbackCells.',
    defaultAttribute: 'extra.knockbackCells',
  },
  {
    action: 'bounce_hopper',
    key: 'duration',
    label: 'Bounce immunity (s)',
    hint: 'Seconds before the same insect can be bounced again. Prefer extra.bounceImmuneSeconds.',
    defaultAttribute: 'extra.bounceImmuneSeconds',
  },
  {
    action: 'bounce_bullet',
    key: 'scale',
    label: 'Bounce damage scale',
    hint: 'Optional damage to the shooter when a bullet bounces (0 = trajectory bounce only). Prefer extra.bounceBulletDamageScale.',
    defaultAttribute: 'extra.bounceBulletDamageScale',
  },
  {
    action: 'weaken_attack',
    key: 'scale',
    label: 'Weaken scale',
    hint: 'Outgoing damage or interval scale (extra.weakenDamageScale). plant_damage_weaken: 0.75 = plants deal 75% damage.',
    defaultAttribute: 'extra.weakenDamageScale',
  },
  {
    action: 'weaken_attack',
    key: 'duration',
    label: 'Weaken duration (s)',
    hint: 'Prefer extra.weakenSeconds',
    defaultAttribute: 'extra.weakenSeconds',
  },
  {
    action: 'weaken_attack',
    key: 'everyNth',
    label: 'First contact only',
    hint: 'plant_damage_weaken: set to 1 so only the first bite applies the weaken (extra.weakenFirstContactOnly).',
    defaultAttribute: 'extra.weakenFirstContactOnly',
  },
  {
    action: 'reflect_projectile',
    key: 'duration',
    label: 'Reflect duration (s)',
    hint: 'Prefer extra.reflectSeconds',
    defaultAttribute: 'extra.reflectSeconds',
  },
  {
    action: 'grant_shield',
    key: 'scale',
    label: 'Shield percent',
    hint: 'Fraction of max HP (extra.shieldSelfPct / shieldMaxHpPercent)',
    defaultAttribute: 'extra.shieldSelfPct',
  },
  {
    action: 'grant_shield',
    key: 'duration',
    label: 'Shield duration (s)',
    hint: 'Prefer extra.shieldSeconds / shieldDurationSeconds',
    defaultAttribute: 'extra.shieldSeconds',
  },
  {
    action: 'brace',
    key: 'scale',
    label: 'Brace incoming scale',
    hint: 'Damage taken multiplier (extra.braceIncomingScale / braceDamageScale)',
    defaultAttribute: 'extra.braceIncomingScale',
  },
  {
    action: 'brace',
    key: 'duration',
    label: 'Brace duration (s)',
    hint: 'Prefer extra.braceSeconds / braceDurationSeconds',
    defaultAttribute: 'extra.braceSeconds',
  },
  {
    action: 'delay_plant_attack',
    key: 'duration',
    label: 'Attack delay (s)',
    hint: 'Prefer extra.attackDelaySeconds',
    defaultAttribute: 'extra.attackDelaySeconds',
  },
  {
    action: 'delay_plant_attack',
    key: 'cap',
    label: 'Max targets',
    hint: 'Prefer extra.delayMaxTargets',
    defaultAttribute: 'extra.delayMaxTargets',
  },
  {
    action: 'grant_leaf_screen',
    key: 'amount',
    label: 'Leaf screen HP',
    hint: 'Prefer extra.leafScreenHp',
    defaultAttribute: 'extra.leafScreenHp',
  },
  {
    action: 'grant_leaf_screen',
    key: 'cap',
    label: 'Leaf screen block count',
    hint: 'Prefer extra.leafScreenBlockCount (alias leafScreenCharges)',
    defaultAttribute: 'extra.leafScreenBlockCount',
  },
  {
    action: 'dash',
    key: 'scale',
    label: 'Dash speed scale',
    hint: 'Prefer extra.dashSpeedScale',
    defaultAttribute: 'extra.dashSpeedScale',
  },
  {
    action: 'dash',
    key: 'duration',
    label: 'Dash duration (s)',
    hint: 'Prefer extra.dashSeconds',
    defaultAttribute: 'extra.dashSeconds',
  },
  {
    action: 'dash',
    key: 'recoverScale',
    label: 'Dash recover scale',
    hint: 'Prefer extra.dashRecoverScale (<1 move slow, >1 incoming damage mult)',
    defaultAttribute: 'extra.dashRecoverScale',
  },
  {
    action: 'dash',
    key: 'recoverSeconds',
    label: 'Dash recover seconds',
    hint: 'Prefer extra.dashRecoverSeconds',
    defaultAttribute: 'extra.dashRecoverSeconds',
  },
  {
    action: 'coil_roll',
    key: 'columnRange',
    label: 'Roll columns',
    hint: 'Prefer extra.triggerColumnRange',
    defaultAttribute: 'extra.triggerColumnRange',
  },
  {
    action: 'coil_roll',
    key: 'duration',
    label: 'Coil cooldown (s)',
    hint: 'Seconds before special is ready again. Prefer extra.coilCooldownSeconds',
    defaultAttribute: 'extra.coilCooldownSeconds',
  },
  {
    action: 'suppress_special',
    key: 'duration',
    label: 'Suppress duration (s)',
    hint: 'Prefer extra.suppressSpecialSeconds (GDD Ant Forager 4s)',
    defaultAttribute: 'extra.suppressSpecialSeconds',
  },
  {
    action: 'suppress_special',
    key: 'cap',
    label: 'Plant immunity (s)',
    hint: 'Prefer extra.suppressImmuneSeconds (GDD 10s)',
    defaultAttribute: 'extra.suppressImmuneSeconds',
  },
  {
    action: 'retreat_columns',
    key: 'amount',
    label: 'Retreat columns',
    hint: 'Prefer extra.retreatColumns (GDD Damselfly 0.5)',
    defaultAttribute: 'extra.retreatColumns',
  },
  {
    action: 'retreat_columns',
    key: 'duration',
    label: 'Retreat cooldown (s)',
    hint: 'Prefer extra.retreatCooldownSeconds (GDD 4s)',
    defaultAttribute: 'extra.retreatCooldownSeconds',
  },
  {
    action: 'leave_slick',
    key: 'duration',
    label: 'Slick duration (s)',
    hint: 'Prefer extra.slickDurationSeconds',
    defaultAttribute: 'extra.slickDurationSeconds',
  },
  {
    action: 'leave_slick',
    key: 'scale',
    label: 'Slick attack interval scale',
    hint: 'Prefer extra.slickAttackIntervalScale (>1 = slower plants)',
    defaultAttribute: 'extra.slickAttackIntervalScale',
  },
  {
    action: 'leave_gel',
    key: 'duration',
    label: 'Gel duration (s)',
    hint: 'How long gel cells remain. Prefer extra.gelDurationSeconds (Slug Slimer = 10).',
    defaultAttribute: 'extra.gelDurationSeconds',
  },
  {
    action: 'leave_gel',
    key: 'scale',
    label: 'Gel move-speed scale',
    hint: 'Insects on gel multiply move speed by this. Prefer extra.gelMoveSpeedScale (>1 = faster).',
    defaultAttribute: 'extra.gelMoveSpeedScale',
  },
  {
    action: 'buff_move_speed',
    key: 'scale',
    label: 'Move speed scale',
    hint: 'Prefer extra.moveSpeedScale',
    defaultAttribute: 'extra.moveSpeedScale',
  },
  {
    action: 'buff_move_speed',
    key: 'duration',
    label: 'Buff duration (s)',
    hint: 'Prefer extra.moveSpeedBuffSeconds',
    defaultAttribute: 'extra.moveSpeedBuffSeconds',
  },
  {
    action: 'buff_move_speed',
    key: 'cap',
    label: 'Ally cap',
    hint: 'Prefer extra.speedBuffCap',
    defaultAttribute: 'extra.speedBuffCap',
  },
  {
    action: 'buff_move_speed',
    key: 'columnRange',
    label: 'Affection column range',
    hint: 'Aura / boss pulse: columns along the lane. Prefer extra.speedBuffColumnRange. Unused for trail / cleanse.',
    defaultAttribute: 'extra.speedBuffColumnRange',
  },
  {
    action: 'buff_move_speed',
    key: 'laneRange',
    label: 'Affection lane range',
    hint: 'Aura / boss pulse: lanes above/below (±). Prefer extra.speedBuffLaneRange. Unused for trail / cleanse.',
    defaultAttribute: 'extra.speedBuffLaneRange',
  },
  {
    action: 'leave_speed_trail',
    key: 'scale',
    label: 'Trail speed scale',
    hint: 'Prefer extra.trailSpeedScale',
    defaultAttribute: 'extra.trailSpeedScale',
  },
  {
    action: 'leave_speed_trail',
    key: 'duration',
    label: 'Trail duration (s)',
    hint: 'Prefer extra.trailSeconds',
    defaultAttribute: 'extra.trailSeconds',
  },
  {
    action: 'apply_camouflage',
    key: 'scale',
    label: 'Camouflage priority scale',
    hint: 'Prefer extra.camouflagePriorityScale',
    defaultAttribute: 'extra.camouflagePriorityScale',
  },
  {
    action: 'apply_camouflage',
    key: 'duration',
    label: 'Camouflage duration (s)',
    hint: 'Prefer extra.camouflageSeconds',
    defaultAttribute: 'extra.camouflageSeconds',
  },
  {
    action: 'hide',
    key: 'scale',
    label: 'Opacity',
    hint: 'Visible alpha while hidden (0.2–0.7 typical). Prefer extra.hideOpacity.',
    defaultAttribute: 'extra.hideOpacity',
  },
  {
    action: 'hide',
    key: 'duration',
    label: 'Hide duration (s)',
    hint: '0 / unset = stay hidden until unhide or leaving via graph. Prefer extra.hideSeconds.',
    defaultAttribute: 'extra.hideSeconds',
  },
  {
    action: 'hop_evade',
    key: 'scale',
    label: 'Hop miss chance',
    hint: 'Prefer extra.hopMissChance',
    defaultAttribute: 'extra.hopMissChance',
  },
  {
    action: 'chain_damage',
    key: 'amount',
    label: 'Max jumps',
    hint: 'Prefer extra.maxJumps',
    defaultAttribute: 'extra.maxJumps',
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
    action: 'reveal_camouflage',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Strip camouflage / hide within this column radius (1 = 3-wide). Prefer extra.fogClearRadius or extra.revealColumnRange.',
    defaultAttribute: 'extra.fogClearRadius',
  },
  {
    action: 'reveal_camouflage',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Strip camouflage within this lane radius. Prefer extra.fogClearRadius or extra.revealLaneRange.',
    defaultAttribute: 'extra.fogClearRadius',
  },
  {
    action: 'dust_veil',
    key: 'columnRange',
    label: 'Affection column range',
    hint:
      'Moon Moth dust: columns along the lane where walking ground insects skip ranged plant targeting. Prefer extra.dustColumnRange.',
    defaultAttribute: 'extra.dustColumnRange',
  },
  {
    action: 'dust_veil',
    key: 'laneRange',
    label: 'Affection lane range',
    hint:
      'Moon Moth dust: lanes above/below (±). Prefer extra.dustLaneRange (0 = same lane only).',
    defaultAttribute: 'extra.dustLaneRange',
  },
  {
    action: 'force_burrow_emerge',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Force burrowed insects up within this column radius. Prefer extra.fogClearRadius or extra.revealColumnRange.',
    defaultAttribute: 'extra.fogClearRadius',
  },
  {
    action: 'force_burrow_emerge',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Force burrowed insects up within this lane radius. Prefer extra.fogClearRadius or extra.revealLaneRange.',
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
    hint: "Damage dealt with the shove. Attribute stats.baseDamage uses this plant's damage.",
    defaultAttribute: 'stats.baseDamage',
  },
  {
    action: 'knockback_insects',
    key: 'knockbackEvery',
    label: 'Every Nth attack',
    hint: 'Push only on this attack count. 1 pushes every attack. 3 pushes on the 3rd, 6th, and so on.',
    defaultAttribute: 'extra.knockbackEvery',
  },
  {
    action: 'knockback_insects',
    key: 'duration',
    label: 'Impact mark (seconds)',
    hint:
      'After a successful shove, mark that insect so nearby shooters prioritize it and deal +15% damage (Chestnut Cannon). None / 0 = no mark.',
    defaultAttribute: 'extra.impactMarkSeconds',
  },
  {
    action: 'arm_burst',
    key: 'fuseDuration',
    label: 'Fuse seconds',
    hint: 'Delay before self-explode. Prefer extra.fuseSeconds.',
    defaultAttribute: 'extra.fuseSeconds',
  },
  {
    action: 'chomp_devour',
    key: 'duration',
    label: 'Heavy chill seconds',
    hint: 'Chill duration when mode=trap_or_slow hits a Heavy. Unused when eating Light (kill is instant). Prefer extra.heavySlowSeconds.',
    defaultAttribute: 'extra.heavySlowSeconds',
  },
  {
    action: 'chomp_devour',
    key: 'scale',
    label: 'Heavy slow scale',
    hint:
      'Move-speed scale while chilled (0.65 = 35% slow). Used only in mode=trap_or_slow. Prefer extra.heavySlowScale.',
    defaultAttribute: 'extra.heavySlowScale',
  },
  {
    action: 'reduce_ally_cooldown',
    key: 'amount',
    label: 'Shave seconds',
    hint: 'Seconds subtracted from each ally attack cooldown. Prefer extra.cooldownShaveSeconds.',
    defaultAttribute: 'extra.cooldownShaveSeconds',
  },
  {
    action: 'reduce_ally_cooldown',
    key: 'columnRange',
    label: 'Column range',
    hint: 'Ally column radius in cells. Prefer extra.cooldownColumnRange.',
    defaultAttribute: 'extra.cooldownColumnRange',
  },
  {
    action: 'reduce_ally_cooldown',
    key: 'laneRange',
    label: 'Lane range',
    hint: 'Ally lane radius (0 = same lane only). Prefer extra.cooldownLaneRange.',
    defaultAttribute: 'extra.cooldownLaneRange',
  },
];

export function actionParamFieldsFor(
  type: StateActionKind,
  mode?: string | null,
) {
  const resolved = (mode ?? '').trim();
  return STATE_ACTION_PARAM_FIELDS.filter((f) => {
    if (f.action !== type) return false;
    if (!f.modes || f.modes.length === 0) return true;
    return resolved !== '' && f.modes.includes(resolved);
  });
}

/**
 * Seed default attribute-bound params when adding an action in the editor.
 * When `availableAttributePaths` is provided, only bind defaults whose path
 * exists on this unit (extras + built-in stats). Missing extras stay unset (None).
 */
export function defaultActionParams(
  type: StateActionKind,
  availableAttributePaths?: ReadonlySet<string> | readonly string[],
): Partial<StateAction> {
  const fields = actionParamFieldsFor(type);
  const available =
    availableAttributePaths == null
      ? null
      : availableAttributePaths instanceof Set
        ? availableAttributePaths
        : new Set(availableAttributePaths);
  const out: Partial<StateAction> = {};
  for (const f of fields) {
    if (available && !available.has(f.defaultAttribute)) continue;
    (out as Record<string, StateDurationValue>)[f.key] = attributeDuration(f.defaultAttribute);
  }
  if (type === 'explode') {
    out.vfxStyle = 'boom';
    out.mode = 'blast';
  }
  if (type === 'clear_fog') {
    out.mode = 'aura';
  }
  if (type === 'blow_away_flying') {
    out.mode = 'push';
  }
  if (type === 'despawn') {
    out.mode = 'puff';
  }
  if (type === 'reveal_camouflage' || type === 'force_burrow_emerge') {
    if (out.columnRange == null) out.columnRange = literalDuration(1);
    if (out.laneRange == null) out.laneRange = literalDuration(1);
  }
  if (type === 'dust_veil') {
    if (out.columnRange == null) out.columnRange = literalDuration(2.5);
    if (out.laneRange == null) out.laneRange = literalDuration(1);
  }
  if (type === 'squash_crush') {
    out.crushStyle = 'hop';
  }
  if (type === 'deal_contact_damage') {
    out.contactTarget = 'nearest';
  }
  if (type === 'chomp_devour') {
    out.mode = 'trap';
  }
  if (type === 'discard_aerial_impact') {
    out.blockBullets = true;
    out.blockThrown = true;
    out.blockAerialDrop = true;
    if (out.columnRange == null) out.columnRange = literalDuration(1);
    if (out.laneRange == null) out.laneRange = literalDuration(1);
  }
  if (type === 'bounce_hopper') {
    if (out.knockbackCells == null) out.knockbackCells = attributeDuration('extra.knockbackCells');
    if (out.duration == null) out.duration = attributeDuration('extra.bounceImmuneSeconds');
    out.unequippedOnly = true;
  }
  if (type === 'bounce_bullet') {
    if (out.scale == null) out.scale = attributeDuration('extra.bounceBulletDamageScale');
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
    hint: 'Fires this unit’s projectile (client.bullet / bulletShots). Not a summon.',
    kind: 'both',
  },
  {
    type: 'deal_contact_damage',
    label: 'Deal contact damage',
    hint:
      'Melee hit. Set damage (stats.baseDamage / extra.*) and contactTarget (nearest | biting) on the action.',
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
    hint:
      'Eat (kill) a Light ground insect. mode=trap_or_slow also chills Heavy at scale/duration. Branch with chomp_killed / no_chomp_killed.',
    kind: 'plant',
  },
  {
    type: 'explode',
    label: 'Explode',
    hint:
      'Area hit. mode=blast (default): one-shot ArmorFirst blast + VFX. mode=pulse: repeating Pierce pulse (fans / cones). Bind column/lane on the action.',
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
    hint:
      'Fog clear. mode=aura (default): local lantern hole. mode=all: permanent map-wide clear. Reveal is separate (reveal_camouflage / force_burrow_emerge).',
    kind: 'plant',
  },
  {
    type: 'reveal_camouflage',
    label: 'Strip camouflage',
    hint:
      'While this status is active, strip camouflage / hide on insects in columnRange × laneRange (Lantern Lily).',
    kind: 'plant',
  },
  {
    type: 'force_burrow_emerge',
    label: 'Force burrow emerge',
    hint:
      'While this status is active, force burrowed insects in columnRange × laneRange to surface early (Lantern Lily).',
    kind: 'plant',
  },
  {
    type: 'blow_away_flying',
    label: 'Blow away flying',
    hint:
      'Flying insects. mode=push (default): shove toward spawn by columnRange. mode=offscreen: blow off-lawn + remove (Blover / Sneezeweed pollen burst).',
    kind: 'plant',
  },
  {
    type: 'despawn',
    label: 'Despawn',
    hint: 'Remove this unit. mode=silent skips the default plant exit puff when FX already played.',
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
    hint: 'Jump the first plant in lane (Grasshopper Jumper only)',
    kind: 'insect',
  },
  {
    type: 'enter_burrow',
    label: 'Enter burrow',
    hint: 'Go underground / untargetable (insect diggers, Burrow Beetroot while buried)',
    kind: 'both',
  },
  {
    type: 'exit_burrow',
    label: 'Exit burrow',
    hint: 'Surface and resume normal combat targeting',
    kind: 'both',
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
    type: 'become_flyer',
    label: 'Become flyer',
    hint: 'Once per life: enter flying and retarget past the plant edge into the house. HP via mode (full / remain / fill). Gate with special_ready + health_below.',
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
    hint: 'Turn the biting insect to fight for the garden (Mirror Ivy / Hypno)',
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
    hint: 'Legacy climb flag on a plant. Prefer grant_leaf_screen for Ant Builder leaf screens.',
    kind: 'insect',
  },
  {
    type: 'grant_leaf_screen',
    label: 'Grant leaf screen',
    hint: 'Give a nearby ally plant a leaf screen that absorbs up to 2 linear projectiles / 120 HP (Ant Builder)',
    kind: 'insect',
  },
  {
    type: 'delay_plant_attack',
    label: 'Delay plant attack',
    hint: 'Add delay to the next attack of nearby plants (Cricket Chirper / Cicada Singer)',
    kind: 'insect',
  },
  {
    type: 'column_skip',
    label: 'Column skip',
    hint: 'Advance one plant column without a full vault (Inchworm Skipper)',
    kind: 'insect',
  },
  {
    type: 'hop_evade',
    label: 'Hop evade',
    hint: 'Short hop past a plant and briefly raise projectile miss chance (Leafhopper Bouncer)',
    kind: 'insect',
  },
  {
    type: 'coil_roll',
    label: 'Coil roll',
    hint: 'Roll forward past the first plant (Pillbug Tumbler)',
    kind: 'insect',
  },
  {
    type: 'trap_skip',
    label: 'Trap skip',
    hint: 'Skip past the next ground hazard / trap in lane (Springtail Skipper)',
    kind: 'insect',
  },
  {
    type: 'apply_camouflage',
    label: 'Apply camouflage',
    hint: 'Lower auto-target priority so shooters prefer other insects (Katydid / Walking Leaf / Stickbug)',
    kind: 'insect',
  },
  {
    type: 'dust_veil',
    label: 'Dust veil',
    hint:
      'While this status is active, walking ground insects in columnRange × laneRange cannot be selected by ranged plants (Moon Moth Duster). Melee / area still hit. Flying and non-walk statuses stay targetable.',
    kind: 'insect',
  },
  {
    type: 'hide',
    label: 'Hide',
    hint:
      'Fade opacity and skip direct enemy targeting / chew. Still takes area damage (explode, splash). Use unhide on exit or set duration.',
    kind: 'plant',
  },
  {
    type: 'unhide',
    label: 'Unhide',
    hint: 'Clear hide — restore opacity and direct targeting',
    kind: 'plant',
  },
  {
    type: 'cleanse_move_debuff',
    label: 'Cleanse move debuff',
    hint: 'Clear chill/slow on self and nearby insect allies (Firefly Lantern)',
    kind: 'insect',
  },
  {
    type: 'leave_speed_trail',
    label: 'Leave speed trail',
    hint: 'Leave a short move-speed trail for allies in this lane (Glowworm Trail)',
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
    hint:
      'Heal plants. Mode: lowest_missing (Nectar Nurse), self, or self_behind (Bubble Aloe shell + host). amount = flat or max-HP fraction.',
    kind: 'plant',
  },
  {
    type: 'fly_to_ally',
    label: 'Fly to ally',
    hint:
      'Insect flies to an ally lane/column (mode: lowest_hp | random) at air height and locks SupportTarget. Pair with heal_insect. Optional mode return flies home. Cadence is graph after_seconds (healIntervalSeconds), not special_ready.',
    kind: 'insect',
  },
  {
    type: 'heal_insect',
    label: 'Heal insect',
    hint:
      'Heal an ally insect (mode: lowest_hp | random, or SupportTarget from fly_to_ally). amount = flat HP (Honeybee = 100).',
    kind: 'insect',
  },
  {
    type: 'fly_to_empty',
    label: 'Fly to empty cell',
    hint:
      'Fly to a random empty ground cell at air height (Butterfly Glider). Pair with place_egg_group after prepareSeconds.',
    kind: 'insect',
  },
  {
    type: 'place_egg_group',
    label: 'Place egg group',
    hint:
      'Lay a dirty egg group on this cell (not water). The egg hatches spawnInsectId on its own hatchIntervalSeconds timer — wave aphids are not moved onto eggs.',
    kind: 'insect',
  },
  {
    type: 'buff_attack_speed',
    label: 'Buff attack speed',
    hint: 'Briefly speed up nearby plants (Drum Gourd)',
    kind: 'plant',
  },
  {
    type: 'mark_priority_target',
    label: 'Mark priority target',
    hint: 'Mark the highest-HP insect in range; nearby shooters prefer it and deal bonus damage (Compass Fern)',
    kind: 'plant',
  },
  {
    type: 'echo_special',
    label: 'Echo special',
    hint: 'Arm a delayed burst on this plant at half fuse damage. Prefer arm_burst + extras when identical.',
    kind: 'plant',
  },
  {
    type: 'reflect_projectile',
    label: 'Reflect projectile',
    hint: 'Briefly reflect incoming linear projectiles (Mirror Ivy). Can also be driven by extras.reflectProjectiles.',
    kind: 'plant',
  },
  {
    type: 'knockback_insects',
    label: 'Knockback insects',
    hint:
      'Push insects in this lane back a set number of cells and deal damage. Optional impact mark makes shooters prioritize the shoved target (Chestnut Cannon).',
    kind: 'plant',
  },
  {
    type: 'grant_shield',
    label: 'Grant shield',
    hint: 'Temporary absorb shield (plant allies / self_behind for shell hosts)',
    kind: 'plant',
  },
  {
    type: 'suppress_special',
    label: 'Suppress special',
    hint: 'First contact suppresses a support/economy plant’s special (Ant Forager). duration = suppress window; cap = per-plant immunity seconds.',
    kind: 'insect',
  },
  {
    type: 'retreat_columns',
    label: 'Retreat columns',
    hint: 'Drift back toward spawn after a shot (Damselfly). amount = columns; duration = cooldown seconds. Uses SpecialReady.',
    kind: 'insect',
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
    hint: 'Pulse nearby plants with a slower attack interval (legacy slick debuff)',
    kind: 'insect',
  },
  {
    type: 'leave_gel',
    label: 'Leave gel',
    hint:
      'Paint a gel path cell (GelPath.png). Insects on gel move faster; plants cannot be placed on gel. Duration + scale from extras. Slug Slimer.',
    kind: 'insect',
  },
  {
    type: 'reduce_ally_cooldown',
    label: 'Reduce ally cooldown',
    hint:
      'Shorten nearby plants’ attack timers (Clockvine). amount = seconds; columnRange / laneRange = ally radius.',
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
    hint:
      'Slow insects in range (Mint Mist / Velcro). columnRange / laneRange set the pulse radius; duration / scale set chill.',
    kind: 'plant',
  },
  {
    type: 'discard_aerial_impact',
    label: 'Discard aerial impact',
    hint:
      'Umbrella canopy while this status is active (Vine Relay). columnRange / laneRange = protect area; toggles control bullets, thrown insects, and aerial drops.',
    kind: 'plant',
  },
  {
    type: 'bounce_hopper',
    label: 'Bounce hopper',
    hint:
      'While this status is active, hop/vault insects that target this plant are shoved back knockbackCells (Pillow Moss). Check Small insects only for Light landers.',
    kind: 'plant',
  },
  {
    type: 'bounce_bullet',
    label: 'Bounce bullet',
    hint:
      'While this status is active, enemy bullets that hit this plant bounce back toward insects (Pillow Moss). Optional scale damages the shooter.',
    kind: 'plant',
  },
  {
    type: 'buff_move_speed',
    label: 'Buff move speed',
    hint:
      'Mode via extra.speedBuffMode: aura | trail | cleanse_pulse | boss_pulse. Aura/boss_pulse use columnRange × laneRange affection (extra.speedBuffColumnRange / speedBuffLaneRange).',
    kind: 'insect',
  },
  {
    type: 'weaken_attack',
    label: 'Weaken attack',
    hint: 'Mode: damage_weaken (plant→insect dmg), plant_damage_weaken (insect→plant dmg), bite_slow | silk_tether | song_delay',
  },
  {
    type: 'dash',
    label: 'Dash',
    hint: 'Speed up only this insect, then optionally slow it. Scales and times come from extra.dashSpeedScale, dashSeconds, dashRecoverScale, dashRecoverSeconds.',
    kind: 'insect',
  },
  {
    type: 'arm_burst',
    label: 'Arm burst',
    hint: 'Once, after fuseDuration (extra.fuseSeconds), explode and leave. Re-entering does not reset the fuse.',
    kind: 'insect',
  },
];

/** Absolute overrides applied while the unit remains in this status. */
export interface StateStatModifiers {
  /**
   * Attack interval while in this status.
   * Bare number (milliseconds) or StateDurationValue (extra.shotIntervalMs / stats.attackIntervalMs).
   */
  attackIntervalMs?: number | StateDurationValue;
  /**
   * Absolute move speed while in this status (cells/s).
   * Bare number or StateDurationValue — prefer `extra.rollMoveSpeed` for Inchworm roll.
   * Used when {@link moveSpeedScale} is unset.
   */
  moveSpeed?: number | StateDurationValue;
  /**
   * Multiplier on base move speed while in this status.
   * Prefer `extra.rollSpeedScale` (e.g. 2 = double speed). Preferred over {@link moveSpeed} when set.
   */
  moveSpeedScale?: StateDurationValue;
  /**
   * Combat range while in this status.
   * Bare number or StateDurationValue (extra.shotRange / stats.range).
   */
  range?: number | StateDurationValue;
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
   * Predefined engine actions run while / around this status (including temporal holds).
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
        actions: [{ type: 'chomp_devour', when: 'after_anim', mode: 'trap' }],
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
        conditions: cond({ type: 'anim_ended' }, { type: 'chomp_killed' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: cond({ type: 'anim_ended' }, { type: 'no_chomp_killed' }),
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
          {
            type: 'deal_contact_damage',
            when: hasAttackAnim ? 'after_anim' : 'on_enter',
            damage: attributeDuration('stats.baseDamage'),
            contactTarget: 'nearest',
          },
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
        actions: [
          {
            type: 'hide',
            when: 'on_enter',
            scale: { kind: 'attribute', path: 'extra.hideOpacity' },
            duration: { kind: 'attribute', path: 'extra.hideSeconds' },
          },
          { type: 'unhide', when: 'on_exit' },
        ],
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

/** Bramble Bulwark: thorn retaliation once per melee hit (graph damage → extra.retaliationDamage). */
export function createRetaliationWallStateGraph(opts?: {
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
            type: 'deal_contact_damage',
            when: 'on_enter',
            damage: attributeDuration('extra.retaliationDamage'),
            contactTarget: 'biting',
          },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: idleId,
        to: attackId,
        // One return per attacker hit — not continuous while chewing, not DoT/projectile.
        conditions: cond({ type: 'being_bitten' }, { type: 'on_damaged' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: idleId,
        conditions: cond({ type: 'after_seconds', value: literalDuration(0.05) }),
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
  /** Catalog insect id for summon_insect.targetId */
  insectId?: string;
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
          {
            type: 'summon_insect',
            when: 'after_anim',
            ...(opts?.insectId ? { targetId: opts.insectId } : {}),
          },
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
  /** Catalog insect id for throw_unit.targetId */
  insectId?: string;
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
          {
            type: 'throw_unit',
            when: 'on_enter',
            ...(opts?.insectId ? { targetId: opts.insectId } : {}),
          },
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
  deal_contact_damage: 'deal_contact_damage',
  // Legacy close pulse → explode (normalizeAction forces mode=pulse).
  deal_area_damage: 'explode',
  squash_crush: 'squash_crush',
  chomp_devour: 'chomp_devour',
  explode: 'explode',
  produce_sun: 'produce_sun',
  clear_fog: 'clear_fog',
  light_fog: 'clear_fog',
  // Legacy map-wide clear → clear_fog (normalizeAction forces mode=all).
  clear_all_fog: 'clear_fog',
  blow_fog: 'clear_fog',
  reveal_camouflage: 'reveal_camouflage',
  strip_camouflage: 'reveal_camouflage',
  force_burrow_emerge: 'force_burrow_emerge',
  force_emerge: 'force_burrow_emerge',
  reveal_burrow: 'force_burrow_emerge',
  blow_away_flying: 'blow_away_flying',
  kill_flying: 'blow_away_flying',
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
  become_flyer: 'become_flyer',
  metamorphose_fly: 'become_flyer',
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
  fly_to_ally: 'fly_to_ally',
  heal_insect: 'heal_insect',
  fly_to_empty: 'fly_to_empty',
  place_egg_group: 'place_egg_group',
  buff_attack_speed: 'buff_attack_speed',
  knockback_insects: 'knockback_insects',
  grant_shield: 'grant_shield',
  suppress_special: 'suppress_special',
  retreat_columns: 'retreat_columns',
  brace: 'brace',
  chain_damage: 'chain_damage',
  leave_slick: 'leave_slick',
  leave_gel: 'leave_gel',
  reduce_ally_cooldown: 'reduce_ally_cooldown',
  pull_insect: 'pull_insect',
  apply_slow: 'apply_slow',
  buff_move_speed: 'buff_move_speed',
  weaken_attack: 'weaken_attack',
  dash: 'dash',
  arm_burst: 'arm_burst',
  mark_priority_target: 'mark_priority_target',
  delay_plant_attack: 'delay_plant_attack',
  column_skip: 'column_skip',
  hop_evade: 'hop_evade',
  coil_roll: 'coil_roll',
  trap_skip: 'trap_skip',
  grant_leaf_screen: 'grant_leaf_screen',
  apply_camouflage: 'apply_camouflage',
  dust_veil: 'dust_veil',
  hide: 'hide',
  unhide: 'unhide',
  cleanse_move_debuff: 'cleanse_move_debuff',
  leave_speed_trail: 'leave_speed_trail',
  echo_special: 'echo_special',
  reflect_projectile: 'reflect_projectile',
  discard_aerial_impact: 'discard_aerial_impact',
  block_aerial: 'discard_aerial_impact',
  umbrella_protect: 'discard_aerial_impact',
  bounce_hopper: 'bounce_hopper',
  bounce_vault: 'bounce_hopper',
  bounce_bullet: 'bounce_bullet',
  deflect_bullet: 'bounce_bullet',
};

function normalizeAction(raw: unknown): StateAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const rawType = typeof a.type === 'string' ? a.type.trim() : '';
  // Drop removed no-op / combo verbs (use after_seconds / clear_fog+blow_away_flying).
  if (rawType === 'begin_charge' || rawType === 'blow_away') return null;
  const type = rawType ? ACTION_ALIASES[rawType] : undefined;
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
    'fuseDuration',
    'amount',
    'duration',
    'scale',
    'cap',
    'hitScale0',
    'hitScale1',
    'hitScale2',
    'recoverScale',
    'recoverSeconds',
    'everyNth',
  ] as const;
  for (const key of paramKeys) {
    if (a[key] != null) {
      const parsed = normalizeDurationValue(a[key]);
      if (parsed) (action as unknown as Record<string, StateDurationValue>)[key] = parsed;
    }
  }
  // Legacy alias: contactEvery → everyNth for deal_contact_damage stun cadence.
  if (action.everyNth == null && a.contactEvery != null) {
    const parsed = normalizeDurationValue(a.contactEvery);
    if (parsed) action.everyNth = parsed;
  }
  if (a.unequippedOnly === true) action.unequippedOnly = true;
  // discard_aerial_impact toggles: omit = enabled; explicit false disables.
  if (typeof a.blockBullets === 'boolean') action.blockBullets = a.blockBullets;
  if (typeof a.blockThrown === 'boolean') action.blockThrown = a.blockThrown;
  if (typeof a.blockAerialDrop === 'boolean') action.blockAerialDrop = a.blockAerialDrop;
  if (typeof a.contactTarget === 'string') {
    const ct = a.contactTarget.trim().toLowerCase();
    if (ct === 'nearest' || ct === 'biting') action.contactTarget = ct;
  }
  if (typeof a.summonId === 'string' && a.summonId.trim()) {
    action.summonId = a.summonId.trim();
  }
  if (typeof a.targetId === 'string' && a.targetId.trim()) {
    action.targetId = a.targetId.trim();
  }
  if (typeof a.mode === 'string' && a.mode.trim()) {
    action.mode = a.mode.trim();
  }
  if (rawType === 'deal_area_damage' && !action.mode) {
    action.mode = 'pulse';
  }
  if ((rawType === 'clear_all_fog' || rawType === 'blow_fog') && !action.mode) {
    action.mode = 'all';
  }
  if (type === 'explode') {
    const style = normalizeExplodeVfxStyle(a.vfxStyle ?? a.explodeGfx);
    if (style) action.vfxStyle = style;
    // Pulse graphs often bind `damage`; blast uses `amount`. Keep both.
    if (action.amount == null && action.damage != null) action.amount = action.damage;
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
    case 'health_above':
      return [{ type: 'health_above', ratio: Number(t.ratio) || 0.5 }];
    default:
      return [];
  }
}

function normalizeCondition(raw: unknown): StateCondition | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as {
    type?: string;
    seconds?: number;
    ratio?: number;
    value?: unknown;
    minRange?: unknown;
  };
  switch (c.type) {
    case 'enemy_in_range': {
      const minRange = normalizeDurationValue(c.minRange);
      return minRange ? { type: 'enemy_in_range', minRange } : { type: 'enemy_in_range' };
    }
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
    case 'chomp_killed':
    case 'no_chomp_killed':
    case 'being_bitten':
    case 'player_command':
    case 'player_controlled':
    case 'ai_controlled':
    case 'vault_ready':
    case 'throw_ready':
    case 'special_ready':
    case 'reached_target':
    case 'boomerang_returned':
      return { type: c.type };
    case 'after_seconds':
      return { type: 'after_seconds', value: normalizeDurationValue(c.value ?? c) };
    case 'not_damaged_for':
      return {
        type: 'not_damaged_for',
        value:
          normalizeDurationValue(c.value ?? c) ??
          ({ kind: 'attribute', path: 'extra.healIdleSeconds' } as StateDurationValue),
      };
    case 'damage_hits_at_least':
      return {
        type: 'damage_hits_at_least',
        value: normalizeDurationValue(c.value ?? c) ?? { kind: 'literal', seconds: 3 },
      };
    case 'health_below':
      return {
        type: 'health_below',
        ratio: Math.min(1, Math.max(0, Number(c.ratio) || 0.5)),
      };
    case 'health_above':
      return {
        type: 'health_above',
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

/** Engine actions multi-select is one-of-each-type; keep first when duplicates sneak into JSON. */
function dedupeStateActions(actions: StateAction[]): StateAction[] | undefined {
  if (!actions.length) return undefined;
  const seen = new Set<string>();
  const out: StateAction[] = [];
  for (const a of actions) {
    if (seen.has(a.type)) continue;
    seen.add(a.type);
    out.push(a);
  }
  return out.length ? out : undefined;
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
        actions: Array.isArray(n.actions)
          ? dedupeStateActions(
              n.actions.map(normalizeAction).filter((a): a is StateAction => Boolean(a)),
            )
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
  if (m.attackIntervalMs !== undefined && m.attackIntervalMs !== null) {
    if (typeof m.attackIntervalMs === 'number' && Number.isFinite(m.attackIntervalMs)) {
      out.attackIntervalMs = m.attackIntervalMs;
    } else {
      out.attackIntervalMs = normalizeDurationValue(m.attackIntervalMs);
    }
  }
  if (m.moveSpeed !== undefined && m.moveSpeed !== null) {
    if (typeof m.moveSpeed === 'number' && Number.isFinite(m.moveSpeed)) {
      out.moveSpeed = m.moveSpeed;
    } else {
      out.moveSpeed = normalizeDurationValue(m.moveSpeed);
    }
  }
  if (m.moveSpeedScale !== undefined && m.moveSpeedScale !== null) {
    out.moveSpeedScale = normalizeDurationValue(m.moveSpeedScale);
  }
  if (m.range !== undefined && m.range !== null) {
    if (typeof m.range === 'number' && Number.isFinite(m.range)) {
      out.range = m.range;
    } else {
      out.range = normalizeDurationValue(m.range);
    }
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
      if (condition.type === 'enemy_in_range' && condition.minRange) {
        return `Target in range (min ${durationLabel(condition.minRange)})`;
      }
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
    case 'not_damaged_for':
      return `Not damaged for ${durationLabel(condition.value)}`;
    case 'health_below':
      return `Health < ${Math.round(condition.ratio * 100)}%`;
    case 'health_above':
      return `Health ≥ ${Math.round(condition.ratio * 100)}%`;
    case 'armor_broken':
      return 'Equipment lost';
    case 'chomp_killed':
      return 'Chomp ate target';
    case 'no_chomp_killed':
      return 'Chomp did not eat';
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
    case 'boomerang_returned':
      return 'Boomerang returned';
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
  if (kind === 'not_damaged_for')
    return {
      type: 'not_damaged_for',
      value: { kind: 'attribute', path: 'extra.healIdleSeconds' },
    };
  if (kind === 'health_below') return { type: 'health_below', ratio: 0.5 };
  if (kind === 'health_above') return { type: 'health_above', ratio: 0.5 };
  return { type: kind } as StateCondition;
}
