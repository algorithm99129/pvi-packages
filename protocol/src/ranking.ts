/**
 * Player rankings: one score per player from army strength, war and PvP results and campaign
 * progress. Refreshed by the API on a clock; GET /rankings/players pages through it.
 */

/** Points per unit of each part of the rank score. Strength counts point for point. */
export const PLAYER_RANK_WEIGHTS = {
  /** Army strength: (attack strength + defence strength) / 2. */
  strength: 1,
  /** Each star won attacking in a team war. */
  warStar: 30,
  /** Each team war the player's team won with them in the formation. */
  warWin: 150,
  /** Each battle won attacking: garden raids, war attacks and room matches. */
  attackWin: 40,
  /** Each battle won defending: raids on the player's garden that failed, room defences. */
  defenseWin: 20,
  /** Each campaign star. */
  campaignStar: 5,
  /** Each account level. */
  level: 20,
} as const;

export interface PlayerRankParts {
  strength: number;
  attackStrength: number;
  defenseStrength: number;
  warStars: number;
  warWins: number;
  attackWins: number;
  defenseWins: number;
  campaignStars: number;
  level: number;
}

/** The score a player's parts add up to (see PLAYER_RANK_WEIGHTS). */
export function playerRankScore(p: PlayerRankParts): number {
  const w = PLAYER_RANK_WEIGHTS;
  return Math.round(
    w.strength * p.strength
      + w.warStar * p.warStars
      + w.warWin * p.warWins
      + w.attackWin * p.attackWins
      + w.defenseWin * p.defenseWins
      + w.campaignStar * p.campaignStars
      + w.level * p.level,
  );
}

export interface PlayerRankRow extends PlayerRankParts {
  /** 1-based place among all ranked players (also in search results). */
  rank: number;
  userId: string;
  displayName: string;
  avatarId: string;
  teamName: string;
  score: number;
  isMe: boolean;
}

/** GET /rankings/players?offset=0&limit=10&q= */
export interface PlayerRankingPage {
  /** Players matching the search (all ranked players without one). */
  total: number;
  offset: number;
  rows: PlayerRankRow[];
  /** The signed-in player's own row, wherever they stand. */
  me: PlayerRankRow | null;
  /** When the scores were last refreshed. */
  updatedAt: string | null;
}
