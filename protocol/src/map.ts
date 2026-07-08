export type MapCellType = 'ground' | 'water' | 'bridge';

export const MAP_CELL_TYPES: MapCellType[] = ['ground', 'water', 'bridge'];

export interface MapLaneConfig {
  laneIndex: number;
  /** @deprecated Use per-cell `gridLayout.cellTypes` */
  terrain?: MapCellType;
  /** @deprecated Use map-level `gridColumns` */
  plantColumns?: number;
}

/** Per-grid-cell terrain / surface type. Omitted cells default to `ground`. */
export interface MapGridCellType {
  lane: number;
  column: number;
  type: MapCellType;
}

/** @deprecated Legacy cell-center anchors — migrated to `corners` on load */
export interface MapGridCellAnchor {
  lane: number;
  column: number;
  x: number;
  y: number;
}

/** Grid mesh intersection (row 0..laneCount, col 0..maxPlantColumns). */
export interface MapGridCorner {
  row: number;
  col: number;
  x: number;
  y: number;
}

/** Per-lane seed (PVZ brain) — lane is lost if insects reach it. */
/** @deprecated Not authored in the map editor; Unity uses default mower anchors. */
export interface MapLaneSeedAnchor {
  lane: number;
  x: number;
  y: number;
}

/**
 * Lane grid authored in normalized coordinates (0–1) relative to the map background image.
 * `referenceWidth` × `referenceHeight` must match the background image pixel size.
 * Corner points form the cell mesh.
 * Plant/insect column zones are defined on missions / game rules, not here.
 */
export interface MapGridLayout {
  /** Background image width in pixels — all normalized X coords are relative to this. */
  referenceWidth: number;
  /** Background image height in pixels — all normalized Y coords are relative to this. */
  referenceHeight: number;
  corners: MapGridCorner[];
  /** @deprecated Not authored in the map editor */
  seeds?: MapLaneSeedAnchor[];
  /** Per-cell surface type (ground, water, bridge). Missing cells = ground. */
  cellTypes?: MapGridCellType[];
  /** @deprecated Migrated to `corners` */
  cells?: MapGridCellAnchor[];
}

/** Village / story map template */
export interface MapTemplateDefinition {
  id: string;
  displayName: string;
  tier: number;
  laneCount: number;
  /** Total cell columns per lane on the grid mesh (corner lines = gridColumns + 1). */
  gridColumns: number;
  lanes: MapLaneConfig[];
  /** Client background / tileset — paths relative to Assets/Resources */
  client: {
    backgroundImage: string;
    /** Background variant index (0=day, 1=night, …) */
    backgroundType?: number;
    tileset?: string;
    parallaxLayers?: string[];
    /** Optional per-cell anchors aligned to the background art */
    gridLayout?: MapGridLayout;
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
  gridColumns: number;
  lanes: MapLaneConfig[];
  server: MapTemplateDefinition['server'];
}

export interface ClientMapExport {
  id: string;
  displayName: string;
  tier: number;
  laneCount: number;
  gridColumns: number;
  lanes: MapLaneConfig[];
  corePosition: MapTemplateDefinition['server']['corePosition'];
  client: MapTemplateDefinition['client'];
}
