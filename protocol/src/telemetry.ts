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
