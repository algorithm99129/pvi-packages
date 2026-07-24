import type { EntityId } from './index';

export interface MissionReward {
  photosynthesis?: number;
  seeds?: number;
  nectar?: number;
  chitin?: number;
  unlockPlantId?: EntityId;
  unlockInsectId?: EntityId;
}

/** Map authored mission reward currencies onto the live wallet (coin/gem/leaf). */
export function missionRewardToWalletDelta(reward: MissionReward | null | undefined): {
  coin: number;
  gem: number;
  leaf: number;
} {
  if (!reward) return { coin: 0, gem: 0, leaf: 0 };
  return {
    coin: Math.max(0, Math.floor(reward.photosynthesis ?? 0)),
    gem: Math.max(0, Math.floor(reward.seeds ?? 0)),
    leaf: Math.max(0, Math.floor(reward.nectar ?? 0) + Math.floor(reward.chitin ?? 0)),
  };
}

/** Difficulty multiplier applied to coin grants on mission complete. */
export function missionDifficultyCoinMultiplier(difficulty: string | undefined): number {
  switch (difficulty) {
    case 'medium':
      return 1.25;
    case 'hard':
      return 1.5;
    default:
      return 1;
  }
}

/** Client Missions UI coin labels derived from first-clear photosynthesis (→ coin). */
export function missionClientRewardPreviews(reward: MissionReward | null | undefined): {
  rewardEasy: number;
  rewardMedium: number;
  rewardHard: number;
} {
  const baseCoin = missionRewardToWalletDelta(reward).coin;
  return {
    rewardEasy: Math.round(baseCoin * missionDifficultyCoinMultiplier('easy')),
    rewardMedium: Math.round(baseCoin * missionDifficultyCoinMultiplier('medium')),
    rewardHard: Math.round(baseCoin * missionDifficultyCoinMultiplier('hard')),
  };
}

export interface MissionObjective {
  type: 'survive' | 'clear_lanes' | 'protect_core' | 'time_limit' | 'no_lawn_mowers_lost' | 'max_plants';
  value?: number;
  description: string;
}

export type MissionMode =
  | 'adventure'
  | 'conveyor'
  | 'last_stand'
  | 'vasebreaker'
  | 'i_zombie';

/** Which side the player controls in this mission. */
export type MissionSide = 'defender' | 'attacker';

export interface MissionRules {
  /** Gameplay variant within the mission side (conveyor, last stand, …). */
  mode?: MissionMode;
  /** Lawn mowers on each lane (classic PVZ). Default true for defender. */
  mowersEnabled?: boolean;
  /** Player can place plants during battle. Default true for defender. */
  plantingEnabled?: boolean;
  /** Show the top seed packet bar. Default true for defender. */
  showSeedChooser?: boolean;
  /** For conveyor mode — plants delivered in this order (future runtime). */
  conveyorPlantIds?: EntityId[];
  /** Grid column bands on the linked map — required for authored missions. */
  battlefield?: MissionBattlefieldZones;
  /**
   * Classic fog siege: translucent fog covers the right side of the lawn
   * (same map art — typically night). Plantern clears a radius at runtime.
   */
  fogEnabled?: boolean;
  /**
   * First column index covered by fog (inclusive). Omitted → ~mid lawn
   * (column 5 on a 9-col grid, classic right-side fog).
   */
  fogStartColumn?: number;
}

/** Inclusive column indices on the shared lane grid (0 = seed / left side). */
export interface GridColumnRange {
  minColumn: number;
  maxColumn: number;
}

/**
 * Per-mission column layout on the map grid.
 * Defender plants and attacker insects each use their own column band.
 */
export interface MissionBattlefieldZones {
  /** Columns where the defender may place plants. */
  plantColumns: GridColumnRange;
  /** Columns where insects can spawn / appear. */
  insectColumns: GridColumnRange;
}

/** @deprecated Renamed to `plantColumns` / `insectColumns` */
export interface LegacyMissionBattlefieldZones {
  defense?: GridColumnRange;
  attack?: GridColumnRange;
}

export function defaultBattlefieldForGrid(gridColumns: number): MissionBattlefieldZones {
  const last = Math.max(0, gridColumns - 1);
  return {
    plantColumns: { minColumn: 0, maxColumn: last },
    insectColumns: { minColumn: last, maxColumn: last },
  };
}

