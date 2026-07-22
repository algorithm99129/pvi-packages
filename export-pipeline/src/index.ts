import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  BALANCE_VERSION,
  CLIENT_EXPORT_PATHS,
  SERVER_EXPORT_PATHS,
  type BulletDefinition,
  type ClientBulletExport,
  type ClientEquipmentExport,
  type ClientInsectExport,
  type ClientMapExport,
  type ClientMissionExport,
  type ClientPlantExport,
  type EditorWorkspaceConfig,
  type EquipmentDefinition,
  type InsectDefinition,
  type MapTemplateDefinition,
  type MissionDefinition,
  type PlantDefinition,
  type ServerBulletExport,
  type ServerEquipmentExport,
  type ServerInsectExport,
  type ServerMapExport,
  type ServerMissionExport,
  type ServerPlantExport,
} from '@garden-siege/protocol';

export interface GameDataBundle {
  plants: PlantDefinition[];
  insects: InsectDefinition[];
  bullets: BulletDefinition[];
  equipment: EquipmentDefinition[];
  missions: MissionDefinition[];
  maps: MapTemplateDefinition[];
}

export * from './merge';

export function toServerBullet(bullet: BulletDefinition): ServerBulletExport {
  return { ...bullet };
}

export function toClientBullet(bullet: BulletDefinition): ClientBulletExport {
  return { ...bullet };
}

export function toServerEquipment(equipment: EquipmentDefinition): ServerEquipmentExport {
  return { ...equipment };
}

export function toClientEquipment(equipment: EquipmentDefinition): ClientEquipmentExport {
  return { ...equipment };
}

export function toServerPlant(plant: PlantDefinition): ServerPlantExport {
  return {
    id: plant.id,
    displayName: plant.displayName,
    description: plant.description,
    role: plant.role,
    rarity: plant.rarity,
    schemaVersion: plant.schemaVersion,
    client: plant.client,
    behavior: plant.behavior,
    extraAttributes: plant.extraAttributes,
    stats: plant.stats,
    server: plant.server,
    upgrade: plant.upgrade ?? undefined,
  };
}

export function toClientPlant(plant: PlantDefinition): ClientPlantExport {
  return {
    id: plant.id,
    displayName: plant.displayName,
    role: plant.role,
    rarity: plant.rarity,
    description: plant.description,
    schemaVersion: plant.schemaVersion,
    client: plant.client,
    stats: plant.stats,
    behavior: plant.behavior,
    extraAttributes: plant.extraAttributes,
  };
}

export function toServerInsect(insect: InsectDefinition): ServerInsectExport {
  return {
    id: insect.id,
    displayName: insect.displayName,
    description: insect.description,
    archetype: insect.archetype,
    rarity: insect.rarity,
    schemaVersion: insect.schemaVersion,
    client: insect.client,
    stats: insect.stats,
    server: insect.server,
    upgrade: insect.upgrade,
    extraAttributes: insect.extraAttributes,
  };
}

export function toClientInsect(insect: InsectDefinition): ClientInsectExport {
  return {
    id: insect.id,
    displayName: insect.displayName,
    archetype: insect.archetype,
    rarity: insect.rarity,
    description: insect.description,
    schemaVersion: insect.schemaVersion,
    client: insect.client,
    stats: insect.stats,
    extraAttributes: insect.extraAttributes,
  };
}

export function toServerMission(mission: MissionDefinition): ServerMissionExport {
  return {
    id: mission.id,
    chapterId: mission.chapterId,
    order: mission.order,
    side: mission.side,
    mapTemplateId: mission.mapTemplateId,
    rules: mission.rules,
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
    schemaVersion: mission.schemaVersion,
    side: mission.side,
    mapTemplateId: mission.mapTemplateId,
    rules: mission.rules,
    presetDefense: mission.presetDefense,
    waves: mission.waves,
    startingSun: mission.startingSun,
    availablePlants: mission.availablePlants,
    starCriteria: mission.starCriteria,
  };
}

export function toServerMap(map: MapTemplateDefinition): ServerMapExport {
  return {
    id: map.id,
    tier: map.tier,
    laneCount: map.laneCount,
    gridColumns: map.gridColumns,
    lanes: map.lanes,
    server: map.server,
  };
}

export function toClientMap(map: MapTemplateDefinition): ClientMapExport {
  return {
    id: map.id,
    displayName: map.displayName,
    schemaVersion: map.schemaVersion,
    tier: map.tier,
    laneCount: map.laneCount,
    gridColumns: map.gridColumns,
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
  const clientBullets = (bundle.bullets ?? []).map(toClientBullet);
  const serverBullets = (bundle.bullets ?? []).map(toServerBullet);
  const clientEquipment = (bundle.equipment ?? []).map(toClientEquipment);
  const serverEquipment = (bundle.equipment ?? []).map(toServerEquipment);
  const clientMissions = bundle.missions.map(toClientMission);
  const serverMissions = bundle.missions.map(toServerMission);
  const clientMaps = bundle.maps.map(toClientMap);
  const serverMaps = bundle.maps.map(toServerMap);

  const balancePayload = { version: BALANCE_VERSION, exportedAt: new Date().toISOString() };

  const clientFiles = [
    join(clientRoot, CLIENT_EXPORT_PATHS.plants),
    join(clientRoot, CLIENT_EXPORT_PATHS.insects),
    join(clientRoot, CLIENT_EXPORT_PATHS.bullets),
    join(clientRoot, CLIENT_EXPORT_PATHS.equipment),
    join(clientRoot, CLIENT_EXPORT_PATHS.missions),
    join(clientRoot, CLIENT_EXPORT_PATHS.maps),
    join(clientRoot, CLIENT_EXPORT_PATHS.balanceVersion),
  ];

  const serverFiles = [
    join(serverRoot, SERVER_EXPORT_PATHS.plants),
    join(serverRoot, SERVER_EXPORT_PATHS.insects),
    join(serverRoot, SERVER_EXPORT_PATHS.bullets),
    join(serverRoot, SERVER_EXPORT_PATHS.equipment),
    join(serverRoot, SERVER_EXPORT_PATHS.missions),
    join(serverRoot, SERVER_EXPORT_PATHS.maps),
    join(serverRoot, SERVER_EXPORT_PATHS.balanceVersion),
  ];

  await writeJson(clientFiles[0], clientPlants);
  await writeJson(clientFiles[1], clientInsects);
  await writeJson(clientFiles[2], clientBullets);
  await writeJson(clientFiles[3], clientEquipment);
  await writeJson(clientFiles[4], clientMissions);
  await writeJson(clientFiles[5], clientMaps);
  await writeJson(clientFiles[6], balancePayload);

  await writeJson(serverFiles[0], serverPlants);
  await writeJson(serverFiles[1], serverInsects);
  await writeJson(serverFiles[2], serverBullets);
  await writeJson(serverFiles[3], serverEquipment);
  await writeJson(serverFiles[4], serverMissions);
  await writeJson(serverFiles[5], serverMaps);
  await writeJson(serverFiles[6], balancePayload);

  return { clientFiles, serverFiles, balanceVersion: BALANCE_VERSION };
}
