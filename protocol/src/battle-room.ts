/** Live 1v1 battle room lobby + combat relay types. */

export type BattleRoomStatus = 'open' | 'waiting' | 'in_battle' | 'closed';

export type BattleRoomSide = 'defender' | 'attacker';

/** Allowed max battle lengths (seconds). Default = 5 minutes. */
export const BATTLE_ROOM_DURATION_OPTIONS_SEC = [300, 600, 900] as const;

export type BattleRoomDurationSec = (typeof BATTLE_ROOM_DURATION_OPTIONS_SEC)[number];

/** Combat outcome on an authoritative battle status snapshot. */
export type BattleRoomCombatOutcome = 'none' | 'defender_win' | 'attacker_win';

export interface BattleRoomSummary {
  id: string;
  hostUserId: string;
  hostDisplayName: string;
  /** Creator portrait id from Resources/Avatars. */
  hostAvatarId: string;
  /** Account level for the lv. badge. */
  hostLevel: number;
  /** Combat strength shown under the creator name (legacy aggregate). */
  hostStrength: number;
  /** Host attack strength for lobby comparison. */
  hostAttackStrength?: number;
  /** Host defense strength for lobby comparison. */
  hostDefenseStrength?: number;
  mapTemplateId: string;
  rewardCoin: number;
  rewardGem: number;
  /** Max battle length in seconds (300 / 600 / 900). */
  battleDurationSec: number;
  playerCount: number;
  status: BattleRoomStatus;
  /** Whether the host account is an AI bot. */
  hostPlayerType: 'human' | 'ai';
}

export interface BattleRoomPlayer {
  userId: string;
  displayName: string;
  avatarId: string;
  side: BattleRoomSide;
  ready: boolean;
  /**
   * Waiting-room character picks for this seat (plants if defender, insects if attacker).
   * Shared so both clients can preview the opponent's deck before Ready.
   */
  selectedIds?: string[];
  /** Alias of selectedIds when side is defender (optional convenience). */
  plantIds?: string[];
  /** Alias of selectedIds when side is attacker (optional convenience). */
  insectIds?: string[];
  /** Top insects + attack W/L — used for ATK vs DEF lobby comparison. */
  attackStrength?: number;
  /** Top plants + garden + defense W/L. */
  defenseStrength?: number;
}

export interface BattleRoomDetail extends BattleRoomSummary {
  players: BattleRoomPlayer[];
  youAreHost: boolean;
  /** Present when you are a member of this room. */
  yourSide?: BattleRoomSide;
  /** Set once battle starts — which client owns the sim. */
  simAuthorityUserId?: string;
}

export interface BattleRoomCreateRequest {
  mapTemplateId: string;
  rewardCoin?: number;
  rewardGem?: number;
  /** One of BATTLE_ROOM_DURATION_OPTIONS_SEC; defaults to 300. */
  battleDurationSec?: number;
}

/** Host lobby settings PATCH — omitted fields keep current values. */
export interface BattleRoomUpdateRequest {
  mapTemplateId?: string;
  rewardCoin?: number;
  rewardGem?: number;
  battleDurationSec?: number;
}

export interface BattleRoomJoinRequest {
  /** Empty body is fine; rooms are open join when seats remain. */
}

export interface BattleRoomReadyRequest {
  ready: boolean;
}

/** POST /battle-rooms/:id/loadout — publish waiting-room character picks. */
export interface BattleRoomLoadoutRequest {
  selectedIds: string[];
}

/** Response from POST /battle-rooms/:id/loadout. */
export interface BattleRoomLoadoutResult {
  roomId: string;
  userId: string;
  side: BattleRoomSide;
  selectedIds: string[];
  plantIds?: string[];
  insectIds?: string[];
  detail: BattleRoomDetail;
}

/** Payload emitted on socket `battle:start`. */
export interface BattleRoomStartPayload {
  roomId: string;
  mapTemplateId: string;
  /** Insect side's starting sun. */
  startingSun: number;
  /** Plant side's starting sun (it also earns sun during the fight). Absent on old servers. */
  defenderStartingSun?: number;
  battleDurationSec: number;
  players: BattleRoomPlayer[];
  /** Client that runs the authoritative Raid simulation. */
  simAuthorityUserId: string;
  /** Shared RNG seed for deterministic combat (optional until server sim). */
  rngSeed?: number;
}

