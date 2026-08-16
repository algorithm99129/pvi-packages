/** Live 1v1 battle room lobby + combat relay types. */

export type BattleRoomStatus = 'open' | 'waiting' | 'in_battle' | 'closed';

export type BattleRoomSide = 'defender' | 'attacker';

/** Allowed max battle lengths (seconds). Default = 5 minutes. */
export const BATTLE_ROOM_DURATION_OPTIONS_SEC = [300, 600, 900] as const;

export type BattleRoomDurationSec = (typeof BATTLE_ROOM_DURATION_OPTIONS_SEC)[number];

export interface BattleRoomSummary {
  id: string;
  hostDisplayName: string;
  mapTemplateId: string;
  rewardCoin: number;
  rewardGem: number;
  /** Max battle length in seconds (300 / 600 / 900). */
  battleDurationSec: number;
  playerCount: number;
  status: BattleRoomStatus;
}

export interface BattleRoomPlayer {
  userId: string;
  displayName: string;
  avatarId: string;
  side: BattleRoomSide;
  ready: boolean;
}

export interface BattleRoomDetail extends BattleRoomSummary {
  players: BattleRoomPlayer[];
  youAreHost: boolean;
  /** Present when you are a member of this room. */
  yourSide?: BattleRoomSide;
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

/** Payload emitted on socket `battle:start`. */
export interface BattleRoomStartPayload {
  roomId: string;
  mapTemplateId: string;
  startingSun: number;
  battleDurationSec: number;
  players: BattleRoomPlayer[];
}

/** Client→server / peer relay for live combat. */
export interface BattleRoomActionEnvelope {
  roomId: string;
  /** Opaque action type, e.g. place_plant, remove_plant, deploy_insect. */
  type: string;
  /** JSON-serializable payload fields. */
  payload?: Record<string, unknown>;
}

export interface BattleRoomEndedRequest {
  winnerUserId: string;
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
  battleEnded: 'battle:ended',
  /** Client asks server to subscribe after REST create/join. */
  subscribe: 'room:subscribe',
} as const;

export const BATTLE_ROOM_DEFAULT_STARTING_SUN = 2000;
/** Default max battle length: 5 minutes. */
export const BATTLE_ROOM_DEFAULT_BATTLE_DURATION_SEC = 300;
export const BATTLE_ROOM_MAX_PLAYERS = 2;

export function normalizeBattleRoomDurationSec(value: unknown): BattleRoomDurationSec {
  const n = Math.floor(Number(value) || 0);
  if ((BATTLE_ROOM_DURATION_OPTIONS_SEC as readonly number[]).includes(n)) {
    return n as BattleRoomDurationSec;
  }
  return BATTLE_ROOM_DEFAULT_BATTLE_DURATION_SEC;
}
