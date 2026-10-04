/**
 * Demo edition: what a demo build of the game offers.
 *
 * A demo build is the same client talking to the same server, with a slice of the content: a
 * handful of missions, low caps, a few battles a day — but every village opens during it, so
 * the player meets every feature "a little". Whether a build is a demo is chosen when it is
 * built (the build wizards' "Demo build" box); WHAT the demo holds is authored here, in Studio
 * (Demo), and written to both the client and the server.
 *
 * The client enforces the content limits (it simply does not offer the rest). The server only
 * needs the demo's village schedule: a demo client says so in the `x-game-edition` header and
 * the server opens villages by {@link DemoConfig.unlocks} instead of the full game's table.
 */

import {
  HUB_FEATURE_IDS,
  normalizeHubUnlockTable,
  type HubUnlockTable,
} from './hub-unlock';

/** Request header a demo client sends on every call. */
export const GAME_EDITION_HEADER = 'x-game-edition';
export const GAME_EDITION_DEMO = 'demo';

export interface DemoConfig {
  /** Missions playable in the demo, in play order. Everything else shows as "Full game". */
  missionIds: string[];
  /** Highest level a plant or insect can be upgraded to in the demo. */
  maxUnitLevel: number;
  /** Highest garden (village) level in the demo. */
  maxGardenLevel: number;
  /** Battles (garden raids and room matches together) a day. 0 = no limit. */
  battlesPerDay: number;
  /** Whether the demo sells garden maps (false: only maps already owned can be used). */
  mapShop: boolean;
  /** Whether a demo player can create a team (joining and browsing are always allowed). */
  teamCreate: boolean;
  /** Whether a demo player can enter team matches. */
  teamMatch: boolean;
  /** Text on the badge shown on every screen of a demo build. */
  badgeText: string;
  /** Where "Get the full game" leads. Empty: the prompt has no link. */
  fullGameUrl: string;
  /**
   * When each village opens in the demo. Same shape as the full game's table, but every
   * requirement must be reachable inside the demo — {@link normalizeDemoConfig} moves a
   * village that asks for a mission outside the demo onto the demo's last mission.
   */
  unlocks: HubUnlockTable;
}

/** First ten missions of chapter 1, with the villages spread across them. */
export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  missionIds: [
    'chapter_1_01',
    'chapter_1_i01',
    'chapter_1_02',
    'chapter_1_03',
    'chapter_1_i02',
    'chapter_1_04',
    'chapter_1_i03',
    'chapter_1_i04',
    'chapter_1_i05',
    'chapter_1_05',
  ],
  maxUnitLevel: 3,
  maxGardenLevel: 2,
  battlesPerDay: 3,
  mapShop: false,
  teamCreate: false,
  teamMatch: false,
  badgeText: 'DEMO',
  fullGameUrl: '',
  unlocks: {
    features: [
      { id: 'missions', minUserLevel: 1, missionId: '', match: 'all' },
      { id: 'plants', minUserLevel: 1, missionId: 'chapter_1_01', match: 'all' },
      { id: 'insects', minUserLevel: 1, missionId: 'chapter_1_i01', match: 'all' },
      { id: 'garden', minUserLevel: 1, missionId: 'chapter_1_03', match: 'all' },
      { id: 'battle', minUserLevel: 1, missionId: 'chapter_1_04', match: 'all' },
      { id: 'team', minUserLevel: 1, missionId: 'chapter_1_i04', match: 'all' },
    ],
  },
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * A complete, self-consistent demo config: defaults for anything missing, and a village
 * schedule that only asks for missions the demo contains (and never for an account level —
 * a demo is too short to level by).
 */
export function normalizeDemoConfig(raw: unknown): DemoConfig {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<DemoConfig>;
  const d = DEFAULT_DEMO_CONFIG;

  const missionIds = Array.isArray(src.missionIds)
    ? [...new Set(src.missionIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim()))]
    : [...d.missionIds];
  const lastMission = missionIds[missionIds.length - 1] ?? '';

  const table = normalizeHubUnlockTable(src.unlocks ?? d.unlocks);
  const unlocks: HubUnlockTable = {
    features: HUB_FEATURE_IDS.map((id) => {
      const rule = table.features.find((f) => f.id === id)!;
      const asked = rule.missionId;
      return {
        id,
        minUserLevel: 1,
        missionId: !asked || missionIds.includes(asked) ? asked : lastMission,
        match: 'all' as const,
      };
    }),
  };

  return {
    missionIds,
    maxUnitLevel: clampInt(src.maxUnitLevel, 1, 20, d.maxUnitLevel),
    maxGardenLevel: clampInt(src.maxGardenLevel, 1, 10, d.maxGardenLevel),
    battlesPerDay: clampInt(src.battlesPerDay, 0, 99, d.battlesPerDay),
    mapShop: typeof src.mapShop === 'boolean' ? src.mapShop : d.mapShop,
    teamCreate: typeof src.teamCreate === 'boolean' ? src.teamCreate : d.teamCreate,
    teamMatch: typeof src.teamMatch === 'boolean' ? src.teamMatch : d.teamMatch,
    badgeText: typeof src.badgeText === 'string' && src.badgeText.trim() ? src.badgeText.trim().slice(0, 16) : d.badgeText,
    fullGameUrl: typeof src.fullGameUrl === 'string' ? src.fullGameUrl.trim() : d.fullGameUrl,
    unlocks,
  };
}

/** True when a request's `x-game-edition` header marks a demo client. */
export function isDemoEdition(headerValue: unknown): boolean {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return typeof value === 'string' && value.trim().toLowerCase() === GAME_EDITION_DEMO;
}