/** One plant on the authoritative battle status snapshot. */
export interface BattleRoomStatusPlant {
  /** Stable instance id for peer reconciliation. */
  unitId: string;
  plantId: string;
  lane: number;
  column: number;
  level: number;
  hp: number;
  maxHp: number;
}

/** One insect on the authoritative battle status snapshot. */
export interface BattleRoomStatusInsect {
  unitId: string;
  insectId: string;
  lane: number;
  /** World-ish progress along the lane (column + fraction). */
  x: number;
  level: number;
  hp: number;
  maxHp: number;
}

/**
 * Full combat picture published by the sim authority.
 * Flat / array-friendly for Unity JsonUtility.
 */
export interface BattleRoomStatusSnapshot {
  roomId: string;
  seq: number;
  tickMs: number;
  sun: number;
  timeRemainingSec: number;
  outcome: BattleRoomCombatOutcome;
  /**
   * Attacker star score from lanes destroyed: floor(destroyed * 3 / laneCount).
   * 0 = attacker defeated / defender held; 1–3 = attacker victory tiers (3/6 lanes → 1★).
   */
  stars?: number;
  /** How many house lanes the attacker destroyed (0..laneCount). */
  lanesDestroyed?: number;
  plants: BattleRoomStatusPlant[];
  insects: BattleRoomStatusInsect[];
}

/** Attacker stars from lanes destroyed on a live / casual PvP board (3★ = all lanes). */
export function starsFromLaneClearPercent(
  lanesDestroyed: number,
  laneCount: number,
  maxStars = 3,
): number {
  const destroyed = Math.max(0, Math.floor(lanesDestroyed));
  const total = Math.max(1, Math.floor(laneCount));
  const cap = Math.max(0, Math.floor(maxStars));
  return Math.min(cap, Math.floor((destroyed * cap) / total));
}

/** Client→server / peer relay for live combat inputs. */
export interface BattleRoomActionEnvelope {
  roomId: string;
  /** Opaque action type, e.g. place_plant, remove_plant, deploy_insect. */
  type: string;
  /** Flat fields preferred (Unity JsonUtility); nested payload is legacy. */
  payload?: Record<string, unknown>;
  plantId?: string;
  insectId?: string;
  lane?: number;
  column?: number;
  level?: number;
  fromUserId?: string;
}

/** One persisted combat input on the server action log. */
export interface BattleRoomLoggedAction {
  seq: number;
  type: string;
  fromUserId: string;
  plantId?: string;
  insectId?: string;
  lane: number;
  column: number;
  level: number;
  at: string;
}

/** POST /battle-rooms/:id/actions — reliable input path (also mirrored on socket). */
export interface BattleRoomPostActionRequest {
  type: string;
  plantId?: string;
  insectId?: string;
  lane?: number;
  column?: number;
  level?: number;
}

export interface BattleRoomPostActionResult {
  ok: boolean;
  action: BattleRoomLoggedAction;
}

/** GET /battle-rooms/:id/actions?after=N */
export interface BattleRoomActionsResponse {
  roomId: string;
  latestSeq: number;
  actions: BattleRoomLoggedAction[];
}

/** Max actions retained per room on the server. */
export const BATTLE_ROOM_ACTION_LOG_MAX = 200;

export interface BattleRoomEndedRequest {
  winnerUserId: string;
  /**
   * Must match the authority's latest validated `battle:status` seq
   * (not required for mid-battle forfeit via leave).
   */
  statusSeq?: number;
}

export interface BattleRoomEndedResult {
  paid: boolean;
  rewardCoin: number;
  rewardGem: number;
  winnerUserId: string;
}

/** Socket.IO namespace path. */
export const BATTLE_ROOMS_SOCKET_NAMESPACE = '/battle-rooms';

export const BATTLE_ROOM_SOCKET_EVENTS = {
  roomUpdated: 'room:updated',
  roomClosed: 'room:closed',
  battleStart: 'battle:start',
  battleAction: 'battle:action',
  /** Authority publishes full combat snapshot; peers reconcile. */
  battleStatus: 'battle:status',
  battleEnded: 'battle:ended',
  /** Client asks server to subscribe after REST create/join. */
  subscribe: 'room:subscribe',
  /** Optional client hint; authoritative loadout is POST /loadout + room:updated. */
  roomLoadout: 'room:loadout',
} as const;

