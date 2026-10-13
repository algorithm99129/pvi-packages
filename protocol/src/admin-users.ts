import type { UserRole } from './user';
import type { WalletResources } from './wallet';

/**
 * The website's admin console: player management and growth statistics. Every route here is
 * admin-only (JWT with role=admin; the role is re-read from the database on each request).
 */

export type AdminUserFilter = 'humans' | 'all' | 'ai' | 'admins' | 'suspended' | 'unverified' | 'payers';
export type AdminUserSort = 'joined' | 'active' | 'level' | 'gems' | 'spent';

export const ADMIN_USER_FILTERS: readonly AdminUserFilter[] = ['humans', 'all', 'ai', 'admins', 'suspended', 'unverified', 'payers'];
export const ADMIN_USER_SORTS: readonly AdminUserSort[] = ['joined', 'active', 'level', 'gems', 'spent'];

/** One row of GET /admin/users. */
export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  avatarId: string;
  role: UserRole;
  isAi: boolean;
  suspended: boolean;
  emailVerified: boolean;
  userLevel: number;
  totalXp: number;
  wallet: WalletResources;
  trophyScore: number;
  teamId: string | null;
  missionsCompleted: number;
  plantsUnlocked: number;
  insectsUnlocked: number;
  loginCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  /** Paid real-money orders: how many and the gross in cents. */
  paidOrders: number;
  spentCents: number;
}

export interface AdminUserListResponse {
  users: AdminUserRow[];
  /** Rows matching the query and filter, before paging. */
  total: number;
  page: number;
  limit: number;
}

export interface AdminUserOrderRow {
  id: string;
  sku: string;
  status: string;
  method: string;
  priceCents: number;
  createdAt: string;
  paidAt: string | null;
}

/** GET /admin/users/:id */
export interface AdminUserDetail extends AdminUserRow {
  gardenLevel: number;
  attackWins: number;
  attackLosses: number;
  defenseWins: number;
  defenseLosses: number;
  loginStreak: number;
  potionsOwned: number;
  teamName: string | null;
  /** Most recent orders, newest first (up to 20). */
  orders: AdminUserOrderRow[];
}

/** PATCH /admin/users/:id — only the fields present are changed. */
export interface AdminUserPatchRequest {
  suspended?: boolean;
  role?: UserRole;
  emailVerified?: boolean;
  displayName?: string;
}

/** POST /admin/users/:id/wallet — a signed adjustment; balances never go below zero. */
export interface AdminWalletGrantRequest {
  coin?: number;
  gem?: number;
  leaf?: number;
  /** Why (support ticket, compensation…). Logged with the admin's id. */
  reason?: string;
}

export interface AdminGrowthDay {
  /** UTC YYYY-MM-DD */
  date: string;
  /** Human accounts created that day. */
  signups: number;
  /** Distinct daily active players (from the daily rollup). */
  dau: number;
  missionsCompleted: number;
  raidsCompleted: number;
  /** Paid orders that day and their gross in cents. */
  orders: number;
  grossCents: number;
}

/**
 * Rolling retention: of the human accounts old enough to judge, the share still active N or
 * more days after they joined (from `createdAt` and `lastActiveAt`).
 */
export interface AdminRetentionPoint {
  day: number;
  eligible: number;
  retained: number;
  /** 0–1; 0 when nobody is eligible yet. */
  rate: number;
}

export interface AdminLevelBucket {
  label: string;
  count: number;
}

/** GET /admin/metrics/growth */
export interface AdminGrowthSummary {
  days: number;
  totals: {
    humans: number;
    ai: number;
    verified: number;
    suspended: number;
    admins: number;
    inTeam: number;
    /** Humans with at least one paid order, and all-time gross in cents. */
    payers: number;
    grossCents: number;
    active24h: number;
    active7d: number;
    active30d: number;
  };
  /** Oldest → newest, one row per UTC day in the window. */
  daily: AdminGrowthDay[];
  retention: AdminRetentionPoint[];
  levels: AdminLevelBucket[];
  generatedAt: string;
}
