/**
 * Village unlocks: which hub buildings ("villages") a player may open, and what opens them.
 *
 * A new account starts with a quiet hub and the villages open one at a time as the player
 * levels up or clears missions. The table is authored in Studio (Progression → Village unlocks)
 * and written to both the client and the server: the client paints locks and requirement
 * text from it, the server refuses a locked village's actions from it.
 *
 * Once a village has opened for a player it stays open (the server keeps the list), so
 * retuning the table later never takes a village away from someone who already uses it.
 */

/** The hub's villages, in the order a new player is expected to meet them. */
export const HUB_FEATURE_IDS = ['missions', 'plants', 'insects', 'garden', 'battle', 'team'] as const;

export type HubFeatureId = (typeof HUB_FEATURE_IDS)[number];

export const HUB_FEATURE_LABELS: Record<HubFeatureId, string> = {
  missions: 'Missions',
  plants: 'Plants',
  insects: 'Insects',
  garden: 'Garden',
  battle: 'Battle',
  team: 'Team',
};

/** How the two requirements combine when a village asks for both. */
export type HubUnlockMatch = 'all' | 'any';

export interface HubFeatureUnlock {
  id: HubFeatureId;
  /** Account level the player must have reached. 1 (or less) asks for nothing. */
  minUserLevel: number;
  /** Mission the player must have cleared (any difficulty). Empty asks for nothing. */
  missionId: string;
  /** With both requirements set: `all` needs both, `any` opens on whichever comes first. */
  match: HubUnlockMatch;
}

export interface HubUnlockTable {
  features: HubFeatureUnlock[];
}

/** What a player has done, as far as village unlocks care. */
export interface HubUnlockProgress {
  userLevel: number;
  clearedMissionIds: readonly string[];
}

/**
 * The shipped order: Missions is open from the first minute; each next village opens off the
 * chapter 1 mission that first gives the player something to do there.
 */
export const DEFAULT_HUB_UNLOCK_TABLE: HubUnlockTable = {
  features: [
    { id: 'missions', minUserLevel: 1, missionId: '', match: 'all' },
    { id: 'plants', minUserLevel: 1, missionId: 'chapter_1_01', match: 'all' },
    { id: 'insects', minUserLevel: 1, missionId: 'chapter_1_i01', match: 'all' },
    { id: 'garden', minUserLevel: 1, missionId: 'chapter_1_03', match: 'all' },
    { id: 'battle', minUserLevel: 4, missionId: 'chapter_1_05', match: 'any' },
    { id: 'team', minUserLevel: 6, missionId: 'chapter_1_10', match: 'any' },
  ],
};

export function isHubFeatureId(value: unknown): value is HubFeatureId {
  return typeof value === 'string' && (HUB_FEATURE_IDS as readonly string[]).includes(value);
}

/** Every village exactly once, in {@link HUB_FEATURE_IDS} order; gaps take the shipped default. */
export function normalizeHubUnlockTable(raw: unknown): HubUnlockTable {
  const rows = Array.isArray((raw as HubUnlockTable | undefined)?.features)
    ? (raw as HubUnlockTable).features
    : [];
  return {
    features: HUB_FEATURE_IDS.map((id) => {
      const fallback = DEFAULT_HUB_UNLOCK_TABLE.features.find((f) => f.id === id)!;
      const row = rows.find((r) => r && r.id === id);
      if (!row) return { ...fallback };
      const level = Math.floor(Number(row.minUserLevel));
      return {
        id,
        minUserLevel: Number.isFinite(level) ? Math.max(1, level) : 1,
        missionId: typeof row.missionId === 'string' ? row.missionId.trim() : '',
        match: row.match === 'any' ? 'any' : 'all',
      };
    }),
  };
}

export function hubFeatureUnlock(table: HubUnlockTable, id: HubFeatureId): HubFeatureUnlock {
  return (
    table.features.find((f) => f.id === id) ??
    DEFAULT_HUB_UNLOCK_TABLE.features.find((f) => f.id === id)!
  );
}

/** True when the village asks for nothing: open on a brand-new account. */
export function hubFeatureOpenFromStart(rule: HubFeatureUnlock): boolean {
  return rule.minUserLevel <= 1 && !rule.missionId;
}

export function isHubFeatureRequirementMet(
  rule: HubFeatureUnlock,
  progress: HubUnlockProgress,
): boolean {
  const needsLevel = rule.minUserLevel > 1;
  const needsMission = !!rule.missionId;
  if (!needsLevel && !needsMission) return true;
  const levelMet = needsLevel && progress.userLevel >= rule.minUserLevel;
  const missionMet = needsMission && progress.clearedMissionIds.includes(rule.missionId);
  if (needsLevel && needsMission) return rule.match === 'any' ? levelMet || missionMet : levelMet && missionMet;
  return needsLevel ? levelMet : missionMet;
}

/**
 * The villages open for a player: everything already opened (`already`) plus whatever the
 * player's progress opens now. Returned in {@link HUB_FEATURE_IDS} order.
 */
export function resolveHubUnlocks(
  table: HubUnlockTable,
  progress: HubUnlockProgress,
  already: readonly string[] = [],
): HubFeatureId[] {
  return HUB_FEATURE_IDS.filter(
    (id) => already.includes(id) || isHubFeatureRequirementMet(hubFeatureUnlock(table, id), progress),
  );
}

/**
 * Requirement as the player reads it on a locked village, e.g. "Reach level 4 or clear
 * Sprout Lane". `missionLabel` turns a mission id into its display name.
 */
export function describeHubUnlockRequirement(
  rule: HubFeatureUnlock,
  missionLabel: (missionId: string) => string = (id) => id,
): string {
  const parts: string[] = [];
  if (rule.minUserLevel > 1) parts.push(`reach level ${rule.minUserLevel}`);
  if (rule.missionId) parts.push(`clear ${missionLabel(rule.missionId)}`);
  if (parts.length === 0) return '';
  const text = parts.join(rule.match === 'any' ? ' or ' : ' and ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