/**
 * Sun the INSECT side starts a room match with. It earns nothing during the fight, so this is
 * its whole army.
 */
export const BATTLE_ROOM_DEFAULT_STARTING_SUN = 2000;

/**
 * Sun the PLANT side starts with. It is deliberately less than the insect side's: the plant
 * side is paid throughout the fight (sky sun, and every producer it plants), and with equal
 * starting sun it simply out-built the raid — simulated raider win rate 23% at 2000 / 2000.
 * Both sides still start from an empty lawn with the same card limit and their own unit
 * levels; this is the split at which that fight is a coin flip.
 *
 * Measured (30 random 10-card decks a side, levels 1 and 10, n≈119 per cell), raider wins: plant side 700 → 59%, 850 → 57%, 1000 → 42%, 2000 → 23%. Paying the raider during the fight instead (40 or 80 sun per 10 s) barely moved it.
 * Re-measure: node scripts/generate-parity-scenarios.mjs --room --defender-sun 700,850,1000
 *             node scripts/run-sim-batch.mjs --scenarios --repeats 2
 */
export const BATTLE_ROOM_DEFENDER_STARTING_SUN = 900;

/** Sky sun the plant side is paid: RaidNaturalSunSpawner — 25, at best every 7 s. */
export const BATTLE_ROOM_SKY_SUN_AMOUNT = 25;
export const BATTLE_ROOM_SKY_SUN_MIN_INTERVAL_SEC = 7;

/**
 * Most sun a seat can have SPENT by `elapsedSec` into the fight — an upper bound the server
 * holds each side to. It is deliberately generous (it assumes every sky sun at the fastest
 * interval, and every producer planted at the first second), so an honest client is never
 * refused; what it stops is a client that simply spends sun it does not have.
 *
 *   plant side    its starting purse + sky sun + what its producers can have paid
 *   insect side   its starting purse + what it can have chewed out of the other side's producers
 */
export function battleRoomSpendCap(opts: {
  side: 'attacker' | 'defender';
  elapsedSec: number;
  /** Sum over the plant side's producers of (sun per payout ÷ payout interval), per second. */
  producerSunPerSec: number;
  /** Sun the insect side can chew out of the producers planted so far. */
  producerChewSun: number;
}): number {
  const elapsed = Math.max(0, Number(opts.elapsedSec) || 0);
  if (opts.side === 'attacker') {
    return BATTLE_ROOM_DEFAULT_STARTING_SUN + Math.max(0, Math.floor(opts.producerChewSun || 0));
  }
  const sky = BATTLE_ROOM_SKY_SUN_AMOUNT * (1 + Math.floor(elapsed / BATTLE_ROOM_SKY_SUN_MIN_INTERVAL_SEC));
  const producers = Math.ceil(Math.max(0, opts.producerSunPerSec || 0) * elapsed);
  return BATTLE_ROOM_DEFENDER_STARTING_SUN + sky + producers;
}

/** Starting sun for a seat in a room match. */
export function battleRoomStartingSun(side: 'attacker' | 'defender'): number {
  return side === 'defender' ? BATTLE_ROOM_DEFENDER_STARTING_SUN : BATTLE_ROOM_DEFAULT_STARTING_SUN;
}
/** Default max battle length: 5 minutes. */
export const BATTLE_ROOM_DEFAULT_BATTLE_DURATION_SEC = 300;
/** Lobby expires if battle has not started within this many seconds after create. */
export const BATTLE_ROOM_LOBBY_EXPIRE_SEC = 180;
export const BATTLE_ROOM_MAX_PLAYERS = 2;
/** Max characters selectable in the waiting-room deck. */
export const BATTLE_ROOM_MAX_LOADOUT = 10;
/** Max plants/insects allowed on a status snapshot. */
export const BATTLE_ROOM_STATUS_MAX_UNITS = 80;
/** Minimum ms between accepted battle:status publishes per room. */
export const BATTLE_ROOM_STATUS_MIN_INTERVAL_MS = 100;

export function normalizeBattleRoomDurationSec(value: unknown): BattleRoomDurationSec {
  const n = Math.floor(Number(value) || 0);
  if ((BATTLE_ROOM_DURATION_OPTIONS_SEC as readonly number[]).includes(n)) {
    return n as BattleRoomDurationSec;
  }
  return BATTLE_ROOM_DEFAULT_BATTLE_DURATION_SEC;
}
