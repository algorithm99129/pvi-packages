import type { EntityId } from './index';
import type { InsectArchetype } from './insect';
import type { ServerMapExport } from './map';
import type { MissionEntryGate, ServerMissionExport } from './mission';
import type { PlantRole } from './plant';
import type { ActivePotionBuff, UserPotionStack } from './potion';
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
  /**
   * @deprecated Upgrade cards removed — migrated into wallet.leaf.
   * Kept optional for saved docs during migration.
   */
  upgradeCards?: number;
}

export interface UserInsectProgress {
  insectId: EntityId;
  level: number;
  unlocked: boolean;
  /**
   * @deprecated Upgrade cards removed — migrated into wallet.leaf.
   * Kept optional for saved docs during migration.
   */
  upgradeCards?: number;
}

export interface UserMissionProgress {
  missionId: EntityId;
  status: MissionProgressStatus;
  stars: number;
  /** Difficulty cleared on the most recent successful run. */
  triedLevel?: MissionDifficulty;
  completedAt?: string;
  /** Successful clears of this mission (used for diminishing replay XP). */
  clearCount?: number;
}

/** Request body for POST /api/player/missions/complete */
export interface MissionCompleteRequest {
  missionId: EntityId;
  triedLevel: MissionDifficulty;
  /**
   * Stars earned this run (1–3). Server keeps the max with existing progress.
   * A victory always scores at least 1, so the endpoint rejects 0 rather than completing
   * the mission — see docs/PROGRESSION_AUDIT_2026-09-26.md P4.
   */
  stars: number;
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
  /** Owned enhancement potion stacks (shop inventory). */
  potions: UserPotionStack[];
  /** Timed garden potion buffs currently in effect. */
  activePotionBuffs: ActivePotionBuff[];
  /** Plant-side battle loadout (5 slots; potion ids or null). */
  defenderBattlePotionSlots: Array<EntityId | null>;
  /** Insect-side battle loadout (5 slots; potion ids or null). */
  attackerBattlePotionSlots: Array<EntityId | null>;
  /**
   * @deprecated Flat concat of defender + attacker. Kept for one-release readers;
   * prefer role-specific arrays.
   */
  battlePotionSlots?: Array<EntityId | null>;
  /** Combat strength from plants, insects, and garden (legacy aggregate). */
  strength: number;
  /** Insect deck CP × levelPower vs raid CP cap — used when this player is the attacker. */
  attackStrength: number;
  /** Placed plant DP × levelPower — used when this player is the defender. */
  defenseStrength: number;
  /** Strength / catalog balance version stamp (GDD 2.1). */
  balanceVersion: string;
  /** Skill rating from attack W/L (separate from army strength). */
  skillRating: number;
  /** Lifetime garden/room attack wins. */
  attackWins: number;
  attackLosses: number;
  /** Lifetime garden/room defense wins. */
  defenseWins: number;
  defenseLosses: number;
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
  'acorn_blaster',
  'sunleaf_banker',
];

/** Insects unlocked when a new account is created (classic: basic beetle only). */
export const STARTER_INSECT_IDS: EntityId[] = [
  'aphid_nibbler',
];

/**
 * Premium plants that are gem-shop only (no mission / hub unlock grants).
 * Author `server.unlockSource: 'event'` + `unlockGemCost` and gem `upgrade.baseUpgradeCost`.
 *
 * Must stay in step with `unlockSource: 'event'` in the catalog — `blocksMissionUnlock` is
 * what actually keeps a unit out of reward tables, so a name here that the catalog calls
 * `default` is only a stale comment. `burr_gatler` was such a name: listed as gem-only,
 * authored `default`, and granted by no mission, so it was purchase-only by omission. It is
 * now a chapter 2 story grant. `honeycomb_clover` moved the other way — see
 * docs/PROGRESSION_AUDIT_2026-09-26.md P1 / P5.
 */
export const GEM_ONLY_PLANT_IDS: EntityId[] = [
  'storm_tulip',
  'spore_lantern',
  'thistle_duelist',
  'honeycomb_clover',
];

/**
 * Premium insects that are gem-shop only (no mission / hub unlock grants).
 * Author `server.unlockSource: 'event'` + `unlockGemCost` and gem `upgrade.baseUpgradeCost`.
 *
 * `pillbug_tumbler` (chapter 3) and `firefly_lantern` (chapter 5 finale) are story grants
 * and were removed for the reason given on {@link GEM_ONLY_PLANT_IDS}.
 */
export const GEM_ONLY_INSECT_IDS: EntityId[] = [
  'silkworm_spinner',
  'earthworm_tunneler',
  'pebble_beetle',
  'bumble_queen',
];

/** Default roster upgrade base for gem-only units (coin replaced by gem). */
export const GEM_ONLY_UPGRADE_BASE: WalletResources = {
  coin: 0,
  gem: 40,
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
  /** Catalog ceiling (normally 20). */
  maxLevel: number;
  /**
   * Ceiling this account may currently upgrade to — `min(maxLevel, unitMaxLevelForAccount)`.
   * `atMax` and `upgradeCost` are computed against this, not `maxLevel`. §12.4.
   */
  accountMaxLevel: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    range: number;
    /** Seed-packet recharge seconds at this level. */
    rechargeSeconds: number;
  };
  /** Formula-evaluated stats at `level + 1`; `null` when locked or at max. */
  nextStats: UserPlantView['stats'] | null;
  upgradeCost: WalletResources | null;
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
  /** Catalog ceiling (normally 20). */
  maxLevel: number;
  /** Ceiling this account may currently upgrade to — see {@link UserPlantView.accountMaxLevel}. */
  accountMaxLevel: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    moveSpeed: number;
    /** Card recharge seconds at this level. */
    rechargeSeconds: number;
  };
  /** Formula-evaluated stats at `level + 1`; `null` when locked or at max. */
  nextStats: UserInsectView['stats'] | null;
  upgradeCost: WalletResources | null;
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
  /**
   * Soft power gate against `recommendedPlantLevel` — the first deterministic step of
   * SYSTEMS_ANALYSIS §12.5. The client reads `status` before launching; the API also rejects a
   * `missions/complete` for a `blocked` mission as a backstop.
   */
  entry: MissionEntryGate;
}
