import type { EntityId } from './index';

/** Wallet / unlock grant for hub daily, streak, quest, and achievement rewards. */
export interface HubRewardGrant {
  coin?: number;
  gem?: number;
  leaf?: number;
  unlockPlantId?: EntityId;
  unlockInsectId?: EntityId;
}

export interface DailyLoginDay {
  /** 1–7 */
  day: number;
  grant: HubRewardGrant;
  /** Optional label shown under the day card (e.g. "Chest"). */
  displayHint?: string;
  /**
   * Client Resources sprite path (no extension), e.g. `Rewards/daily_day_1`.
   * PNG lives under `Assets/Resources/Rewards/`; plan JSON is server-only.
   */
  image?: string;
}

export interface StreakBonusTier {
  id: string;
  /** Consecutive login days required. */
  streakDays: number;
  grant: HubRewardGrant;
  displayName?: string;
  /** Client Resources sprite path (no extension), e.g. `Rewards/streak_3`. */
  image?: string;
}

export type DailyQuestObjectiveType =
  | 'mission_wins'
  | 'collect_sun'
  | 'defeat_insects'
  | 'upgrade_plant'
  | 'upgrade_insect';

export type RewardGoScene = 'missions' | 'plants' | 'insects' | 'garden' | 'hub';

export interface DailyQuestObjective {
  type: DailyQuestObjectiveType;
  target: number;
}

export interface DailyQuestDef {
  id: string;
  displayName: string;
  description?: string;
  objective: DailyQuestObjective;
  grant: HubRewardGrant;
  goScene?: RewardGoScene;
}

export type AchievementConditionType = 'user_level' | 'village_level' | 'mission_wins';

export interface AchievementCondition {
  type: AchievementConditionType;
  value: number;
}

