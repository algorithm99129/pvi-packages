import type { ForceGardenProductionResult } from './garden';
import type { GardenRaidHistoryEntry } from './raid';
import type {
  AdminCreateGiftRequest,
  AdminCreateGiftResult,
} from './live-events';
import type { AdminMetricsSummary, CatalogUsageKind, CatalogUsageRow } from './metrics';
import type { UserRole } from './user';

export type { AdminCreateGiftRequest, AdminCreateGiftResult };

/** Default local Nest API base (includes /api prefix). */
export const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

/** Stored locally in Electron userData (not committed). */
export interface EditorAdminApiSecrets {
  email?: string;
  password?: string;
}

/** Public admin API config shown in the editor UI. */
export interface AdminApiPublicConfig {
  apiBaseUrl: string;
  hasCredentials: boolean;
  emailPreview?: string;
}

export interface AdminApiStatus {
  ok: boolean;
  apiBaseUrl: string;
  healthMessage?: string;
  loggedInAs?: string;
  /** Role from login/profile when authenticated. */
  role?: UserRole;
  error?: string;
}

export interface AdminSendGiftResult {
  ok: boolean;
  gift?: AdminCreateGiftResult;
  error?: string;
}

export interface AdminSimulateAiGardenAttackRequest {
  defenderUserId: string;
  victory?: boolean;
  stars?: number;
}

export interface AdminSimulateAiGardenAttackResult {
  ok: boolean;
  entry?: GardenRaidHistoryEntry;
  error?: string;
}

export interface AdminForceGardenProductionRequest {
  userId: string;
  hours?: number;
}

export interface AdminForceGardenProductionResult {
  ok: boolean;
  result?: ForceGardenProductionResult;
  error?: string;
}

export interface AdminMetricsSummaryResult {
  ok: boolean;
  summary?: AdminMetricsSummary;
  error?: string;
}

export interface AdminPopularityResult {
  ok: boolean;
  rows?: CatalogUsageRow[];
  kind?: CatalogUsageKind;
  error?: string;
}
