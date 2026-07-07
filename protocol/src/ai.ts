import type { InsectDefinition, PlantDefinition } from './index';

export type AiEntityKind = 'plant' | 'insect';

export type ImageSizeOption =
  | '1024x1024'
  | '1024x1792'
  | '1792x1024'
  | '256x256'
  | '512x512';

export interface EditorAiConfig {
  openaiApiKey?: string;
  textModel: string;
  imageModel: string;
  imageSize: ImageSizeOption;
}

export const DEFAULT_AI_CONFIG: EditorAiConfig = {
  textModel: 'gpt-4o-mini',
  imageModel: 'dall-e-3',
  imageSize: '1024x1024',
};

export interface AiGenerateEntityRequest {
  kind: AiEntityKind;
  prompt: string;
  /** When set, AI enhances this existing game-data definition */
  base?: PlantDefinition | InsectDefinition;
}

export interface AiGenerateEntityResult {
  kind: AiEntityKind;
  definition: PlantDefinition | InsectDefinition;
}

export interface AiGenerateImageRequest {
  kind?: AiEntityKind;
  entityId?: string;
  prompt: string;
  assetType?: 'icon' | 'sheet';
  /** When set, saves directly to this Resources-relative path (e.g. game/branding/loading-screen.png) */
  targetRelativePath?: string;
  /** Per-request overrides from the generation modal */
  imageModel?: string;
  imageSize?: ImageSizeOption;
}

export const IMAGE_MODEL_OPTIONS = [
  {
    id: 'dall-e-3',
    label: 'DALL·E 3',
    sizes: ['1024x1024', '1024x1792', '1792x1024'] as const,
  },
  {
    id: 'dall-e-2',
    label: 'DALL·E 2',
    sizes: ['256x256', '512x512', '1024x1024'] as const,
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODEL_OPTIONS)[number]['id'];

export interface AiGenerateImageResult {
  entityId: string;
  savedPath: string;
  relativePath: string;
}

export interface AiConfigPublic {
  hasApiKey: boolean;
  apiKeyPreview?: string;
  textModel: string;
  imageModel: string;
  imageSize: EditorAiConfig['imageSize'];
}
