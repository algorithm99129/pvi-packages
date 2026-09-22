import type { EntityId } from './index';

/** Damage contributes more than raw HP to unit power. */
export const STR_DAMAGE_WEIGHT_ID = 'STR_DAMAGE_WEIGHT';
export const STR_DAMAGE_WEIGHT_DEFAULT = 1.5;

/** Flat power per garden (village) level. */
export const STR_GARDEN_LEVEL_WEIGHT_ID = 'STR_GARDEN_LEVEL_WEIGHT';
export const STR_GARDEN_LEVEL_WEIGHT_DEFAULT = 80;

/** Multiplier on placed garden plant unit strengths. */
export const STR_GARDEN_PLANT_WEIGHT_ID = 'STR_GARDEN_PLANT_WEIGHT';
export const STR_GARDEN_PLANT_WEIGHT_DEFAULT = 0.35;

/** How many top roster plants (and insects) count toward player strength. */
export const STR_TOP_UNITS_DEFAULT = 10;

/**
 * Soft matchmaking band: prefer defenders whose defenseStrength is within this
 * percent of the attacker's attackStrength.
 */
export const STR_MATCHMAKE_BAND_PCT_DEFAULT = 15;

/** Relative strength gap (%) treated as a draw when auto-resolving. */
export const GOLD_CUP_DRAW_BAND_PCT_DEFAULT = 5;

export const GOLD_CUP_POINTS_WIN = 2;
export const GOLD_CUP_POINTS_DRAW = 1;
export const GOLD_CUP_POINTS_LOSS = 0;

export type SeasonMode = 'none' | 'gold_cup';

export type SeasonMatchStatus = 'scheduled' | 'completed' | 'bye';
export type SeasonMatchResult = 'home_win' | 'away_win' | 'draw' | 'bye';
export type SeasonMatchResolution = 'played' | 'auto_strength' | 'bye';

/** Authorable Gold Cup rules on a live_events season document. */
export interface GoldCupConfig {
  lockTeams: boolean;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  /** 0–100; |Δstrength|/max ≤ band% → draw on auto-resolve. */
  drawStrengthBandPct: number;
  topUnitsCount: number;
  /** UTC hour [0–23] when competition day rolls. */
  dayResetHourUtc: number;
  minTeamMembers: number;
  autoResolveUnplayed: boolean;
  /** When set, force both teams to this formation size for linked team matches. */
  formationSize?: 5 | 10;
}

export function defaultGoldCupConfig(
  partial?: Partial<GoldCupConfig> | null,
): GoldCupConfig {
  const rawSize = partial?.formationSize;
  const formationSize: 5 | 10 | undefined =
    rawSize === 5 || rawSize === 10 ? rawSize : undefined;
  return {
    lockTeams: partial?.lockTeams ?? true,
    pointsWin: Math.max(0, Math.floor(partial?.pointsWin ?? GOLD_CUP_POINTS_WIN)),
    pointsDraw: Math.max(0, Math.floor(partial?.pointsDraw ?? GOLD_CUP_POINTS_DRAW)),
    pointsLoss: Math.max(0, Math.floor(partial?.pointsLoss ?? GOLD_CUP_POINTS_LOSS)),
    drawStrengthBandPct: Math.max(
      0,
      Math.min(100, Number(partial?.drawStrengthBandPct ?? GOLD_CUP_DRAW_BAND_PCT_DEFAULT)),
    ),
    topUnitsCount: Math.max(
      1,
      Math.min(30, Math.floor(partial?.topUnitsCount ?? STR_TOP_UNITS_DEFAULT)),
    ),
    dayResetHourUtc: Math.max(
      0,
      Math.min(23, Math.floor(partial?.dayResetHourUtc ?? 0)),
    ),
    minTeamMembers: Math.max(1, Math.floor(partial?.minTeamMembers ?? 2)),
    autoResolveUnplayed: partial?.autoResolveUnplayed ?? true,
    formationSize,
  };
}

/** Evaluated combat stats for one unit. */
export interface UnitCombatStats {
  health: number;
  damage: number;
  level: number;
}

/**
 * Unit power from HP + weighted damage.
 * Level is already baked into health/damage via plant_stat_at_level.
 */
export function unitStrengthFromStats(
  stats: UnitCombatStats,
  damageWeight = STR_DAMAGE_WEIGHT_DEFAULT,
): number {
  const hp = Math.max(0, stats.health);
  const dmg = Math.max(0, stats.damage);
  const w = Number.isFinite(damageWeight) ? damageWeight : STR_DAMAGE_WEIGHT_DEFAULT;
  return Math.max(0, Math.round(hp + w * dmg));
}

export function sumTopN(values: number[], n: number): number {
  if (!values.length || n <= 0) return 0;
  return [...values]
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((sum, v) => sum + Math.max(0, v), 0);
}

