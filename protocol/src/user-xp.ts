import { GARDEN_MAX_LEVEL } from './garden';
import { missionDifficultyCoinMultiplier } from './mission';

/** Account level cap (can exceed village max for headroom). */
export const MAX_USER_LEVEL = 50;

/** Village / garden level cap (GDD map bands). */
export const MAX_VILLAGE_LEVEL = GARDEN_MAX_LEVEL;

/** XP required to advance from user level `n` → `n + 1`. */
export function xpToNext(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return Math.round(100 * n ** 1.4);
}

/** Cumulative XP required to *reach* user level `L` (from level 1). */
export function cumXp(level: number): number {
  const L = Math.max(1, Math.floor(level));
  let sum = 0;
  for (let n = 1; n < L; n++) {
    sum += xpToNext(n);
  }
  return sum;
}

/** Highest user level unlocked by `totalXp`, clamped to {@link MAX_USER_LEVEL}. */
export function levelFromXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_USER_LEVEL && xp >= cumXp(level + 1)) {
    level += 1;
  }
  return level;
}

// ─────────────────────────────────────────────────────────────────────────────
// Level-up rewards
//
// Reaching an account level pays a one-off bundle the player claims from the level-up
// dialogue (the claim is explicit so the moment is seen, not silently banked). Sized against
// the shop: coins are cheap (10,000 for $1.99), gems are the play-loop faucet (~100 a day for
// an engaged player), leaves trade at ~3 gems each. Every fifth level is a milestone and pays
// double. Level 1 is the starting level and pays nothing.
// ─────────────────────────────────────────────────────────────────────────────

export interface LevelUpReward {
  level: number;
  coin: number;
  gem: number;
  leaf: number;
  /** Every fifth level pays double. */
  milestone: boolean;
}

/** What reaching account level `level` pays. */
export function levelUpReward(level: number): LevelUpReward {
  const L = Math.max(1, Math.floor(Number(level) || 1));
  if (L <= 1) return { level: L, coin: 0, gem: 0, leaf: 0, milestone: false };
  const milestone = L % 5 === 0;
  const mult = milestone ? 2 : 1;
  return {
    level: L,
    coin: (150 + 50 * L) * mult,
    gem: (10 + 2 * L) * mult,
    leaf: (5 + 2 * L) * mult,
    milestone,
  };
}

/** Rewards for every level above `claimedLevel` up to and including `userLevel`. */
export function pendingLevelUpRewards(claimedLevel: number, userLevel: number): LevelUpReward[] {
  const from = Math.max(1, Math.floor(Number(claimedLevel) || 1));
  const to = Math.max(from, Math.min(MAX_USER_LEVEL, Math.floor(Number(userLevel) || 1)));
  const out: LevelUpReward[] = [];
  for (let l = from + 1; l <= to; l++) out.push(levelUpReward(l));
  return out;
}

/** POST /player/level-rewards/claim */
export interface LevelRewardClaimResult {
  /** Levels paid out by this call, lowest first (empty when nothing was pending). */
  levels: number[];
  /** Highest level whose reward is now claimed. */
  levelRewardClaimed: number;
  coin: number;
  gem: number;
  leaf: number;
  wallet: { coin: number; gem: number; leaf: number };
}

/** Max village level allowed for this user level. */
export function maxVillageLevelForUser(userLevel: number): number {
  return Math.min(Math.max(1, Math.floor(userLevel)), MAX_VILLAGE_LEVEL);
}

export interface UserXpBar {
  userLevel: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  /** 0…1 within current level; 1 at max user level. */
  xpProgress: number;
}

export function xpBarFromTotal(totalXp: number): UserXpBar {
  const xp = Math.max(0, Math.floor(totalXp));
  const userLevel = levelFromXp(xp);
  const xpIntoLevel = xp - cumXp(userLevel);
  const xpToNextLevel = userLevel >= MAX_USER_LEVEL ? 0 : xpToNext(userLevel);
  const xpProgress =
    xpToNextLevel <= 0 ? 1 : Math.min(1, Math.max(0, xpIntoLevel / xpToNextLevel));
  return { userLevel, xpIntoLevel, xpToNextLevel, xpProgress };
}

/** Full progression snapshot derived from stored XP + village level. */
export interface UserProgression {
  totalXp: number;
  userLevel: number;
  /** Highest account level whose level-up reward has been claimed (≥ 1). */
  levelRewardClaimed: number;
  villageLevel: number;
  maxVillageLevel: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  xpProgress: number;
}

export function buildUserProgression(
  totalXp: number,
  villageLevel: number,
  levelRewardClaimed = 1,
): UserProgression {
  const xp = Math.max(0, Math.floor(totalXp));
  const bar = xpBarFromTotal(xp);
  const maxVillageLevel = maxVillageLevelForUser(bar.userLevel);
  const village = Math.max(1, Math.min(MAX_VILLAGE_LEVEL, Math.floor(villageLevel) || 1));
  return {
    totalXp: xp,
    userLevel: bar.userLevel,
    levelRewardClaimed: Math.max(1, Math.min(bar.userLevel, Math.floor(levelRewardClaimed) || 1)),
    villageLevel: village,
    maxVillageLevel,
    xpIntoLevel: bar.xpIntoLevel,
    xpToNextLevel: bar.xpToNextLevel,
    xpProgress: bar.xpProgress,
  };
}