export function resolveMissionBattlefield(
  zones: MissionBattlefieldZones | LegacyMissionBattlefieldZones | undefined,
  gridColumns: number,
): MissionBattlefieldZones {
  const defaults = defaultBattlefieldForGrid(gridColumns);
  if (!zones) return defaults;

  const legacy = zones as LegacyMissionBattlefieldZones;
  if (legacy.defense || legacy.attack) {
    return {
      plantColumns: legacy.defense ?? defaults.plantColumns,
      insectColumns: legacy.attack ?? defaults.insectColumns,
    };
  }

  const current = zones as MissionBattlefieldZones;
  return {
    plantColumns: current.plantColumns ?? defaults.plantColumns,
    insectColumns: current.insectColumns ?? defaults.insectColumns,
  };
}

export function resolveMissionSide(side?: MissionSide): MissionSide {
  return side === 'attacker' ? 'attacker' : 'defender';
}

export function defaultRulesForSide(side: MissionSide, mode: MissionMode = 'adventure'): MissionRules {
  const battlefield = defaultBattlefieldForGrid(9);
  if (side === 'attacker') {
    return {
      mode: mode === 'adventure' ? 'i_zombie' : mode,
      mowersEnabled: false,
      plantingEnabled: false,
      showSeedChooser: false,
      battlefield,
    };
  }
  if (mode === 'last_stand') {
    return { mode, mowersEnabled: false, plantingEnabled: false, showSeedChooser: false, battlefield };
  }
  if (mode === 'conveyor') {
    return { mode, mowersEnabled: true, plantingEnabled: true, showSeedChooser: false, battlefield };
  }
  return { mode, mowersEnabled: true, plantingEnabled: true, showSeedChooser: true, battlefield };
}

export interface MissionDefenseSlot {
  plantId: EntityId;
  lane: number;
  column: number;
  level?: number;
}

export interface MissionSpawn {
  insectId: EntityId;
  lane: number;
  level?: number;
  /** Spawn this many of the same insect in the wave (default 1). */
  count?: number;
  /** Delay between each insect when count > 1. */
  staggerMs?: number;
}

export interface MissionWave {
  /** Milliseconds from battle start when this wave fires. */
  delayMs: number;
  spawns: MissionSpawn[];
  /** Optional label shown in editor / UI (e.g. "Huge wave!"). */
  label?: string;
  /** Classic PVZ huge-wave flag for UI warning. */
  isHuge?: boolean;
}

/** Editor / game-data source */
export interface MissionDefinition {
  id: string;
  chapterId: string;
  order: number;
  displayName: string;
  description: string;
  /** JSON schema generation; missing = legacy (0). */
  schemaVersion?: number;
  /** Defender (plants) or attacker (insects) mission. */
  side: MissionSide;
  mapTemplateId: string;
  rules?: MissionRules;
  presetDefense?: MissionDefenseSlot[];
  waves?: MissionWave[];
  /** Starting sun for offline PVZ-style battles */
  startingSun?: number;
  /** Plant ids available in the seed chooser (slot order = array order) */
  availablePlants?: EntityId[];
  starCriteria: {
    oneStar: MissionObjective;
    twoStar: MissionObjective;
    threeStar: MissionObjective;
  };
  rewards: {
    firstClear: MissionReward;
    perStar?: Partial<Record<1 | 2 | 3, MissionReward>>;
  };
}

/** Server — rewards, unlocks, progression gates only */
export interface ServerMissionExport {
  id: string;
  chapterId: string;
  order: number;
  schemaVersion?: number;
  side: MissionSide;
  mapTemplateId: string;
  rules?: MissionRules;
  presetDefense?: MissionDefenseSlot[];
  waves?: MissionWave[];
  starCriteria: MissionDefinition['starCriteria'];
  rewards: MissionDefinition['rewards'];
}

/** Client — display strings + map reference + offline battle scenario */
export interface ClientMissionExport {
  id: string;
  chapterId: string;
  order: number;
  displayName: string;
  description: string;
  schemaVersion?: number;
  side: MissionSide;
  mapTemplateId: string;
  rules?: MissionRules;
  presetDefense?: MissionDefenseSlot[];
  waves?: MissionWave[];
  startingSun?: number;
  availablePlants?: EntityId[];
  starCriteria: MissionDefinition['starCriteria'];
  /** UI-only coin previews for Easy / Medium / Hard (server pays real rewards). */
  rewardEasy?: number;
  rewardMedium?: number;
  rewardHard?: number;
}
