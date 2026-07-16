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
 * Die is special: not edged. HP ≤ 0 always enters die (plays die.spineAnim if
 * set, then despawns).
 */

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
  | 'die';

/** Built-in insect statuses. */
export type InsectGraphStatus =
  | 'walk'
  | 'attack'
  | 'enrage'
  | 'vault'
  | 'burrow'
  | 'emerge'
  | 'fly'
  | 'summon'
  | 'throw'
  | 'special'
  | 'die';

export type EntityGraphStatus = PlantGraphStatus | InsectGraphStatus;

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
  { id: 'digest', label: 'Digest', hint: 'Post-chomp recovery (Chomper)', defaultLoop: true },
  { id: 'hide', label: 'Hide', hint: 'Withdrawn (Scaredy-shroom)', defaultLoop: true },
  { id: 'produce', label: 'Produce', hint: 'Sun / resource pulse', defaultLoop: false },
  { id: 'die', label: 'Die', hint: 'Special — HP≤0 only; not edged', defaultLoop: false },
];

export const INSECT_GRAPH_STATUSES: ReadonlyArray<{
  id: InsectGraphStatus;
  label: string;
  hint: string;
  defaultLoop: boolean;
}> = [
  { id: 'walk', label: 'Walk', hint: 'Lane locomotion', defaultLoop: true },
  { id: 'attack', label: 'Attack', hint: 'Bite / smash', defaultLoop: false },
  { id: 'enrage', label: 'Enrage', hint: 'Faster after armor break', defaultLoop: true },
  { id: 'vault', label: 'Vault', hint: 'Jump first plant', defaultLoop: false },
  { id: 'burrow', label: 'Burrow', hint: 'Underground travel', defaultLoop: true },
  { id: 'emerge', label: 'Emerge', hint: 'Surface from burrow', defaultLoop: false },
  { id: 'fly', label: 'Fly', hint: 'Air locomotion', defaultLoop: true },
  { id: 'summon', label: 'Summon', hint: 'Call backup insects', defaultLoop: false },
  { id: 'throw', label: 'Throw', hint: 'Hurl Imp / projectile', defaultLoop: false },
  { id: 'special', label: 'Special', hint: 'One-shot ability (ladder, etc.)', defaultLoop: false },
  { id: 'die', label: 'Die', hint: 'Special — HP≤0 only; not edged', defaultLoop: false },
];

/** Edge conditions — all must be true (AND) for the transition. */
export type StateConditionKind =
  | 'enemy_in_range'
  | 'no_enemy_in_range'
  | 'enemy_in_proximity'
  | 'no_enemy_in_proximity'
  | 'attack_interval_ready'
  | 'anim_ended'
  | 'after_seconds'
  | 'prepare_complete'
  | 'on_damaged'
  | 'health_below'
  | 'armor_broken'
  | 'being_bitten'
  | 'player_command'
  | 'vault_ready'
  | 'throw_ready'
  | 'special_ready';

