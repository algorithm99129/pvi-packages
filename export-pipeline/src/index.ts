import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  BALANCE_VERSION,
  CLIENT_EXPORT_PATHS,
  SERVER_EXPORT_PATHS,
  type ClientInsectExport,
  type ClientMapExport,
  type ClientMissionExport,
  type ClientPlantExport,
  type EditorWorkspaceConfig,
  type InsectDefinition,
  type MapTemplateDefinition,
  type MissionDefinition,
  type PlantDefinition,
  type ServerInsectExport,
  type ServerMapExport,
  type ServerMissionExport,
  type ServerPlantExport,
} from '@garden-siege/protocol';

export interface GameDataBundle {
  plants: PlantDefinition[];
  insects: InsectDefinition[];
  missions: MissionDefinition[];
  maps: MapTemplateDefinition[];
}

export * from './merge';

export function toServerPlant(plant: PlantDefinition): ServerPlantExport {
  return {
    id: plant.id,
    role: plant.role,
    rarity: plant.rarity,
    stats: plant.stats,
    server: plant.server,
  };
}

export function toClientPlant(plant: PlantDefinition): ClientPlantExport {
  return {
    id: plant.id,
    displayName: plant.displayName,
    role: plant.role,
    rarity: plant.rarity,
    description: plant.description,
    client: plant.client,
    stats: plant.stats,
  };
}

export function toServerInsect(insect: InsectDefinition): ServerInsectExport {
  return {
    id: insect.id,
    archetype: insect.archetype,
    rarity: insect.rarity,
    stats: insect.stats,
    server: insect.server,
  };
}

export function toClientInsect(insect: InsectDefinition): ClientInsectExport {
  return {
    id: insect.id,
    displayName: insect.displayName,
    archetype: insect.archetype,
    rarity: insect.rarity,
    description: insect.description,
    client: insect.client,
    stats: insect.stats,
  };
}

export function toServerMission(mission: MissionDefinition): ServerMissionExport {
  return {
    id: mission.id,
    chapterId: mission.chapterId,
    order: mission.order,
    mapTemplateId: mission.mapTemplateId,
    presetDefense: mission.presetDefense,
    waves: mission.waves,
    starCriteria: mission.starCriteria,
    rewards: mission.rewards,
  };
}

export function toClientMission(mission: MissionDefinition): ClientMissionExport {
  return {
    id: mission.id,
    chapterId: mission.chapterId,
    order: mission.order,
    displayName: mission.displayName,
    description: mission.description,
    mapTemplateId: mission.mapTemplateId,
    presetDefense: mission.presetDefense,
    waves: mission.waves,
    starCriteria: mission.starCriteria,
  };
}

export function toServerMap(map: MapTemplateDefinition): ServerMapExport {
  return {
    id: map.id,
    tier: map.tier,
    laneCount: map.laneCount,
    lanes: map.lanes,
    server: map.server,
  };
}

export function toClientMap(map: MapTemplateDefinition): ClientMapExport {
  return {
    id: map.id,
    displayName: map.displayName,
    tier: map.tier,
    laneCount: map.laneCount,
    lanes: map.lanes,
    corePosition: map.server.corePosition,
    client: map.client,
  };
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export interface ExportResult {
  clientFiles: string[];
  serverFiles: string[];
  balanceVersion: string;
}

/**
 * Export game data to configured client and server directories.
 * Client receives graphics paths + display data.
 * Server receives ids, stats, and rules only.
 */
export async function exportGameData(
  workspace: EditorWorkspaceConfig,
  bundle: GameDataBundle,
): Promise<ExportResult> {
  const clientRoot = workspace.clientDirectory;
  const serverRoot = workspace.serverDirectory;

  const clientPlants = bundle.plants.map(toClientPlant);
  const serverPlants = bundle.plants.map(toServerPlant);
  const clientInsects = bundle.insects.map(toClientInsect);
  const serverInsects = bundle.insects.map(toServerInsect);
  const clientMissions = bundle.missions.map(toClientMission);
  const serverMissions = bundle.missions.map(toServerMission);
  const clientMaps = bundle.maps.map(toClientMap);
  const serverMaps = bundle.maps.map(toServerMap);

  const balancePayload = { version: BALANCE_VERSION, exportedAt: new Date().toISOString() };

  const clientFiles = [
    join(clientRoot, CLIENT_EXPORT_PATHS.plants),
    join(clientRoot, CLIENT_EXPORT_PATHS.insects),
    join(clientRoot, CLIENT_EXPORT_PATHS.missions),
    join(clientRoot, CLIENT_EXPORT_PATHS.maps),
    join(clientRoot, CLIENT_EXPORT_PATHS.balanceVersion),
  ];

  const serverFiles = [
    join(serverRoot, SERVER_EXPORT_PATHS.plants),
    join(serverRoot, SERVER_EXPORT_PATHS.insects),
    join(serverRoot, SERVER_EXPORT_PATHS.missions),
    join(serverRoot, SERVER_EXPORT_PATHS.maps),
    join(serverRoot, SERVER_EXPORT_PATHS.balanceVersion),
  ];

  await writeJson(clientFiles[0], clientPlants);
  await writeJson(clientFiles[1], clientInsects);
  await writeJson(clientFiles[2], clientMissions);
  await writeJson(clientFiles[3], clientMaps);
  await writeJson(clientFiles[4], balancePayload);

  await writeJson(serverFiles[0], serverPlants);
  await writeJson(serverFiles[1], serverInsects);
  await writeJson(serverFiles[2], serverMissions);
  await writeJson(serverFiles[3], serverMaps);
  await writeJson(serverFiles[4], balancePayload);

  return { clientFiles, serverFiles, balanceVersion: BALANCE_VERSION };
}
