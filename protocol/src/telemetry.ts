/**
 * Battle telemetry — one event per finished fight, from any mode.
 *
 * Exists so balance is measured rather than argued. Before this, mission pacing, difficulty
 * spreads and insect-mission budgets were all set from arithmetic and never observed; the only
 * recorded facts were daily counters (logins, raids started). Events are written by the Unity
 * client (real play and the dev auto-pilot alike) and aggregated per mission by the API.
 */

export type BattleTelemetryMode = 'mission' | 'garden_raid' | 'battle_room' | 'team_match';
export type BattleTelemetryOutcome = 'victory' | 'defeat' | 'abandoned';

export interface BattleTelemetryEvent {
  mode: BattleTelemetryMode;
  /** Mission id for `mode: 'mission'`; empty otherwise. */
  missionId?: string;
  side: 'defender' | 'attacker';
  /** Player-chosen difficulty (missions). */
  difficulty?: 'easy' | 'medium' | 'hard';
  mapTemplateId?: string;

  outcome: BattleTelemetryOutcome;
  stars: number;
  /** Seconds the fight actually lasted. */
  durationSec: number;
  /** Seconds the fight was allowed (attacker clock / wave schedule). */
  plannedDurationSec: number;

  lanesDestroyed: number;
  laneCount: number;

  /** Sun / insect budget the player started with. */
  budgetStart: number;
  /** Budget gained during the fight (sky sun, producers). 0 in an insect mission. */
  budgetEarned: number;
  budgetSpent: number;
  budgetLeft: number;

  /** Player plants placed during the fight (defender). */
  plantsPlaced: number;
  /** Plants on the board at the start (preset defence / garden snapshot). */
  plantsPreset: number;
  plantsLost: number;
  /** Insects the player deployed (attacker) or the waves spawned (defender). */
  insectsFielded: number;
  insectsLost: number;
  mowersTriggered: number;
  potionsUsed: number;

  /** Unit id → how many the player fielded. */
  fielded: Record<string, number>;
  /** Mean level of the units the player fielded. */
  meanUnitLevel: number;

  /** True when produced by the dev auto-pilot rather than a person. */
  simulated: boolean;
  /** Auto-pilot policy id, when simulated. */
  policy?: string;
  clientVersion?: string;
  balanceVersion?: string;
}

/** Aggregate over many events for one (mission, difficulty). */
export interface BattleTelemetrySummaryRow {
  mode: BattleTelemetryMode;
  missionId: string;
  side: 'defender' | 'attacker';
  difficulty: string;
  attempts: number;
  wins: number;
  /** 0–1. */
  winRate: number;
  meanStars: number;
  meanDurationSec: number;
  /** Mean share of the available budget that was spent, 0–1. */
  meanBudgetSpentShare: number;
  meanLanesDestroyed: number;
  meanPlantsLost: number;
  meanInsectsLost: number;
}

/* ------------------------------------------------------------- shop funnel */

/**
 * Shop funnel — what happens between a player opening the shop and money arriving.
 *
 * Before this the only purchase facts were the orders themselves, so conversion, the drop-off
 * between "saw the price" and "pressed Pay", and revenue per active player could not be
 * measured. The client sends the two steps only it can see (`shop_open`, `pay_click`); the API
 * records the rest from the order lifecycle (`order_created`, `method_chosen`, `order_paid`,
 * `order_closed`). Measurement only: nothing here grants anything.
 */
export type ShopFunnelEventKind =
  | 'shop_open'
  /** A cannot-afford moment that opened the shortfall sheet (`sku` = what was wanted, `source` = where). */
  | 'wall_hit'
  | 'pay_click'
  | 'order_created'
  | 'method_chosen'
  | 'order_paid'
  | 'order_closed';

/** The kinds a client may post to POST /telemetry/shop; the API writes the others itself. */
export const SHOP_FUNNEL_CLIENT_EVENTS: readonly ShopFunnelEventKind[] = ['shop_open', 'wall_hit', 'pay_click'];

export interface ShopFunnelEvent {
  event: ShopFunnelEventKind;
  /** The SKU in question, when there is one (not for `shop_open`). */
  sku?: string;
  /** Where in the UI it happened: 'dialog', 'treasure', 'website', 'pay_page'… */
  source?: string;
  /** 'crypto' | 'card' once known. */
  method?: string;
  /** 'web' | 'webgl' | 'android' | 'editor'. */
  platform?: string;
}

/** One SKU's row in the funnel. */
export interface ShopFunnelSkuRow {
  sku: string;
  payClicks: number;
  ordersCreated: number;
  paid: number;
  grossCents: number;
}

/** GET /telemetry/shop/funnel — the shop funnel over a window, for Studio. */
export interface ShopFunnelSummary {
  days: number;
  /** Sum of daily active users over the window (from the daily metrics), for ARPDAU. */
  activeUserDays: number;
  /** Distinct players who opened the shop. */
  shopOpeners: number;
  shopOpens: number;
  /** Cannot-afford moments that showed the shortfall sheet. */
  wallHits: number;
  /** Pay clicks made from the shortfall sheet (source starts with "wall"). */
  wallPayClicks: number;
  payClicks: number;
  ordersCreated: number;
  /** Method picks on the pay page or at order time. */
  methodChosen: { card: number; crypto: number };
  paidOrders: number;
  /** Distinct players with a paid order. */
  payers: number;
  grossCents: number;
  /** payers / distinct shop openers, 0–1. */
  openerConversion: number;
  /** grossCents / activeUserDays, in cents; 0 when no DAU was recorded. */
  arpdauCents: number;
  /** grossCents / payers, in cents. */
  arppuCents: number;
  bySku: ShopFunnelSkuRow[];
}
