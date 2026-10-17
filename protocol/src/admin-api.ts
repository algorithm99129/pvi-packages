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

/** Studio → GET /admin/shop/orders. */
export interface AdminShopOrdersResult {
  ok: boolean;
  data?: import('./shop').AdminShopOrdersResponse;
  error?: string;
}

/** Studio → GET /telemetry/shop/funnel. */
export interface AdminShopFunnelResult {
  ok: boolean;
  data?: import('./telemetry').ShopFunnelSummary;
  error?: string;
}

export interface AdminPopularityResult {
  ok: boolean;
  rows?: CatalogUsageRow[];
  kind?: CatalogUsageKind;
  error?: string;
}

/** Re-export for editor IPC convenience (see app-settings.ts). */
export type { AdminAppSettingsResult } from './app-settings';

/** Who receives an admin announcement email. */
export type AdminAnnouncementRecipient =
  | 'all'
  | { userIds: string[] }
  | { emails: string[] };

/** POST /admin/announcements/email — Resend announcement to players. */
export interface AdminSendAnnouncementEmailRequest {
  /** Inbox subject line. */
  subject: string;
  /** Headline inside the email body. */
  title: string;
  /** Plain-text body; newlines become paragraphs in HTML. */
  body: string;
  /** `all` humans, selected user ids, or raw email addresses (single/bulk). */
  recipient: AdminAnnouncementRecipient;
  /** Optional absolute https URL shown as a CTA button. */
  ctaUrl?: string;
  /** Optional CTA button label (default "Open Greenkeep"). */
  ctaLabel?: string;
  /**
   * When true, include humans who have not verified email yet.
   * Default false — only verified accounts are emailed.
   */
  includeUnverified?: boolean;
  /** Hero image id from POST /admin/email/ai/image. */
  imageId?: string;
}

export interface AdminSendAnnouncementEmailResult {
  requested: number;
  sent: number;
  failed: number;
  skipped: number;
  failures?: Array<{ email: string; error: string }>;
}

/** What an update email says: the admin email page composes it, by hand or with AI. */
export interface AdminEmailContent {
  subject: string;
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  /** Hero image id from POST /admin/email/ai/image; shown above the headline. */
  imageId?: string;
}

/** POST /admin/email/ai/draft — OpenAI writes the email from a short brief. */
export interface AdminEmailDraftRequest {
  /** What the update is about, in the admin's words. The model states only these facts. */
  brief: string;
  tone?: 'friendly' | 'hype' | 'calm';
  /** The fields as they stand, so "make it shorter" style briefs can rework them. */
  current?: Partial<Pick<AdminEmailContent, 'subject' | 'title' | 'body' | 'ctaLabel'>>;
}

export interface AdminEmailDraft {
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  /** A prompt for POST /admin/email/ai/image that fits the email. */
  imagePrompt: string;
}

/** POST /admin/email/ai/image — OpenAI image, stored by the API and served from /mail/images/:id. */
export type AdminEmailImageQuality = 'low' | 'medium' | 'high';

export interface AdminEmailImageRequest {
  prompt: string;
  shape?: 'wide' | 'square';
  /** Image quality (default medium). Higher takes longer and costs more. */
  quality?: AdminEmailImageQuality;
}

/**
 * A header image: generated (POST /admin/email/ai/image) or uploaded
 * (POST /admin/email/images, multipart field `file`).
 */
export interface AdminEmailImage {
  id: string;
  /** Absolute URL mail clients load the image from. */
  url: string;
  prompt: string;
  width: number;
  height: number;
}

/** POST /admin/email/preview — the email exactly as a recipient gets it (the admin's name in the greeting). */
export interface AdminEmailPreview {
  subject: string;
  html: string;
  text: string;
}

/** POST /admin/email/audience — how many addresses a recipient choice reaches right now. */
export interface AdminEmailAudienceCount {
  recipients: number;
  /** Suspended, unverified (unless included) or unsubscribed. */
  skipped: number;
  unsubscribed: number;
}

export type AdminEmailCampaignStatus = 'sending' | 'sent' | 'failed';

/** POST /admin/email/campaigns starts one; GET lists them. Sends run in the background. */
export interface AdminEmailCampaign {
  id: string;
  subject: string;
  title: string;
  audience: 'all' | 'players' | 'emails';
  status: AdminEmailCampaignStatus;
  requested: number;
  sent: number;
  failed: number;
  skipped: number;
  imageUrl?: string;
  createdAt: string;
  finishedAt?: string;
  createdByEmail?: string;
  error?: string;
  failures?: Array<{ email: string; error: string }>;
}

/** Who an automatic email comes from: the founder (feedback, replies to him) or the team. */
export type AdminLifecycleSender = 'founder' | 'team';

/** One automatic (event-based) email: what triggers it and how it is doing. */
export interface AdminLifecycleRule {
  key: string;
  name: string;
  sender: AdminLifecycleSender;
  /** The From line, e.g. "Andrew Yuan <andrew@greenkeep.org>". */
  from: string;
  /** When it is sent, in words. */
  trigger: string;
  subject: string;
  enabled: boolean;
  sentTotal: number;
  sent7d: number;
}

export interface AdminLifecycleSendRow {
  at: string;
  key: string;
  email: string;
  status: 'sent' | 'failed';
  error?: string;
}

/** GET /admin/email/automations */
export interface AdminLifecycleStatus {
  /** Master switch: nothing is sent while false. */
  enabled: boolean;
  /** How often the API looks for people to email, in minutes. */
  checkEveryMinutes: number;
  rules: AdminLifecycleRule[];
  recent: AdminLifecycleSendRow[];
}

/** PATCH /admin/email/automations */
export interface AdminLifecycleUpdate {
  enabled?: boolean;
  rules?: Array<{ key: string; enabled: boolean }>;
}

/** POST /admin/email/automations/run — one pass now. */
export interface AdminLifecycleRunResult {
  sent: number;
  failed: number;
  byRule: Record<string, number>;
}

export interface AdminSendAnnouncementResult {
  ok: boolean;
  result?: AdminSendAnnouncementEmailResult;
  error?: string;
}
