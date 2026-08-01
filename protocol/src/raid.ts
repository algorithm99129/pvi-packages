import type { EntityId } from './index';

/**
 * Upgrade cards granted per insect type used, multiplied by stars (1–3).
 * Tunable constant until a logic.json formula is authored.
 */
export const RAID_INSECT_CARDS_PER_STAR = 2;

/** Request body for POST /api/raids/garden/complete */
export interface GardenRaidCompleteRequest {
  /** Insect types deployed (or loadout) during the village attack. */
  insectIds: EntityId[];
  /** Stars earned this raid (0–3). */
  stars: number;
  victory: boolean;
  /** Optional defender account id (must not be the attacker). */
  defenderUserId?: string;
}

export interface InsectUpgradeCardClaim {
  insectId: EntityId;
  count: number;
}

/** Response from POST /api/raids/garden/complete */
export interface GardenRaidCompleteResult {
  upgradeCards: InsectUpgradeCardClaim[];
}