export function gardenStrengthFromParts(
  gardenLevel: number,
  placedPlantStrengths: number[],
  levelWeight = STR_GARDEN_LEVEL_WEIGHT_DEFAULT,
  plantWeight = STR_GARDEN_PLANT_WEIGHT_DEFAULT,
): number {
  const levelPart = Math.max(0, gardenLevel) * levelWeight;
  const plantsPart =
    placedPlantStrengths.reduce((s, v) => s + Math.max(0, v), 0) * plantWeight;
  return Math.max(0, Math.round(levelPart + plantsPart));
}

export function playerStrengthFromParts(
  plantStrengths: number[],
  insectStrengths: number[],
  gardenStrength: number,
  topN = STR_TOP_UNITS_DEFAULT,
): number {
  return Math.max(
    0,
    Math.round(
      sumTopN(plantStrengths, topN)
        + sumTopN(insectStrengths, topN)
        + Math.max(0, gardenStrength),
    ),
  );
}

/** Laplace-smoothed win rate; 0/0 → 0.5. */
export function strengthRecordFactor(wins: number, losses: number): number {
  const w = Math.max(0, Math.floor(wins));
  const l = Math.max(0, Math.floor(losses));
  return (w + 1) / (w + l + 2);
}

/**
 * Attack / defense strength from roster power + W/L record.
 * `recordFactor` defaults to 0.5 (no games played).
 */
export function sideStrengthFromRoster(
  rosterStrength: number,
  wins: number,
  losses: number,
): number {
  const roster = Math.max(0, rosterStrength);
  const factor = strengthRecordFactor(wins, losses);
  return Math.max(0, Math.round(roster * (0.7 + 0.6 * factor)));
}

export function attackRosterFromInsects(
  insectStrengths: number[],
  topN = STR_TOP_UNITS_DEFAULT,
): number {
  return sumTopN(insectStrengths, topN);
}

export function defenseRosterFromPlants(
  plantStrengths: number[],
  gardenStrength: number,
  topN = STR_TOP_UNITS_DEFAULT,
): number {
  return Math.max(0, Math.round(sumTopN(plantStrengths, topN) + Math.max(0, gardenStrength)));
}

/** Legacy aggregate for Gold Cup / old UI. */
export function aggregatePlayerStrength(
  attackStrength: number,
  defenseStrength: number,
): number {
  return Math.max(
    0,
    Math.round((Math.max(0, attackStrength) + Math.max(0, defenseStrength)) / 2),
  );
}

/** True when |a-b|/max ≤ bandPct/100. */
export function strengthsWithinBand(
  a: number,
  b: number,
  bandPct = STR_MATCHMAKE_BAND_PCT_DEFAULT,
): boolean {
  const x = Math.max(0, a);
  const y = Math.max(0, b);
  const max = Math.max(x, y, 1);
  const band = Math.max(0, Math.min(100, bandPct)) / 100;
  return Math.abs(x - y) / max <= band;
}

/** Auto-resolve outcome from two team strengths. */
export function resolveMatchByStrength(
  homeStrength: number,
  awayStrength: number,
  drawBandPct = GOLD_CUP_DRAW_BAND_PCT_DEFAULT,
): 'home_win' | 'away_win' | 'draw' {
  const a = Math.max(0, homeStrength);
  const b = Math.max(0, awayStrength);
  const max = Math.max(a, b, 1);
  const ratio = Math.abs(a - b) / max;
  const band = Math.max(0, Math.min(100, drawBandPct)) / 100;
  if (ratio <= band) return 'draw';
  return a > b ? 'home_win' : 'away_win';
}

export interface SeasonStandingView {
  teamId: EntityId;
  teamName: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  strength: number;
  memberCount: number;
  rank: number;
}

export interface SeasonMatchView {
  id: EntityId;
  seasonId: EntityId;
  dayIndex: number;
  homeTeamId: EntityId;
  homeTeamName: string;
  awayTeamId?: EntityId;
  awayTeamName?: string;
  homeStrength: number;
  awayStrength: number;
  status: SeasonMatchStatus;
  result?: SeasonMatchResult;
  resolution?: SeasonMatchResolution;
  scheduledFor: string;
  resolvedAt?: string;
  /** Linked playable team-match document (formations / stars). */
  teamMatchId?: EntityId;
}

export interface SeasonTableView {
  seasonId: EntityId;
  seasonName: string;
  dayIndex: number;
  currentDay: number;
  totalDays: number;
  locked: boolean;
  standings: SeasonStandingView[];
  matches: SeasonMatchView[];
}

/**
 * Swiss-style pairing: sort by points then strength, pair neighbors,
 * prefer opponents not yet played.
 */