export interface AchievementDef {
  id: string;
  displayName: string;
  description?: string;
  condition: AchievementCondition;
  grant: HubRewardGrant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievement ladders
//
// Achievements are tracks, one per condition type, and the player sees one goal per track:
// the lowest tier not yet claimed. Claiming it moves the track to the next tier (win 10
// missions → win 20 → win 30 …). The authored list seeds each track; past its last entry the
// tiers continue by rule, so a long-term player never runs out of goals. Levels have caps
// (account 50, village 10) and stop there.
// ─────────────────────────────────────────────────────────────────────────────

const ACHIEVEMENT_TIER_STEP: Record<AchievementConditionType, number> = {
  user_level: 5,
  village_level: 2,
  mission_wins: 10,
};

const ACHIEVEMENT_TIER_CAP: Record<AchievementConditionType, number> = {
  user_level: 50,
  village_level: 10,
  mission_wins: Number.POSITIVE_INFINITY,
};

const ACHIEVEMENT_TIER_LABEL: Record<AchievementConditionType, (value: number) => string> = {
  user_level: (v) => `Reach player level ${v}`,
  village_level: (v) => `Village level ${v}`,
  mission_wins: (v) => `Win ${v} missions`,
};

/** The tier after `last` on a track, or null at the track's cap. */
export function nextAchievementTier(last: AchievementDef): AchievementDef | null {
  const type = last.condition.type;
  const step = ACHIEVEMENT_TIER_STEP[type];
  const cap = ACHIEVEMENT_TIER_CAP[type];
  if (last.condition.value >= cap) return null;
  // The last tier lands exactly on the cap (village 3 → 5 → 7 → 9 → 10).
  const value = Math.min(cap, last.condition.value + step);
  // Rewards grow with the tier: the reward per step of the seed, times the tiers climbed.
  const tiers = value / step;
  const perTier = last.condition.value > 0 ? last.condition.value / step : 1;
  const scale = Math.max(1, tiers / Math.max(1, perTier));
  const grow = (n?: number) => (n ? Math.round(n * scale) : undefined);
  return {
    id: `ach_${type}_${value}`,
    displayName: ACHIEVEMENT_TIER_LABEL[type](value),
    condition: { type, value },
    grant: {
      ...last.grant,
      coin: grow(last.grant.coin),
      gem: grow(last.grant.gem),
      leaf: grow(last.grant.leaf),
    },
  };
}

/**
 * The goal each track shows: the lowest authored tier not yet claimed, or — once every
 * authored tier on the track is claimed — the next generated tier. One entry per track, in
 * the order the tracks first appear in the plan.
 */
export function currentAchievementGoals(
  authored: AchievementDef[],
  claimedIds: ReadonlyArray<string>,
): AchievementDef[] {
  const claimed = new Set(claimedIds);
  const byType = new Map<AchievementConditionType, AchievementDef[]>();
  for (const a of authored) {
    const list = byType.get(a.condition.type) ?? [];
    list.push(a);
    byType.set(a.condition.type, list);
  }
  const goals: AchievementDef[] = [];
  for (const [, list] of byType) {
    list.sort((a, b) => a.condition.value - b.condition.value);
    const open = list.find((a) => !claimed.has(a.id));
    if (open) {
      goals.push(open);
      continue;
    }
    let tier: AchievementDef | null = list[list.length - 1];
    for (let guard = 0; guard < 10_000 && tier; guard++) {
      tier = nextAchievementTier(tier);
      if (tier && !claimed.has(tier.id)) break;
    }
    if (tier) goals.push(tier);
  }
  return goals;
}

/** Authorable hub rewards plan (editor → API Resources/Rewards/rewards.json only).
 * Item art PNGs are stored on the Unity client under Assets/Resources/Rewards/.
 */
export interface HubRewardPlan {
  schemaVersion: number;
  dailyLogin: DailyLoginDay[];
  streakBonuses: StreakBonusTier[];
  dailyQuests: DailyQuestDef[];
  dailyQuestsAllClearGrant: HubRewardGrant;
  achievements: AchievementDef[];
}

export type RewardClaimStatus = 'locked' | 'claimable' | 'claimed' | 'in_progress';

export interface PlayerDailyLoginDayView {
  day: number;
  grant: HubRewardGrant;
  displayHint?: string;
  /** Client Resources sprite path (no extension). */
  image?: string;
  /** claimed | today (pending/claimed today) | locked */
  state: 'claimed' | 'today' | 'locked';
}

export interface PlayerStreakBonusView {
  id: string;
  streakDays: number;
  displayName?: string;
  grant: HubRewardGrant;
  /** Client Resources sprite path (no extension). */
  image?: string;
  status: RewardClaimStatus;
}

export interface PlayerDailyQuestView {
  id: string;
  displayName: string;
  description?: string;
  progress: number;
  target: number;
  grant: HubRewardGrant;
  goScene?: RewardGoScene;
  status: RewardClaimStatus;
}

export interface PlayerAchievementView {
  id: string;
  displayName: string;
  description?: string;
  progress: number;
  target: number;
  grant: HubRewardGrant;
  status: RewardClaimStatus;
}

/** GET /api/player/rewards */
export interface PlayerRewardsState {
  loginStreak: number;
  /** UTC YYYY-MM-DD of last daily login claim, if any. */
  lastDailyClaimDate?: string | null;
  alreadyClaimedToday: boolean;
  canClaimDaily: boolean;
  /** Pending day index 1–7+ (grant uses min(day, 7)). */
  pendingDailyDay: number;
  dailyLogin: PlayerDailyLoginDayView[];
  streakBonuses: PlayerStreakBonusView[];
  dailyQuests: PlayerDailyQuestView[];
  dailyQuestsClaimedCount: number;
  dailyQuestsTotal: number;
  dailyQuestsAllClearStatus: RewardClaimStatus;
  dailyQuestsAllClearGrant: HubRewardGrant;
  /** Seconds until next UTC midnight. */
  dailyQuestsResetsInSeconds: number;
  achievements: PlayerAchievementView[];
  claimableDailyQuestCount: number;
  claimableAchievementCount: number;
}

export interface RewardClaimResult {
  rewards: PlayerRewardsState;
  wallet: { coin: number; gem: number; leaf: number };
  unlockPlantId?: EntityId;
  unlockInsectId?: EntityId;
}

export function hubRewardGrantToWalletDelta(grant: HubRewardGrant | null | undefined): {
  coin: number;
  gem: number;
  leaf: number;
} {
  if (!grant) return { coin: 0, gem: 0, leaf: 0 };
  return {
    coin: Math.max(0, Math.floor(grant.coin ?? 0)),
    gem: Math.max(0, Math.floor(grant.gem ?? 0)),
    leaf: Math.max(0, Math.floor(grant.leaf ?? 0)),
  };
}

/** Default authorable plan matching progression v0.2 (slower F2P gems). */
export function createDefaultHubRewardPlan(): HubRewardPlan {
  return {
    schemaVersion: 1,
    dailyLogin: [
      { day: 1, grant: { coin: 80 }, image: 'Rewards/daily_day_1' },
      { day: 2, grant: { gem: 2 }, image: 'Rewards/daily_day_2' },
      { day: 3, grant: { coin: 100 }, image: 'Rewards/daily_day_3' },
      { day: 4, grant: { gem: 3, leaf: 1 }, displayHint: 'Pack', image: 'Rewards/daily_day_4' },
      { day: 5, grant: { gem: 2 }, image: 'Rewards/daily_day_5' },
      { day: 6, grant: { coin: 120 }, image: 'Rewards/daily_day_6' },
      { day: 7, grant: { gem: 5, coin: 50 }, displayHint: 'Chest', image: 'Rewards/daily_day_7' },
    ],
    streakBonuses: [
      { id: 'streak_3', streakDays: 3, displayName: '3 Days', grant: { leaf: 3 }, image: 'Rewards/streak_3' },
      { id: 'streak_7', streakDays: 7, displayName: '7 Days', grant: { gem: 5 }, image: 'Rewards/streak_7' },
      { id: 'streak_14', streakDays: 14, displayName: '14 Days', grant: { gem: 8, coin: 100 }, image: 'Rewards/streak_14' },
      { id: 'streak_30', streakDays: 30, displayName: '30 Days', grant: { gem: 15, coin: 200 }, image: 'Rewards/streak_30' },
    ],
    dailyQuests: [
      {
        id: 'dq_win_3',
        displayName: 'Win 3 levels',
        description: 'Complete any 3 missions today.',
        objective: { type: 'mission_wins', target: 3 },
        grant: { coin: 105, gem: 1 },
        goScene: 'missions',
      },
      {
        id: 'dq_clear_1',
        displayName: 'Clear 1 mission',
        description: 'Complete any mission today.',
        objective: { type: 'mission_wins', target: 1 },
        grant: { gem: 2, coin: 40 },
        goScene: 'missions',
      },
      {
        id: 'dq_defeat_5',
        displayName: 'Defeat 5 insects',
        description: 'Knock out insects in missions or raids.',
        objective: { type: 'defeat_insects', target: 5 },
        grant: { gem: 2, coin: 50 },
        goScene: 'missions',
      },
      {
        id: 'dq_defeat_insects',
        displayName: 'Defeat 15 insects',
        description: 'Knock out insects in raids.',
        objective: { type: 'defeat_insects', target: 15 },
        grant: { coin: 140, gem: 1 },
        goScene: 'missions',
      },
    ],
    dailyQuestsAllClearGrant: { gem: 2, coin: 60 },
    achievements: [
      {
        id: 'ach_level_5',
        displayName: 'Reach player level 5',
        condition: { type: 'user_level', value: 5 },
        grant: { coin: 300, gem: 2 },
      },
      {
        id: 'ach_level_10',
        displayName: 'Reach player level 10',
        condition: { type: 'user_level', value: 10 },
        grant: { coin: 500, gem: 5 },
      },
      {
        id: 'ach_village_3',
        displayName: 'Village level 3',
        condition: { type: 'village_level', value: 3 },
        grant: { leaf: 10, gem: 2 },
      },
      {
        id: 'ach_wins_10',
        displayName: 'Win 10 missions',
        condition: { type: 'mission_wins', value: 10 },
        grant: { coin: 400, gem: 4 },
      },
    ],
  };
}

export function normalizeHubRewardPlan(plan: HubRewardPlan | null | undefined): HubRewardPlan {
  const fallback = createDefaultHubRewardPlan();
  if (!plan) return fallback;

  const dailyLogin = Array.isArray(plan.dailyLogin) ? [...plan.dailyLogin] : [];
  while (dailyLogin.length < 7) {
    const day = dailyLogin.length + 1;
    dailyLogin.push(fallback.dailyLogin[day - 1] ?? { day, grant: { coin: 50 } });
  }
  const trimmedLogin = dailyLogin.slice(0, 7).map((d, i) => ({
    day: i + 1,
    grant: d.grant ?? {},
    displayHint: d.displayHint,
    image: normalizeRewardImagePath(d.image) || fallback.dailyLogin[i]?.image,
  }));

  return {
    schemaVersion: plan.schemaVersion ?? 1,
    dailyLogin: trimmedLogin,
    streakBonuses: (Array.isArray(plan.streakBonuses) ? plan.streakBonuses : fallback.streakBonuses).map(
      (tier, i) => ({
        ...tier,
        image: normalizeRewardImagePath(tier.image) || fallback.streakBonuses[i]?.image,
      }),
    ),
    dailyQuests: Array.isArray(plan.dailyQuests) ? plan.dailyQuests : fallback.dailyQuests,
    dailyQuestsAllClearGrant: plan.dailyQuestsAllClearGrant ?? fallback.dailyQuestsAllClearGrant,
    achievements: Array.isArray(plan.achievements) ? plan.achievements : fallback.achievements,
  };
}

/** Resources path without extension; lifts legacy `custom/Rewards/...` mis-routes. */
function normalizeRewardImagePath(image: string | undefined): string | undefined {
  const trimmed = image?.trim();
  if (!trimmed) return undefined;
  const withoutExt = trimmed.replace(/\.[^./]+$/, '');
  if (withoutExt.startsWith('custom/Rewards/')) return withoutExt.slice('custom/'.length);
  if (withoutExt.startsWith('Rewards/')) return withoutExt;
  return withoutExt;
}
