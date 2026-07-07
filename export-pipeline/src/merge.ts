import type {
  ClientInsectExport,
  ClientMapExport,
  ClientMissionExport,
  ClientPlantExport,
  InsectDefinition,
  InsectServerConfig,
  MapTemplateDefinition,
  MissionDefinition,
  PlantDefinition,
  PlantServerConfig,
  ServerInsectExport,
  ServerMapExport,
  ServerMissionExport,
  ServerPlantExport,
} from '@garden-siege/protocol';
import type { GameDataBundle } from './index';

const DEFAULT_PLANT_SERVER: PlantServerConfig = {
  unlockSource: 'default',
  targetingPriority: 'closest',
  validTerrain: ['ground'],
};

const DEFAULT_INSECT_SERVER: InsectServerConfig = {
  unlockSource: 'default',
  laneBehavior: 'ground',
};

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.filter((item) => item.id).map((item) => [item.id, item]));
}

export function mergePlant(client: ClientPlantExport, server?: ServerPlantExport): PlantDefinition {
  return {
    id: client.id,
    displayName: client.displayName,
    description: client.description,
    role: server?.role ?? client.role,
    rarity: server?.rarity ?? client.rarity,
    stats: server?.stats ?? client.stats,
    client: client.client,
    server: server?.server ?? DEFAULT_PLANT_SERVER,
  };
}

export function mergeInsect(client: ClientInsectExport, server?: ServerInsectExport): InsectDefinition {
  return {
    id: client.id,
    displayName: client.displayName,
    description: client.description,
    archetype: server?.archetype ?? client.archetype,
    rarity: server?.rarity ?? client.rarity,
    stats: server?.stats ?? client.stats,
    client: client.client,
    server: server?.server ?? DEFAULT_INSECT_SERVER,
  };
}

export function mergeMission(client: ClientMissionExport, server?: ServerMissionExport): MissionDefinition {
  return {
    id: client.id,
    chapterId: client.chapterId,
    order: client.order,
    displayName: client.displayName,
    description: client.description,
    mapTemplateId: server?.mapTemplateId ?? client.mapTemplateId,
    presetDefense: server?.presetDefense ?? client.presetDefense,
    waves: server?.waves ?? client.waves,
    startingSun: client.startingSun,
    availablePlants: client.availablePlants,
    starCriteria: server?.starCriteria ?? client.starCriteria,
    rewards: server?.rewards ?? { firstClear: {} },
  };
}

export function mergeMap(client: ClientMapExport, server?: ServerMapExport): MapTemplateDefinition {
  return {
    id: client.id,
    displayName: client.displayName,
    tier: server?.tier ?? client.tier,
    laneCount: server?.laneCount ?? client.laneCount,
    lanes: server?.lanes ?? client.lanes,
    client: client.client,
    server: server?.server ?? {
      corePosition: client.corePosition ?? { lane: 0, column: 0 },
      maxVillageLevel: 6,
      minVillageLevel: 1,
    },
  };
}

export function mergeGameDataBundle(parts: {
  clientPlants: ClientPlantExport[];
  serverPlants: ServerPlantExport[];
  clientInsects: ClientInsectExport[];
  serverInsects: ServerInsectExport[];
  clientMissions: ClientMissionExport[];
  serverMissions: ServerMissionExport[];
  clientMaps: ClientMapExport[];
  serverMaps: ServerMapExport[];
}): GameDataBundle {
  const serverPlants = indexById(parts.serverPlants);
  const serverInsects = indexById(parts.serverInsects);
  const serverMissions = indexById(parts.serverMissions);
  const serverMaps = indexById(parts.serverMaps);

  const clientPlantIds = new Set(parts.clientPlants.map((p) => p.id));
  const clientInsectIds = new Set(parts.clientInsects.map((p) => p.id));
  const clientMissionIds = new Set(parts.clientMissions.map((p) => p.id));
  const clientMapIds = new Set(parts.clientMaps.map((p) => p.id));

  const plants = [
    ...parts.clientPlants.map((client) => mergePlant(client, serverPlants.get(client.id))),
    ...parts.serverPlants
      .filter((server) => !clientPlantIds.has(server.id))
      .map((server) =>
        mergePlant(
          {
            id: server.id,
            displayName: server.id,
            role: server.role,
            rarity: server.rarity,
            description: '',
            client: {
              spriteSheet: `game/plants/${server.id}/sheet.gif`,
              icon: `game/plants/${server.id}/icon.png`,
              animationPrefix: server.id,
            },
            stats: server.stats,
          },
          server,
        ),
      ),
  ];

  const insects = [
    ...parts.clientInsects.map((client) => mergeInsect(client, serverInsects.get(client.id))),
    ...parts.serverInsects
      .filter((server) => !clientInsectIds.has(server.id))
      .map((server) =>
        mergeInsect(
          {
            id: server.id,
            displayName: server.id,
            archetype: server.archetype,
            rarity: server.rarity,
            description: '',
            client: {
              spriteSheet: `game/insects/${server.id}/sheet.gif`,
              icon: `game/insects/${server.id}/icon.png`,
              animationPrefix: server.id,
              marchAnimation: 'walk',
            },
            stats: server.stats,
          },
          server,
        ),
      ),
  ];

  const missions = [
    ...parts.clientMissions.map((client) => mergeMission(client, serverMissions.get(client.id))),
    ...parts.serverMissions
      .filter((server) => !clientMissionIds.has(server.id))
      .map((server) =>
        mergeMission(
          {
            id: server.id,
            chapterId: server.chapterId,
            order: server.order,
            displayName: server.id,
            description: '',
            mapTemplateId: server.mapTemplateId,
            starCriteria: server.starCriteria,
          },
          server,
        ),
      ),
  ];

  const maps = [
    ...parts.clientMaps.map((client) => mergeMap(client, serverMaps.get(client.id))),
    ...parts.serverMaps
      .filter((server) => !clientMapIds.has(server.id))
      .map((server) =>
        mergeMap(
          {
            id: server.id,
            displayName: server.id,
            tier: server.tier,
            laneCount: server.laneCount,
            lanes: server.lanes,
            corePosition: server.server.corePosition,
            client: {
              backgroundImage: `game/maps/${server.id}/bg.png`,
            },
          },
          server,
        ),
      ),
  ];

  return { plants, insects, missions, maps };
}