export interface MissionXpGainInput {
  /** Stars earned this run (0–3). */
  stars: number;
  firstClear: boolean;
  difficulty: string | undefined;
  /**
   * How many successful clears this mission already has before this run.
   * Used to diminish replay XP (first clear ignores this).
   */
  priorClears?: number;
  /**
   * Stars already banked on this mission before this run. On `hard`, a mission banked at 3★
   * pays no replay XP at all — see SYSTEMS_ANALYSIS §12.7 (G4).
   */
  bankedStars?: number;
}

/**
 * XP awarded on a successful mission clear.
 * `round((40 + 15*stars + firstClearBonus) * difficultyMult * replayMult)`
 *
 * Replay mult = max(0.15, 1 − 0.15 × priorClears) so grinding the shortest
 * mission is no longer optimal XP/hour after a few clears.
 */
export function missionXpGain(input: MissionXpGainInput): number {
  const stars = Math.max(0, Math.min(3, Math.floor(input.stars)));
  const firstClearBonus = input.firstClear ? 80 : 0;
  const base = 40 + 15 * stars + firstClearBonus;
  const mult = missionDifficultyCoinMultiplier(input.difficulty);
  let xp = Math.round(base * mult);
  if (!input.firstClear) {
    // G4: once a hard mission is banked at 3★ there is nothing left to earn from it. Easy and
    // medium keep the sliding decay below as a catch-up lane.
    const banked = Math.max(0, Math.floor(input.bankedStars ?? 0));
    if (String(input.difficulty ?? '').toLowerCase() === 'hard' && banked >= 3) return 0;

    const prior = Math.max(0, Math.floor(input.priorClears ?? 0));
    const replayMult = Math.max(0.15, 1 - 0.15 * prior);
    xp = Math.round(xp * replayMult);
  }
  return xp;
}

/** Soft daily cap for non-mission XP sources (raids / rooms / team). */
export const DAILY_COMPETITIVE_XP_CAP = 400;

/** Garden raid XP: 8 + 6×stars (1–5), small and star-scaled. */
export function gardenRaidXpGain(stars: number): number {
  const s = Math.max(0, Math.min(5, Math.floor(stars)));
  return 8 + 6 * s;
}

/** Battle room finish XP (both sides). */
export function battleRoomXpGain(): number {
  return 45;
}

/** Team-match raid attempt XP. */
export function teamMatchRaidXpGain(stars: number): number {
  const s = Math.max(0, Math.min(5, Math.floor(stars)));
  return 10 + 4 * s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitive gems — SYSTEMS_ANALYSIS §12.3
//
// Before this, every gem faucet was a calendar tick (login, dailies, one-time streaks); the
// campaign, raids, rooms and war all paid zero, so playing more never produced more gems. That
// made the 2–3 year F2P roster target (G5) unreachable by an order of magnitude. These gains put
// gems in the play loop under the same soft daily cap shape as competitive XP.
//
// The cap is reachable only with volume, which is what produces the ramp §12.1 relies on.
//
// Sized with scripts/model-progression.mjs (2026-10-02). The first numbers (raid 2 + 2×stars,
// room 10 / 4) assumed five-star raids; at the legal raid budget a raid takes ONE lane or none,
// so a raid paid about 3 gems, an engaged free player earned ~57 gems a day, and the roster
// (118,000 gems) was a 5.7-year project against a 2–3 year target. Doubling the gains puts that
// player near 100 a day (≈3.3 years) and one who plays to the cap at ≈2.4 years.
// ─────────────────────────────────────────────────────────────────────────────

/** Soft daily cap for gems from raids / rooms / team matches. */
export const DAILY_COMPETITIVE_GEM_CAP = 120;

/**
 * Garden raid gems: 4 + 4×stars (0–5). A loss pays the floor only when the raid was really
 * fought ({@link GARDEN_RAID_COMMIT_SHARE} of the budget spent) — otherwise starting a raid and
 * walking away would be the fastest gem farm in the game.
 */
export function gardenRaidGemGain(stars: number): number {
  const s = Math.max(0, Math.min(5, Math.floor(stars)));
  return 4 + 4 * s;
}

/** Share of the raid budget that must be spent for a lost raid to pay its floor. */
export const GARDEN_RAID_COMMIT_SHARE = 0.5;

/** Battle room gems: both seats are paid, the winner more. */
export function battleRoomGemGain(won: boolean): number {
  return won ? 16 : 8;
}

/** Team-match raid attempt gems: 6 + 4×stars (0–5). */
export function teamMatchRaidGemGain(stars: number): number {
  const s = Math.max(0, Math.min(5, Math.floor(stars)));
  return 6 + 4 * s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Account level → unit level cap — SYSTEMS_ANALYSIS §12.4
//
// Village is capped at 10 and account 10 (9,237 XP) is covered by the campaign alone, which left
// account levels 11–50 gating nothing and made competitive XP inert. Tying the roster's upgrade
// ceiling to account level gives those levels a job and makes XP buy the right to spend gems.
//
//   account 10 → 10 · 14 → 12 · 20 → 15 · 26 → 18 · 30 → 20 (full cap); 31–50 are headroom.
// ─────────────────────────────────────────────────────────────────────────────

/** Account level at which the full unit level cap unlocks. */
export const UNIT_CAP_FULL_AT_ACCOUNT_LEVEL = 30;

/** Highest unit level this account level may upgrade to. */
export function unitMaxLevelForAccount(accountLevel: number, hardMax = 20): number {
  const a = Math.max(1, Math.floor(Number(accountLevel) || 1));
  const cap = 10 + Math.floor(Math.max(0, a - 10) / 2);
  return Math.max(1, Math.min(hardMax, cap));
}
