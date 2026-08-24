import type { EntityId } from './index';

/** Logic constant ids (`Systems/logic.json`). */
export const TEAM_MATCH_DURATION_MS_ID = 'TEAM_MATCH_DURATION_MS';
export const TEAM_MATCH_DURATION_MS_DEFAULT = 24 * 60 * 60 * 1000;

export const TEAM_MATCH_ATTEMPTS_PER_MEMBER_ID = 'TEAM_MATCH_ATTEMPTS_PER_MEMBER';
export const TEAM_MATCH_ATTEMPTS_PER_MEMBER_DEFAULT = 2;

export const TEAM_MATCH_CLEAR_STARS_ID = 'TEAM_MATCH_CLEAR_STARS';
export const TEAM_MATCH_CLEAR_STARS_DEFAULT = 2;

export const TEAM_MATCH_MAX_STARS_PER_RAID_ID = 'TEAM_MATCH_MAX_STARS_PER_RAID';
export const TEAM_MATCH_MAX_STARS_PER_RAID_DEFAULT = 3;

export type TeamFormationSize = 5 | 10;

export type TeamMatchStatus = 'prep' | 'live' | 'completed';
export type TeamMatchResult = 'home_win' | 'away_win' | 'draw';

/** Slots per layer for a formation size (layers 1–3). */
export const FORMATION_SLOT_COUNTS: Record<TeamFormationSize, readonly [number, number, number]> = {
  5: [1, 2, 2],
  10: [2, 3, 5],
};

export function isTeamFormationSize(value: unknown): value is TeamFormationSize {
  return value === 5 || value === 10;
}

export function formationSlotCounts(size: TeamFormationSize): readonly [number, number, number] {
  return FORMATION_SLOT_COUNTS[size];
}

/** One layer in a combat formation. */
export interface TeamFormationLayer {
  /** 1-based layer index (front = 1). */
  layer: 1 | 2 | 3;
  /** Member user ids; `null` = empty slot. Length fixed by formation size. */
  slots: Array<EntityId | null>;
}

/** Leader-authored (or snapshotted) combat formation. */
export interface TeamCombatFormation {
  size: TeamFormationSize;
  layers: TeamFormationLayer[];
  /** ISO timestamp of last draft edit. */
  updatedAt?: string;
  updatedBy?: EntityId;
}

/** Create an empty formation of the given size. */
export function emptyCombatFormation(size: TeamFormationSize): TeamCombatFormation {
  const counts = formationSlotCounts(size);
  return {
    size,
    layers: [
      { layer: 1, slots: Array.from({ length: counts[0] }, () => null) },
      { layer: 2, slots: Array.from({ length: counts[1] }, () => null) },
      { layer: 3, slots: Array.from({ length: counts[2] }, () => null) },
    ],
  };
}

/**
 * Normalize / pad / truncate a formation to a target size.
 * Duplicate member ids keep the first occurrence; later slots become null.
 */
export function normalizeCombatFormation(
  input: Partial<TeamCombatFormation> | null | undefined,
  size: TeamFormationSize,
): TeamCombatFormation {
  const counts = formationSlotCounts(size);
  const seen = new Set<string>();
  const layers: TeamFormationLayer[] = [];

  for (let li = 0; li < 3; li++) {
    const want = counts[li];
    const src = input?.layers?.find((l) => l.layer === li + 1)?.slots ?? [];
    const slots: Array<EntityId | null> = [];
    for (let i = 0; i < want; i++) {
      const raw = src[i];
      const id =
        typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
      if (id && !seen.has(id)) {
        seen.add(id);
        slots.push(id);
      } else {
        slots.push(null);
      }
    }
    layers.push({ layer: (li + 1) as 1 | 2 | 3, slots });
  }

  return {
    size,
    layers,
    updatedAt: input?.updatedAt,
    updatedBy: input?.updatedBy,
  };
}

/** Flat slot index across all layers (0-based). */
export function flatSlotIndex(
  size: TeamFormationSize,
  layer: 1 | 2 | 3,
  indexInLayer: number,
): number {
  const counts = formationSlotCounts(size);
  let offset = 0;
  for (let l = 1; l < layer; l++) offset += counts[l - 1];
  return offset + indexInLayer;
}

