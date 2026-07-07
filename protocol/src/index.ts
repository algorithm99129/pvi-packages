/** Shared game entity identifiers */
export type EntityId = string;

/** Balance data version — bump when server/client exports change */
export const BALANCE_VERSION = '0.1.0';

export * from './plant';
export * from './insect';
export * from './mission';
export * from './map';
export * from './workspace';
export * from './export-paths';
