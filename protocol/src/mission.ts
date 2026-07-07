import type { EntityId } from './index';

export interface MissionReward {
  photosynthesis?: number;
  seeds?: number;
  nectar?: number;
  chitin?: number;
  unlockPlantId?: EntityId;
  unlockInsectId?: EntityId;
}

export interface MissionObjective {
  type: 'survive' | 'clear_lanes' | 'protect_core' | 'time_limit';
  value?: number;
  description: string;
}

/** Editor / game-data source */
export interface MissionDefinition {
  id: string;
  chapterId: string;
  order: number;
  displayName: string;
  description: string;
  mapTemplateId: string;
  /** Pre-placed plants for story — references plant ids */
  presetDefense?: Array<{
    plantId: EntityId;
    lane: number;
    column: number;
    level?: number;
  }>;
  /** Scripted insect waves for PvE */
  waves?: Array<{
    delayMs: number;
    spawns: Array<{ insectId: EntityId; lane: number; level?: number }>;
  }>;
  starCriteria: {
    oneStar: MissionObjective;
    twoStar: MissionObjective;
    threeStar: MissionObjective;
  };
  rewards: {
    firstClear: MissionReward;
    perStar?: Record<1 | 2 | 3, MissionReward>;
  };
}

/** Server — rewards, unlocks, progression gates only */
export interface ServerMissionExport {
  id: string;
  chapterId: string;
  order: number;
  mapTemplateId: string;
  presetDefense?: MissionDefinition['presetDefense'];
  waves?: MissionDefinition['waves'];
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
  mapTemplateId: string;
  presetDefense?: MissionDefinition['presetDefense'];
  waves?: MissionDefinition['waves'];
  starCriteria: MissionDefinition['starCriteria'];
}