export function pairTeamsSwiss(input: {
  teams: Array<{ teamId: string; points: number; strength: number; playedTeamIds: string[] }>;
}): Array<{ homeTeamId: string; awayTeamId: string } | { byeTeamId: string }> {
  const remaining = [...input.teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.strength !== a.strength) return b.strength - a.strength;
    return a.teamId.localeCompare(b.teamId);
  });

  const pairs: Array<{ homeTeamId: string; awayTeamId: string } | { byeTeamId: string }> = [];
  const used = new Set<string>();

  for (let i = 0; i < remaining.length; i++) {
    const home = remaining[i];
    if (used.has(home.teamId)) continue;

    let opponentIndex = -1;
    for (let j = i + 1; j < remaining.length; j++) {
      const cand = remaining[j];
      if (used.has(cand.teamId)) continue;
      if (!home.playedTeamIds.includes(cand.teamId)) {
        opponentIndex = j;
        break;
      }
    }
    if (opponentIndex < 0) {
      for (let j = i + 1; j < remaining.length; j++) {
        const cand = remaining[j];
        if (!used.has(cand.teamId)) {
          opponentIndex = j;
          break;
        }
      }
    }

    used.add(home.teamId);
    if (opponentIndex < 0) {
      pairs.push({ byeTeamId: home.teamId });
      continue;
    }
    const away = remaining[opponentIndex];
    used.add(away.teamId);
    pairs.push({ homeTeamId: home.teamId, awayTeamId: away.teamId });
  }

  return pairs;
}

// ─── Balance version 2 (GDD 2.1 / PLAYER_STRENGTH.md) ───────────────────────

/** Stamp for scout / profile / room / team DTOs and telemetry. */
export const BALANCE_VERSION_STRENGTH = '2.1.0-gdd';

/** Competitive DP/CP ceiling (spent defense budget). */
export const COMPETITIVE_RAID_CP_CAP = 1500;

/** Level power: 1 + 0.058 × (L − 1), L clamped 1–20. */
export function levelPower(level: number): number {
  const L = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  return 1 + 0.058 * (L - 1);
}

export type InsectDeckSlot = {
  insectId: string;
  level: number;
  /** CP cost for this insect (GDD deploy cost). */
  cpCost: number;
};

export type PlacedPlantSlot = {
  plantId: string;
  level: number;
  /** DP cost for this plant. */
  dpCost: number;
};

/**
 * Attack army power from insect deck CP shares against raid CP cap
 * (= defender spent DP, capped at COMPETITIVE_RAID_CP_CAP).
 * Equal CP shares across deck; optional per-card share cap (default 30%).
 */
export function computeAttackStrength(opts: {
  raidCPCap: number;
  deck: InsectDeckSlot[];
  potionValue?: number;
  maxSharePct?: number;
}): number {
  const cap = Math.max(
    0,
    Math.min(COMPETITIVE_RAID_CP_CAP, Math.floor(Number(opts.raidCPCap) || 0)),
  );
  const deck = Array.isArray(opts.deck) ? opts.deck : [];
  if (deck.length === 0 || cap <= 0) {
    return Math.round(Math.max(0, Number(opts.potionValue) || 0));
  }

  const maxShare = Math.max(0.01, Math.min(1, (opts.maxSharePct ?? 30) / 100));
  const positive = deck.filter((s) => (Number(s.cpCost) || 0) > 0);
  const slots = positive.length > 0 ? positive : deck;
  const share = Math.min(1 / Math.max(1, slots.length), maxShare);

  let deckPower = 0;
  for (const slot of slots) {
    deckPower += share * levelPower(slot.level);
  }

  const potion = Math.max(0, Number(opts.potionValue) || 0);
  return Math.round(cap * deckPower + potion);
}

/**
 * Defense army power from placed plants only (not unlocked inventory).
 */
export function computeDefenseStrength(opts: {
  placed: PlacedPlantSlot[];
  mapMechanicDP?: number;
  itemBoxDP?: number;
}): number {
  let sum = 0;
  for (const slot of opts.placed ?? []) {
    const dp = Math.max(0, Number(slot.dpCost) || 0);
    sum += dp * levelPower(slot.level);
  }
  sum += Math.max(0, Number(opts.mapMechanicDP) || 0);
  sum += Math.max(0, Number(opts.itemBoxDP) || 0);
  return Math.round(sum);
}

/** PvP stars from destroyed lanes (GDD §10.7). */
export function starsFromDestroyedLanes(
  destroyedLanes: number,
  totalLanes: number,
): number {
  const total = Math.max(1, Math.floor(Number(totalLanes) || 1));
  const destroyed = Math.max(0, Math.floor(Number(destroyedLanes) || 0));
  return Math.max(0, Math.min(5, Math.floor((5 * destroyed) / total)));
}

/**
 * Skill rating from W/L — separate from army strength (does not multiply ATK/DEF).
 * Shrinks toward 0.5 for small samples.
 */
export function skillRatingFromRecord(wins: number, losses: number): number {
  const w = Math.max(0, Math.floor(Number(wins) || 0));
  const l = Math.max(0, Math.floor(Number(losses) || 0));
  const n = w + l;
  if (n <= 0) return 0.5;
  const p = w / n;
  const shrink = n / (n + 20);
  return Math.round((0.5 + (p - 0.5) * shrink) * 1000) / 1000;
}
