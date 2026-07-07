/** Client branding — loading screen, title, etc. */
export interface ClientBrandingConfig {
  gameTitle?: string;
  /** Path relative to Assets/Resources, e.g. game/branding/loading-screen.png */
  loadingScreenImage?: string;
}

export const DEFAULT_BRANDING: ClientBrandingConfig = {
  gameTitle: 'Garden Siege',
};
