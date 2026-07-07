export interface MapLaneConfig {
  laneIndex: number;
  plantColumns: number;
  terrain?: 'ground' | 'water' | 'bridge';
}

/** Village / story map template */
export interface MapTemplateDefinition {
  id: string;
  displayName: string;
  tier: number;
  laneCount: number;
  lanes: MapLaneConfig[];
  /** Client background / tileset */
  client: {
    backgroundImage: string;
    tileset?: string;
    parallaxLayers?: string[];
  };
  /** Server topology only */
  server: {
    corePosition: { lane: number; column: number };
    maxVillageLevel: number;
    minVillageLevel: number;
  };
}

export interface ServerMapExport {
  id: string;
  tier: number;
  laneCount: number;
  lanes: MapLaneConfig[];
  server: MapTemplateDefinition['server'];
}

export interface ClientMapExport {
  id: string;
  displayName: string;
  tier: number;
  laneCount: number;
  lanes: MapLaneConfig[];
  client: MapTemplateDefinition['client'];
}