export type StateCondition =
  | { type: 'enemy_in_range' }
  | { type: 'no_enemy_in_range' }
  | { type: 'enemy_in_proximity' }
  | { type: 'no_enemy_in_proximity' }
  | { type: 'attack_interval_ready' }
  | { type: 'anim_ended' }
  | { type: 'after_seconds'; value: StateDurationValue }
  | { type: 'prepare_complete' }
  | { type: 'on_damaged' }
  | { type: 'health_below'; ratio: number }
  | { type: 'armor_broken' }
  | { type: 'being_bitten' }
  | { type: 'player_command' }
  | { type: 'vault_ready' }
  | { type: 'throw_ready' }
  | { type: 'special_ready' };

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
  {
    path: 'behavior.digestSeconds',
    label: 'behavior.digestSeconds',
    hint: 'Chomper digest duration (seconds)',
    kind: 'plant',
  },
  {
    path: 'behavior.prepareSeconds',
    label: 'behavior.prepareSeconds',
    hint: 'Arming / prepare duration (Potato Mine, etc.)',
    kind: 'plant',
  },
  {
    path: 'behavior.detonateDelaySeconds',
    label: 'behavior.detonateDelaySeconds',
    hint: 'Delay before instant explode (Cherry Bomb)',
    kind: 'plant',
  },
  {
    path: 'behavior.produceIntervalSeconds',
    label: 'behavior.produceIntervalSeconds',
    hint: 'Sun / resource production interval (Sunflower family)',
    kind: 'plant',
  },
  {
    path: 'stats.attackIntervalMs',
    label: 'stats.attackIntervalMs',
    hint: 'Attack interval converted from milliseconds to seconds',
    kind: 'both',
    fromMs: true,
  },
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
  } else if (path.startsWith('behavior.') && ctx.behavior) {
    raw = ctx.behavior[path.slice('behavior.'.length)];
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, meta?.fromMs ? n / 1000 : n);
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
    label: 'Armor broken',
    hint: 'Shield / newspaper / screen-door layer destroyed',
  },
  {
    type: 'being_bitten',
    label: 'Being bitten',
    hint: 'An insect started chewing this plant',
  },
  {
    type: 'player_command',
    label: 'Player command',
    hint: 'Manual fire / ability trigger (Cob Cannon)',
  },
  {
    type: 'vault_ready',
    label: 'Vault ready',
    hint: 'Has not used vault_over_plant yet this life',
  },
  {
    type: 'throw_ready',
    label: 'Throw ready',
    hint: 'Has not used throw_unit yet this life',
  },
  {
    type: 'special_ready',
    label: 'Special ready',
    hint: 'Has not used a one-shot special (ladder, etc.) yet',
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
  | 'despawn'
  | 'reset_attack_timer'
  | 'stop_moving'
  | 'start_moving'
  | 'vault_over_plant'
  | 'enter_burrow'
  | 'exit_burrow'
  | 'redirect_lane'
  | 'charm_insect'
  | 'steal_metal'
  | 'destroy_grave'
  | 'summon_insect'
  | 'throw_unit'
  | 'place_ladder'
  | 'apply_freeze'
  | 'smash_plant';

export type StateActionWhen = 'on_enter' | 'after_anim' | 'on_exit';

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
    hint: 'Launch projectile volley from client.bulletShots',
    kind: 'plant',
  },
  {
    type: 'deal_contact_damage',
    label: 'Deal contact damage',
    hint: 'Melee hit against current target',
  },
  {
    type: 'squash_crush',
    label: 'Squash crush',
    hint: 'Leap / crush target for huge damage (Squash)',
    kind: 'plant',
  },
  {
    type: 'chomp_devour',
    label: 'Chomp devour',
    hint: 'Instantly eat one target (Chomper)',
    kind: 'plant',
  },
  {
    type: 'explode',
    label: 'Explode',
    hint: 'Area / lane blast from behavior or defaults',
  },
  {
    type: 'produce_sun',
    label: 'Produce sun',
    hint: 'Spawn sun / photosynthesis pulse',
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
    type: 'redirect_lane',
    label: 'Redirect lane',
    hint: 'Send biting insect to an adjacent lane (Garlic)',
    kind: 'plant',
  },
  {
    type: 'charm_insect',
    label: 'Charm insect',
    hint: 'Convert biting insect to fight for the player (Hypno-shroom)',
    kind: 'plant',
  },
  {
    type: 'steal_metal',
    label: 'Steal metal',
    hint: 'Remove metal armor / bucket / ladder from insects in range (Magnet-shroom)',
    kind: 'plant',
  },
  {
    type: 'destroy_grave',
    label: 'Destroy grave',
    hint: 'Remove a grave tile under this plant (Grave Buster)',
    kind: 'plant',
  },
  {
    type: 'summon_insect',
    label: 'Summon insect',
    hint: 'Spawn backup insects in this lane (Dancing Firefly)',
    kind: 'insect',
  },
  {
    type: 'throw_unit',
    label: 'Throw / lob unit',
    hint: 'Hurl Imp / lobbed projectile ahead (Gargantuar, Catapult)',
    kind: 'insect',
  },
  {
    type: 'place_ladder',
    label: 'Place ladder',
    hint: 'Deploy a ladder on the blocking plant (Ladder Ant)',
    kind: 'insect',
  },
  {
    type: 'apply_freeze',
    label: 'Apply freeze',
    hint: 'Freeze / chill targets in blast or contact (Ice-shroom, Frost Roller)',
  },
  {
    type: 'smash_plant',
    label: 'Smash plant',
    hint: 'Instantly destroy the plant being chewed (Gargantuar smash)',
    kind: 'insect',
  },
];

/** Absolute overrides applied while the unit remains in this status. */
export interface StateStatModifiers {
  attackIntervalMs?: number;
  moveSpeed?: number;
  range?: number;
}

