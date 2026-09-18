/** Catalog entity kinds tracked for popularity. */
export type CatalogUsageKind = 'plant' | 'insect' | 'mission';

/** Public website-facing snapshot (cached on the API). */
export interface PublicGameStats {
  totalPlayers: number;
  /** Distinct players with lastActiveAt within the last 24 hours. */
  activePlayers24h: number;
  /** Distinct players with lastActiveAt within the last 7 days. */
  activePlayers7d: number;
  /** Garden raids completed today (UTC). */
  raidsToday: number;
  generatedAt: string;
}

/** One UTC calendar day of rollup counters. */
export interface MetricsDailyRow {
  /** UTC YYYY-MM-DD */
  date: string;
  newUsers: number;
  logins: number;
  dau: number;
  raidsStarted: number;
  raidsCompleted: number;
  missionsCompleted: number;
}

export interface CatalogUsageRow {
  kind: CatalogUsageKind;
  entityId: string;
  plays: number;
  completes: number;
}

/** Admin editor dashboard payload. */
export interface AdminMetricsSummary {
  totals: {
    totalPlayers: number;
    activePlayers24h: number;
    activePlayers7d: number;
    raidsToday: number;
  };
  /** Oldest → newest, length = requested days. */
  daily: MetricsDailyRow[];
  topPlants: CatalogUsageRow[];
  topInsects: CatalogUsageRow[];
  topMissions: CatalogUsageRow[];
  generatedAt: string;
}
