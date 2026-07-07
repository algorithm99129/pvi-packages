export type RaidActionType = 'deploy_queue' | 'release';

export interface RaidAction {
  t: number;
  type: RaidActionType;
  lane: number;
  insect?: string;
  slot?: number;
}

export interface RaidClientResult {
  stars: number;
  plantsDestroyedPct: number;
  coreDestroyed: boolean;
  duration: number;
}

export interface RaidSimInput {
  balanceVersion: string;
  defenderSnapshot: unknown;
  loadout: unknown;
  actions: RaidAction[];
  rngSeed: number;
}

export interface RaidSimOutput {
  result: RaidClientResult;
  /** Full tick log for replay debugging (optional) */
  debug?: boolean;
}

/**
 * Deterministic raid simulation.
 * TODO: implement lane logic in M0 vertical slice.
 */
export function simulateRaid(_input: RaidSimInput): RaidSimOutput {
  return {
    result: {
      stars: 0,
      plantsDestroyedPct: 0,
      coreDestroyed: false,
      duration: 0,
    },
  };
}

export function validateActionLog(actions: RaidAction[]): boolean {
  return actions.every(
    (a) =>
      a.t >= 0 &&
      a.lane >= 0 &&
      (a.type === 'release' || (a.type === 'deploy_queue' && a.insect && a.slot !== undefined)),
  );
}
