import { gardenPlantPlaceCoinCost } from './garden';

/** Coins, gems and leaf. */
export interface RetiredPlantCost {
  coin: number;
  gem: number;
  leaf: number;
}

/**
 * A plant taken out of the game. Its catalog row and art are gone, so what the refund needs
 * is kept here: the API takes it out of every roster and garden and pays back what was spent.
 */
export interface RetiredPlant {
  id: string;
  displayName: string;
  role: string;
  rarity: string;
  /** Its `upgrade.baseUpgradeCost` when it was retired (fed to `plant_upgrade_resource_cost`). */
  baseUpgradeCost: RetiredPlantCost;
  /** The mission whose first clear handed it out; owning it without that clear means it was bought. */
  unlockMissionId: string;
  /** Its gem buyout from the roster (resolveUnitUnlockGemCost). */
  unlockGemCost: number;
}

export const RETIRED_PLANTS: readonly RetiredPlant[] = [
  {
    id: 'chestnut_cannon',
    displayName: 'Chestnut Cannon',
    role: 'splash',
    rarity: 'legendary',
    baseUpgradeCost: { coin: 35, gem: 8, leaf: 10 },
    unlockMissionId: 'chapter_5_07',
    unlockGemCost: 400,
  },
];

export function findRetiredPlant(plantId: string | null | undefined): RetiredPlant | null {
  return RETIRED_PLANTS.find((p) => p.id === plantId) ?? null;
}

/**
 * What a player gets back for a retired plant: its gem buyout when they bought it (owned
 * without clearing its mission), every upgrade they bought for it (levels 1 → `level`, priced
 * by `upgradeCost(base, fromLevel)`), plus, per copy planted in their garden, its full
 * placement price and whatever it had grown and not yet harvested.
 */
export function retiredPlantRefund(input: {
  plant: RetiredPlant;
  level: number;
  /** True when the account cleared `plant.unlockMissionId`. */
  clearedUnlockMission: boolean;
  gardenSlots: Array<{ pendingCoin?: number; pendingGem?: number; pendingLeaf?: number }>;
  upgradeCost: (base: number, fromLevel: number) => number;
}): RetiredPlantCost {
  const refund: RetiredPlantCost = { coin: 0, gem: 0, leaf: 0 };
  if (!input.clearedUnlockMission) refund.gem += input.plant.unlockGemCost;
  const level = Math.max(1, Math.floor(input.level || 1));
  for (let from = 1; from < level; from++) {
    refund.coin += input.upgradeCost(input.plant.baseUpgradeCost.coin, from);
    refund.gem += input.upgradeCost(input.plant.baseUpgradeCost.gem, from);
    refund.leaf += input.upgradeCost(input.plant.baseUpgradeCost.leaf, from);
  }

  for (const slot of input.gardenSlots) {
    refund.coin += gardenPlantPlaceCoinCost({
      role: input.plant.role,
      rarity: input.plant.rarity,
      plantLevel: level,
    });
    refund.coin += Math.max(0, Math.floor(slot.pendingCoin ?? 0));
    refund.gem += Math.max(0, Math.floor(slot.pendingGem ?? 0));
    refund.leaf += Math.max(0, Math.floor(slot.pendingLeaf ?? 0));
  }

  return refund;
}
