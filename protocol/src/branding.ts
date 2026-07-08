/** Client branding — loading screen, title, etc. */
export interface ClientBrandingConfig {
  gameTitle?: string;
  /** Path relative to Assets/Resources, e.g. gfx/Screen/MainMenu */
  loadingScreenImage?: string;
}

export const DEFAULT_BRANDING: ClientBrandingConfig = {
  gameTitle: 'Garden Siege',
  loadingScreenImage: 'Screen/MainMenu',
};
