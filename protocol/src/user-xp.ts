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
  villageLevel: number;
  maxVillageLevel: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  xpProgress: number;
}

export function buildUserProgression(
  totalXp: number,
  villageLevel: number,
): UserProgression {
  const xp = Math.max(0, Math.floor(totalXp));
  const bar = xpBarFromTotal(xp);
  const maxVillageLevel = maxVillageLevelForUser(bar.userLevel);
  const village = Math.max(1, Math.min(MAX_VILLAGE_LEVEL, Math.floor(villageLevel) || 1));
  return {
    totalXp: xp,
    userLevel: bar.userLevel,
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
}

/**
 * XP awarded on a successful mission clear.
 * `round((40 + 15*stars + firstClearBonus) * difficultyMult)`
 */
export function missionXpGain(input: MissionXpGainInput): number {
  const stars = Math.max(0, Math.min(3, Math.floor(input.stars)));
  const firstClearBonus = input.firstClear ? 80 : 0;
  const base = 40 + 15 * stars + firstClearBonus;
  const mult = missionDifficultyCoinMultiplier(input.difficulty);
  return Math.round(base * mult);
}
