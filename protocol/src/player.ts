import type { EntityId } from './index';
import type { InsectArchetype } from './insect';
import type { ServerMapExport } from './map';
import type { ServerMissionExport } from './mission';
import type { PlantRole } from './plant';
import type { UserProfile } from './user';
import type { UserProgression } from './user-xp';
import type { WalletResources } from './wallet';

export type MissionProgressStatus = 'locked' | 'available' | 'completed';

/** Difficulty the player chose when completing a mission. */
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface UserPlantProgress {
  plantId: EntityId;
  level: number;
  unlocked: boolean;
  /** Owned upgrade cards for this plant type (spent on level-ups). */
  upgradeCards?: number;
}

export interface UserInsectProgress {
  insectId: EntityId;
  level: number;
  unlocked: boolean;
  /** Owned upgrade cards for this insect type (spent on level-ups). */
  upgradeCards?: number;
}

export interface UserMissionProgress {
  missionId: EntityId;
  status: MissionProgressStatus;
  stars: number;
  /** Difficulty cleared on the most recent successful run. */
  triedLevel?: MissionDifficulty;
  completedAt?: string;
}

/** Request body for POST /api/player/missions/complete */
export interface MissionCompleteRequest {
  missionId: EntityId;
  triedLevel: MissionDifficulty;
  /** Stars earned this run (0–3). Server keeps the max with existing progress. */
  stars?: number;
}

export interface UserGameState {
  wallet: WalletResources;
  plants: UserPlantProgress[];
  insects: UserInsectProgress[];
  missions: UserMissionProgress[];
}

/** Authenticated player profile — account info, wallet, and XP / village progression. */
export interface PlayerProfile extends UserProfile, UserProgression {
  wallet: WalletResources;
  /** Combat strength from plants, insects, and garden. */
  strength: number;
  /** Current team id when the player belongs to a team; otherwise null. */
  teamId: string | null;
  /**
   * ISO timestamp while another player is currently raiding this garden.
   * Hub shows a sword overlay and blocks opening the garden until it expires / raid ends.
   */
  gardenUnderAttackUntil: string | null;
  /**
   * ISO timestamp for post-raid protection. Shielded gardens cannot be matchmade;
   * attacking another garden clears this early.
   */
  gardenSafeModeUntil: string | null;
}

/** Response from POST /api/player/missions/complete */
export interface MissionCompleteResult extends UserProgression {
  progress: UserMissionProgress;
  xpGained: number;
  /** Plant unlocked by this first clear (classic seed-packet reward). */
  unlockPlantId?: EntityId;
  /** Insect unlocked by this first clear, if any. */
  unlockInsectId?: EntityId;
}

/** Plants unlocked when a new account is created (Peashooter + Sunflower). */
export const STARTER_PLANT_IDS: EntityId[] = [
  'peashooter',
  'sun_flower',
];

/** Insects unlocked when a new account is created (classic: basic beetle only). */
export const STARTER_INSECT_IDS: EntityId[] = [
  'worker_beetle',
];

/**
 * Premium plants that are gem-shop only (no mission / hub unlock grants).
 * Author `server.unlockSource: 'event'` + `unlockGemCost` and gem `upgrade.baseUpgradeCost`.
 */
export const GEM_ONLY_PLANT_IDS: EntityId[] = [
  'gatling_pea',
  'doom_shroom',
  'winter_melon',
  'spikerock',
  'twin_sunflower',
];

/**
 * Premium insects that are gem-shop only (no mission / hub unlock grants).
 * Author `server.unlockSource: 'event'` + `unlockGemCost` and gem `upgrade.baseUpgradeCost`.
 */
export const GEM_ONLY_INSECT_IDS: EntityId[] = [
  'jack_in_the_box_flea',
  'bungee_spider',
  'digger_cricket',
  'frost_roller_beetle',
  'red_gargantuar_beetle',
  'dancing_firefly',
];

/** Default roster upgrade base for gem-only units (coin replaced by gem). */
export const GEM_ONLY_UPGRADE_BASE: WalletResources = {
  coin: 0,
  gem: 25,
  leaf: 2,
};

/** Rarity → gem buyout when `server.unlockGemCost` is omitted (non-starters). */
export function defaultUnlockGemCost(rarity: string | null | undefined): number {
  switch ((rarity ?? 'common').trim().toLowerCase()) {
    case 'uncommon':
      return 100;
    case 'rare':
      return 175;
    case 'epic':
      return 275;
    case 'legendary':
      return 400;
    default:
      return 50;
  }
}

/**
 * Gem cost to unlock a locked plant/insect from the roster.
 * Starters → 0. Explicit `unlockGemCost` wins. Otherwise rarity default
 * so mission units remain gem-buyable without per-unit authorship.
 */
export function resolveUnitUnlockGemCost(input: {
  id: EntityId;
  rarity?: string | null;
  unlockGemCost?: number | null;
  kind: 'plant' | 'insect';
}): number {
  if (input.kind === 'plant' && STARTER_PLANT_IDS.includes(input.id)) return 0;
  if (input.kind === 'insect' && STARTER_INSECT_IDS.includes(input.id)) return 0;
  const explicit = Math.max(0, Math.floor(Number(input.unlockGemCost) || 0));
  if (explicit > 0) return explicit;
  return defaultUnlockGemCost(input.rarity);
}

/**
 * Mission / hub reward unlocks must not grant gem-shop (`event`) units.
 */
export function blocksMissionUnlock(unlockSource: string | null | undefined): boolean {
  return (unlockSource ?? '').trim().toLowerCase() === 'event';
}

export interface UserPlantView {
  id: EntityId;
  role: PlantRole;
  rarity: string;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    range: number;
  };
  /** Formula-evaluated stats at `level + 1`; `null` when locked or at max. */
  nextStats: UserPlantView['stats'] | null;
  upgradeCost: WalletResources | null;
  /** Owned upgrade cards for this plant. */
  upgradeCards: number;
  /** Cards required for the next level; `null` when locked or at max. */
  upgradeCardsRequired: number | null;
  /** Gem cost to unlock while locked; `null` if already unlocked or not gem-purchasable. */
  unlockCost: WalletResources | null;
}

export interface UpgradePlantResult {
  plant: UserPlantView;
  wallet: WalletResources;
}

/** Same payload shape as upgrade — spent gems and unlocked roster row. */
export type UnlockPlantResult = UpgradePlantResult;

export interface UserInsectView {
  id: EntityId;
  archetype: InsectArchetype;
  rarity: string;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    moveSpeed: number;
  };
  /** Formula-evaluated stats at `level + 1`; `null` when locked or at max. */
  nextStats: UserInsectView['stats'] | null;
  upgradeCost: WalletResources | null;
  /** Owned upgrade cards for this insect. */
  upgradeCards: number;
  /** Cards required for the next level; `null` when locked or at max. */
  upgradeCardsRequired: number | null;
  /** Gem cost to unlock while locked; `null` if already unlocked or not gem-purchasable. */
  unlockCost: WalletResources | null;
}

export interface UpgradeInsectResult {
  insect: UserInsectView;
  wallet: WalletResources;
}

export type UnlockInsectResult = UpgradeInsectResult;

/** Full mission definition plus the authenticated player's progress. */
export interface MissionDetailView extends ServerMissionExport {
  progress: UserMissionProgress;
  map: ServerMapExport;
}