export interface EntityStateNode {
  id: string;
  status: EntityGraphStatus;
  /** Optional editor label; defaults to status name. */
  label?: string;
  /** Spine animation played while in this status (same skeleton for all statuses). */
  spineAnim?: string;
  /** Defaults from status catalog when omitted. */
  loop?: boolean;
  modifiers?: StateStatModifiers;
  /** Predefined engine actions run while / around this status. */
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
  spineAnim?: string;
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
          { type: 'squash_crush', when: 'after_anim' },
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
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const delay = opts?.delaySeconds ?? 0.65;
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
          { type: 'explode', when: 'after_anim' },
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
  /** @deprecated Prefer behavior.digestSeconds on the plant; edge uses attribute by default. */
  digestSeconds?: number;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const digestId = createStateNodeId();
  const digestDuration: StateDurationValue =
    opts?.digestSeconds !== undefined
      ? literalDuration(opts.digestSeconds)
      : attributeDuration('behavior.digestSeconds');
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

/** Insect lane walker: walk ↔ attack. */
export function createInsectWalkerStateGraph(opts?: {
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const walkId = createStateNodeId();
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
        position: { x: 80, y: 160 },
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
        position: { x: 360, y: 160 },
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
    ],
    die: { spineAnim: opts?.dieAnim },
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
          value: attributeDuration('behavior.produceIntervalSeconds'),
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
          { type: 'explode', when: 'after_anim' },
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

/** Cob Cannon: idle until player fires. */
export function createPlayerCommandStateGraph(opts?: {
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
        conditions: cond({ type: 'player_command' }),
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

/** Magnet-shroom: steal metal on interval when enemies in range. */
export function createMagnetStateGraph(opts?: {
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
          { type: 'steal_metal', when: hasAttackAnim ? 'after_anim' : 'on_enter' },
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

/** Grave Buster: destroy grave after short dig. */
export function createGraveBusterStateGraph(opts?: {
  idleAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  digSeconds?: number;
}): EntityStateGraph {
  const idleId = createStateNodeId();
  const attackId = createStateNodeId();
  const dig = opts?.digSeconds ?? 3;
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
          { type: 'destroy_grave', when: 'after_anim' },
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
        conditions: cond({ type: 'after_seconds', value: literalDuration(dig) }),
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
          { type: 'squash_crush', when: 'after_anim' },
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

/** Flyer: fly ↔ attack (Balloon Moth). */
export function createInsectFlyerStateGraph(opts?: {
  flyAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
}): EntityStateGraph {
  const flyId = createStateNodeId();
  const attackId = createStateNodeId();
  return {
    version: 1,
    entryNodeId: flyId,
    nodes: [
      {
        id: flyId,
        status: 'fly',
        spineAnim: opts?.flyAnim,
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
          { type: 'deal_contact_damage', when: 'after_anim' },
          { type: 'reset_attack_timer', when: 'after_anim' },
        ],
        position: { x: 360, y: 160 },
      },
    ],
    edges: [
      {
        id: createStateEdgeId(),
        from: flyId,
        to: attackId,
        conditions: cond({ type: 'enemy_in_range' }, { type: 'attack_interval_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: attackId,
        to: flyId,
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

/** Burrower: burrow → emerge → walk ↔ attack. */
export function createInsectBurrowStateGraph(opts?: {
  burrowAnim?: string;
  emergeAnim?: string;
  walkAnim?: string;
  attackAnim?: string;
  dieAnim?: string;
  burrowSeconds?: number;
}): EntityStateGraph {
  const burrowId = createStateNodeId();
  const emergeId = createStateNodeId();
  const walkId = createStateNodeId();
  const attackId = createStateNodeId();
  const burrowSeconds = opts?.burrowSeconds ?? 4;
  return {
    version: 1,
    entryNodeId: burrowId,
    nodes: [
      {
        id: burrowId,
        status: 'burrow',
        spineAnim: opts?.burrowAnim ?? opts?.walkAnim,
        loop: true,
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
        loop: false,
        actions: [
          { type: 'stop_moving', when: 'on_enter' },
          { type: 'exit_burrow', when: 'after_anim' },
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
        conditions: cond({ type: 'after_seconds', value: literalDuration(burrowSeconds) }),
      },
      {
        id: createStateEdgeId(),
        from: emergeId,
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
        modifiers: { moveSpeed: opts?.enrageMoveSpeed ?? 1.4 },
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

/** Jack-in-the-box style: walk then explode. */
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

/** Gargantuar: walk ↔ attack (smash), throw when health low. */
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
          { type: 'throw_unit', when: 'after_anim' },
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
        to: throwId,
        conditions: cond({ type: 'health_below', ratio }, { type: 'throw_ready' }),
      },
      {
        id: createStateEdgeId(),
        from: throwId,
        to: walkId,
        conditions: cond({ type: 'anim_ended' }),
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

/** Mirror flat legacy clip fields from the graph for older readers. */
export function mirrorPlantClipsFromGraph(graph: EntityStateGraph): {
  idle: string;
  attack?: string;
  aim?: string;
  init?: string;
  die?: string;
} {
  const byStatus = (s: EntityGraphStatus) =>
    graph.nodes.find((n) => n.status === s)?.spineAnim?.trim() || undefined;
  const idle =
    byStatus('idle') ||
    graph.nodes.find((n) => n.id === graph.entryNodeId)?.spineAnim?.trim() ||
    '';
  return {
    idle,
    attack: byStatus('attack'),
    aim: byStatus('aim'),
    init: byStatus('init'),
    die: graph.die.spineAnim?.trim() || undefined,
  };
}

export function mirrorInsectClipsFromGraph(graph: EntityStateGraph): {
  walk: string;
  attack?: string;
  die?: string;
} {
  const byStatus = (s: EntityGraphStatus) =>
    graph.nodes.find((n) => n.status === s)?.spineAnim?.trim() || undefined;
  const walk =
    byStatus('walk') ||
    graph.nodes.find((n) => n.id === graph.entryNodeId)?.spineAnim?.trim() ||
    '';
  return {
    walk,
    attack: byStatus('attack'),
    die: graph.die.spineAnim?.trim() || byStatus('die') || undefined,
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
  walk?: string;
  attack?: string;
  die?: string;
}): EntityStateGraph {
  return createInsectWalkerStateGraph({
    walkAnim: client.walk,
    attackAnim: client.attack,
    dieAnim: client.die,
  });
}

const ACTION_ALIASES: Record<string, StateActionKind> = {
  launch_bullet: 'fire_bullet',
  fire_bullet: 'fire_bullet',
  deal_contact_damage: 'deal_contact_damage',
  squash_crush: 'squash_crush',
  chomp_devour: 'chomp_devour',
  explode: 'explode',
  produce_sun: 'produce_sun',
  despawn: 'despawn',
  reset_attack_timer: 'reset_attack_timer',
  stop_moving: 'stop_moving',
  start_moving: 'start_moving',
  vault_over_plant: 'vault_over_plant',
  enter_burrow: 'enter_burrow',
  exit_burrow: 'exit_burrow',
  redirect_lane: 'redirect_lane',
  charm_insect: 'charm_insect',
  steal_metal: 'steal_metal',
  destroy_grave: 'destroy_grave',
  summon_insect: 'summon_insect',
  throw_unit: 'throw_unit',
  place_ladder: 'place_ladder',
  apply_freeze: 'apply_freeze',
  smash_plant: 'smash_plant',
};

function normalizeAction(raw: unknown): StateAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as { type?: string; when?: string };
  const type = a.type ? ACTION_ALIASES[a.type] : undefined;
  if (!type) return null;
  const when =
    a.when === 'on_enter' || a.when === 'after_anim' || a.when === 'on_exit' ? a.when : undefined;
  return when ? { type, when } : { type };
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
    case 'attack_interval_ready':
    case 'anim_ended':
    case 'prepare_complete':
    case 'on_damaged':
    case 'armor_broken':
    case 'being_bitten':
    case 'player_command':
    case 'vault_ready':
    case 'throw_ready':
    case 'special_ready':
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
    .map((n) => ({
      id: n.id,
      status: n.status as EntityGraphStatus,
      label: typeof n.label === 'string' ? n.label : undefined,
      spineAnim: typeof n.spineAnim === 'string' ? n.spineAnim : undefined,
      loop:
        typeof n.loop === 'boolean'
          ? n.loop
          : defaultLoopForStatus(kind, n.status as EntityGraphStatus),
      modifiers: n.modifiers,
      actions: Array.isArray(n.actions)
        ? n.actions.map(normalizeAction).filter((a): a is StateAction => Boolean(a))
        : undefined,
      position: {
        x: Number.isFinite(n.position?.x) ? (n.position!.x as number) : 80,
        y: Number.isFinite(n.position?.y) ? (n.position!.y as number) : 120,
      },
    }));
  if (nodes.length === 0) return null;
  const playable = nodes.filter((n) => n.status !== 'die');
  if (playable.length === 0) return null;

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
      return {
        id: e.id!,
        from: e.from!,
        to: e.to!,
        conditions,
        fromPort: normalizePort(legacy.fromPort),
        toPort: normalizePort(legacy.toPort),
      };
    })
    .filter(
      (e) =>
        e.conditions.length > 0 &&
        playable.some((n) => n.id === e.from) &&
        playable.some((n) => n.id === e.to),
    );

  const entryNodeId =
    typeof g.entryNodeId === 'string' && playable.some((n) => n.id === g.entryNodeId)
      ? g.entryNodeId
      : playable[0].id;
  const dieAnim =
    typeof g.die?.spineAnim === 'string'
      ? g.die.spineAnim
      : nodes.find((n) => n.status === 'die')?.spineAnim;
  return {
    version: 1,
    entryNodeId,
    nodes: playable,
    edges,
    die: { spineAnim: dieAnim || undefined },
  };
}

function normalizeDurationValue(raw: unknown): StateDurationValue {
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
