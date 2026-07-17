import type {
  BulletDefinition,
  ClientBulletExport,
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
  ServerBulletExport,
  ServerInsectExport,
  ServerMapExport,
  ServerMissionExport,
  ServerPlantExport,
} from '@garden-siege/protocol';
import {
  defaultInsectClientAssets,
  defaultPlantClientAssets,
  mergePreferPrimary,
  migrateBulletDefinition,
  migrateInsectDefinition,
  migrateMapDefinition,
  migrateMissionDefinition,
  migratePlantDefinition,
  normalizeBulletDefinition,
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

export function mergeBullet(client: ClientBulletExport, server?: ServerBulletExport): BulletDefinition {
  // Prefer client presentation/combat when both sides exist — editor writes client first.
  const merged = normalizeBulletDefinition({
    ...server,
    ...client,
    id: client.id || server?.id,
    displayName: client.displayName ?? server?.displayName,
    description: client.description ?? server?.description,
    client: mergePreferPrimary(client.client, server?.client) ?? client.client,
    stats: mergePreferPrimary(client.stats, server?.stats) ?? client.stats,
    schemaVersion: client.schemaVersion ?? server?.schemaVersion,
  });
  if (!merged) {
    throw new Error(`Invalid bullet definition: ${client.id ?? server?.id}`);
  }
  return migrateBulletDefinition(merged);
}

export function mergePlant(client: ClientPlantExport, server?: ServerPlantExport): PlantDefinition {
  // Client-first presentation (matches bullets). Deep-merge fills gaps from server
  // without wiping richer Unity/editor authoring (stateGraph, bulletShots, …).
  const merged: PlantDefinition = {
    id: client.id,
    displayName: client.displayName ?? server?.displayName ?? client.id,
    description: client.description ?? server?.description ?? '',
    role: client.role ?? server?.role ?? 'shooter',
    rarity: client.rarity ?? server?.rarity ?? 'common',
    stats: mergePreferPrimary(client.stats, server?.stats) ?? client.stats,
    client: mergePreferPrimary(client.client, server?.client) ?? client.client,
    server: server?.server ?? DEFAULT_PLANT_SERVER,
    behavior: mergePreferPrimary(client.behavior, server?.behavior),
    upgrade: server?.upgrade,
    schemaVersion: client.schemaVersion ?? server?.schemaVersion,
  };
  return migratePlantDefinition(merged);
}

export function mergeInsect(client: ClientInsectExport, server?: ServerInsectExport): InsectDefinition {
  const merged: InsectDefinition = {
    id: client.id,
    displayName: client.displayName ?? server?.displayName ?? client.id,
    description: client.description ?? server?.description ?? '',
    archetype: client.archetype ?? server?.archetype ?? 'swarm',
    rarity: client.rarity ?? server?.rarity ?? 'common',
    stats: mergePreferPrimary(client.stats, server?.stats) ?? client.stats,
    client: mergePreferPrimary(client.client, server?.client) ?? client.client,
    server: server?.server ?? DEFAULT_INSECT_SERVER,
    schemaVersion: client.schemaVersion ?? server?.schemaVersion,
  };
  return migrateInsectDefinition(merged);
}

export function mergeMission(client: ClientMissionExport, server?: ServerMissionExport): MissionDefinition {
  const rules = mergePreferPrimary(client.rules, server?.rules) ?? server?.rules ?? client.rules;
  const side = client.side ?? server?.side ?? (rules?.mode === 'i_zombie' ? 'attacker' : 'defender');
  const merged: MissionDefinition = {
    id: client.id,
    chapterId: client.chapterId,
    order: client.order,
    displayName: client.displayName,
    description: client.description,
    side,
    mapTemplateId: server?.mapTemplateId ?? client.mapTemplateId,
    rules,
    presetDefense: mergePreferPrimary(client.presetDefense, server?.presetDefense),
    waves: mergePreferPrimary(client.waves, server?.waves),
    startingSun: client.startingSun,
    availablePlants: client.availablePlants,
    starCriteria: mergePreferPrimary(client.starCriteria, server?.starCriteria) ??
      server?.starCriteria ??
      client.starCriteria,
    rewards: server?.rewards ?? { firstClear: {} },
    schemaVersion: client.schemaVersion ?? server?.schemaVersion,
  };
  return migrateMissionDefinition(merged);
}

export function mergeMap(client: ClientMapExport, server?: ServerMapExport): MapTemplateDefinition {
  const legacyColumns = Math.max(
    ...(client.lanes ?? []).map((lane) => lane.plantColumns ?? 0),
    ...(server?.lanes ?? []).map((lane) => lane.plantColumns ?? 0),
    0,
  );
  const merged: MapTemplateDefinition = {
    id: client.id,
    displayName: client.displayName,
    tier: client.tier ?? server?.tier ?? 1,
    laneCount: client.laneCount ?? server?.laneCount ?? 5,
    gridColumns: client.gridColumns ?? server?.gridColumns ?? (legacyColumns > 0 ? legacyColumns : 9),
    lanes: mergePreferPrimary(client.lanes, server?.lanes) ?? client.lanes ?? server?.lanes ?? [],
    client: client.client,
    server: server?.server ?? {
      corePosition: client.corePosition ?? { lane: 0, column: 0 },
      maxVillageLevel: 6,
      minVillageLevel: 1,
    },
    schemaVersion: client.schemaVersion ?? server?.schemaVersion,
  };
  return migrateMapDefinition(merged);
}

export function mergeGameDataBundle(parts: {
  clientPlants: ClientPlantExport[];
  serverPlants: ServerPlantExport[];
  clientInsects: ClientInsectExport[];
  serverInsects: ServerInsectExport[];
  clientBullets?: ClientBulletExport[];
  serverBullets?: ServerBulletExport[];
  clientMissions: ClientMissionExport[];
  serverMissions: ServerMissionExport[];
  clientMaps: ClientMapExport[];
  serverMaps: ServerMapExport[];
}): GameDataBundle {
  const serverPlants = indexById(parts.serverPlants);
  const serverInsects = indexById(parts.serverInsects);
  const serverBullets = indexById(parts.serverBullets ?? []);
  const serverMissions = indexById(parts.serverMissions);
  const serverMaps = indexById(parts.serverMaps);

  const clientPlantIds = new Set(parts.clientPlants.map((p) => p.id));
  const clientInsectIds = new Set(parts.clientInsects.map((p) => p.id));
  const clientBulletIds = new Set((parts.clientBullets ?? []).map((p) => p.id));
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
            client: defaultPlantClientAssets('Peashooter'),
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
            client: defaultInsectClientAssets('Zombie'),
            stats: server.stats,
          },
          server,
        ),
      ),
  ];

  const clientBullets = (parts.clientBullets ?? [])
    .map((raw) => normalizeBulletDefinition(raw))
    .filter((b): b is BulletDefinition => Boolean(b));
  const serverOnlyBullets = (parts.serverBullets ?? [])
    .filter((server) => !clientBulletIds.has(server.id))
    .map((raw) => normalizeBulletDefinition(raw))
    .filter((b): b is BulletDefinition => Boolean(b));

  const bullets = [
    ...clientBullets.map((client) => mergeBullet(client, serverBullets.get(client.id))),
    ...serverOnlyBullets.map((b) => migrateBulletDefinition(b)),
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
            side: server.side ?? 'defender',
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
            gridColumns: server.gridColumns ?? 9,
            lanes: server.lanes,
            corePosition: server.server.corePosition,
            client: {
              backgroundImage: 'Screen/Background/sprites/animations/Background/0',
              backgroundType: 0,
            },
          },
          server,
        ),
      ),
  ];

  return { plants, insects, bullets, missions, maps };
}