export function layerForFlatIndex(
  size: TeamFormationSize,
  flatIndex: number,
): { layer: 1 | 2 | 3; indexInLayer: number } {
  const counts = formationSlotCounts(size);
  let remaining = flatIndex;
  for (let l = 0; l < 3; l++) {
    if (remaining < counts[l]) {
      return { layer: (l + 1) as 1 | 2 | 3, indexInLayer: remaining };
    }
    remaining -= counts[l];
  }
  return { layer: 3, indexInLayer: Math.max(0, counts[2] - 1) };
}

/** Stars from lanes destroyed (capped). */
export function starsFromLanesDestroyed(
  lanesDestroyed: number,
  maxStars = TEAM_MATCH_MAX_STARS_PER_RAID_DEFAULT,
): number {
  const n = Math.max(0, Math.floor(lanesDestroyed));
  const cap = Math.max(0, Math.floor(maxStars));
  return Math.min(cap, n);
}

export interface TeamMatchSlotState {
  /** Flat index in the side's formation. */
  flatIndex: number;
  layer: 1 | 2 | 3;
  userId: EntityId | null;
  bestStars: number;
  cleared: boolean;
  /** Display enrichment for UI (optional). */
  displayName?: string;
  avatarId?: string;
  /** Trophy / score proxy for the seated member. */
  score?: number;
  /** Remaining war attempts for this member (0–2). Empty slots omit. */
  attemptsRemaining?: number;
}

/** True when every slot in layers 1..(layer-1) is cleared. Layer 1 always open. */
export function isLayerOpen(
  slotStates: readonly TeamMatchSlotState[],
  layer: 1 | 2 | 3,
): boolean {
  if (layer <= 1) return true;
  return slotStates
    .filter((s) => s.layer < layer)
    .every((s) => s.cleared);
}

export function sumBestStars(slotStates: readonly TeamMatchSlotState[]): number {
  return slotStates.reduce((sum, s) => sum + Math.max(0, s.bestStars | 0), 0);
}

export interface TeamMatchAttackLog {
  attackerUserId: EntityId;
  defenderUserId: EntityId;
  defenderFlatIndex: number;
  defenderLayer: 1 | 2 | 3;
  stars: number;
  lanesDestroyed: number;
  createdAt: string;
}

export interface TeamMatchSideView {
  teamId: EntityId;
  teamName: string;
  formation: TeamCombatFormation;
  slots: TeamMatchSlotState[];
  stars: number;
  /** Layers currently open for the opposing team to attack (1–3). */
  openLayers: Array<1 | 2 | 3>;
}

export interface TeamMatchView {
  id: EntityId;
  seasonMatchId?: EntityId;
  seasonId?: EntityId;
  formationSize: TeamFormationSize;
  status: TeamMatchStatus;
  startsAt: string;
  endsAt: string;
  formationsLocked: boolean;
  home: TeamMatchSideView;
  away: TeamMatchSideView;
  /** Remaining attempts for the current viewer (0–2), when seated. */
  myAttemptsRemaining?: number;
  result?: TeamMatchResult;
  attackCount: number;
}

export interface UpdateTeamFormationRequest {
  size: TeamFormationSize;
  layers: TeamFormationLayer[];
}

export interface TeamFormationResult {
  formation: TeamCombatFormation;
}

export interface TeamMatchTargetView {
  userId: EntityId;
  displayName: string;
  flatIndex: number;
  layer: 1 | 2 | 3;
  bestStars: number;
  cleared: boolean;
}

export interface TeamMatchTargetsResult {
  matchId: EntityId;
  targets: TeamMatchTargetView[];
  myAttemptsRemaining: number;
  endsAt: string;
}

export interface StartTeamMatchAttackRequest {
  defenderUserId: EntityId;
}

/** Response from POST /team-matches/:id/attacks — same scout shape as garden match. */
export interface StartTeamMatchAttackResult {
  matchId: EntityId;
  teamMatchId: EntityId;
  defenderUserId: EntityId;
  /** Embedded garden scout payload (client uses existing raid launch path). */
  scout: unknown;
}
