import type { InsectDefinition, PlantDefinition } from './index';

export type AiEntityKind = 'plant' | 'insect';

export type ImageSizeOption =
  | 'auto'
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '1024x1792'
  | '1792x1024'
  | '2048x2048'
  | '2048x1152'
  | '3840x2160'
  | '2160x3840';

export type ImageBackgroundOption = 'transparent' | 'opaque' | 'auto';

export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

export type GptImageQuality = 'low' | 'medium' | 'high' | 'auto';

export type Dalle3Quality = 'standard' | 'hd';

export type DalleStyle = 'vivid' | 'natural';

export type ImageQualityOption = GptImageQuality | Dalle3Quality;

export type ImageModelFamily = 'gpt-image' | 'dall-e-3' | 'dall-e-2';

export interface ImageModelOption {
  id: string;
  label: string;
  description: string;
  family: ImageModelFamily;
  sizes: readonly ImageSizeOption[];
  supportsTransparentBackground: boolean;
  supportsOutputFormat: boolean;
  supportsQuality: boolean;
  supportsStyle: boolean;
  qualityOptions: readonly ImageQualityOption[];
  defaultQuality: ImageQualityOption;
  badges?: readonly string[];
}

export interface EditorAiConfig {
  openaiApiKey?: string;
  /** HTTP(S) proxy for OpenAI requests, e.g. http://user:pass@host:port */
  openaiProxyUrl?: string;
  textModel: string;
  imageModel: string;
  imageSize: ImageSizeOption;
  imageBackground: ImageBackgroundOption;
  imageOutputFormat: ImageOutputFormat;
  imageQuality: ImageQualityOption;
  imageStyle: DalleStyle;
}

export const DEFAULT_AI_CONFIG: EditorAiConfig = {
  textModel: 'gpt-4o-mini',
  imageModel: 'gpt-image-1.5',
  imageSize: '1024x1024',
  imageBackground: 'transparent',
  imageOutputFormat: 'png',
  imageQuality: 'auto',
  imageStyle: 'vivid',
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
  imageBackground?: ImageBackgroundOption;
  imageOutputFormat?: ImageOutputFormat;
  imageQuality?: ImageQualityOption;
  imageStyle?: DalleStyle;
}

export const IMAGE_MODEL_OPTIONS: readonly ImageModelOption[] = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    description: 'Latest flagship model. Best detail and instruction following; no transparent backgrounds.',
    family: 'gpt-image',
    sizes: [
      'auto',
      '1024x1024',
      '1536x1024',
      '1024x1536',
      '2048x2048',
      '2048x1152',
      '3840x2160',
      '2160x3840',
    ],
    supportsTransparentBackground: false,
    supportsOutputFormat: true,
    supportsQuality: true,
    supportsStyle: false,
    qualityOptions: ['low', 'medium', 'high', 'auto'],
    defaultQuality: 'auto',
    badges: ['Latest', '4K'],
  },
  {
    id: 'gpt-image-1.5',
    label: 'GPT Image 1.5',
    description: 'Strong all-rounder with transparent PNG support — ideal for sprites and UI icons.',
    family: 'gpt-image',
    sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
    supportsTransparentBackground: true,
    supportsOutputFormat: true,
    supportsQuality: true,
    supportsStyle: false,
    qualityOptions: ['low', 'medium', 'high', 'auto'],
    defaultQuality: 'auto',
    badges: ['Transparent', 'Recommended'],
  },
  {
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    description: 'Versatile GPT Image model with transparent background support.',
    family: 'gpt-image',
    sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
    supportsTransparentBackground: true,
    supportsOutputFormat: true,
    supportsQuality: true,
    supportsStyle: false,
    qualityOptions: ['low', 'medium', 'high', 'auto'],
    defaultQuality: 'auto',
    badges: ['Transparent'],
  },
  {
    id: 'gpt-image-1-mini',
    label: 'GPT Image 1 Mini',
    description: 'Faster, lower-cost GPT Image model with transparency support.',
    family: 'gpt-image',
    sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
    supportsTransparentBackground: true,
    supportsOutputFormat: true,
    supportsQuality: true,
    supportsStyle: false,
    qualityOptions: ['low', 'medium', 'high', 'auto'],
    defaultQuality: 'low',
    badges: ['Fast', 'Transparent'],
  },
  {
    id: 'chatgpt-image-latest',
    label: 'ChatGPT Image Latest',
    description: 'Rolling alias for the image model used in ChatGPT.',
    family: 'gpt-image',
    sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
    supportsTransparentBackground: true,
    supportsOutputFormat: true,
    supportsQuality: true,
    supportsStyle: false,
    qualityOptions: ['low', 'medium', 'high', 'auto'],
    defaultQuality: 'auto',
    badges: ['Alias'],
  },
  {
    id: 'dall-e-3',
    label: 'DALL·E 3',
    description: 'Legacy creative model with vivid/natural styles and HD quality.',
    family: 'dall-e-3',
    sizes: ['1024x1024', '1024x1792', '1792x1024'],
    supportsTransparentBackground: false,
    supportsOutputFormat: false,
    supportsQuality: true,
    supportsStyle: true,
    qualityOptions: ['standard', 'hd'],
    defaultQuality: 'standard',
    badges: ['Legacy'],
  },
  {
    id: 'dall-e-2',
    label: 'DALL·E 2',
    description: 'Legacy budget model. Smaller sizes only; PNG output.',
    family: 'dall-e-2',
    sizes: ['256x256', '512x512', '1024x1024'],
    supportsTransparentBackground: false,
    supportsOutputFormat: false,
    supportsQuality: false,
    supportsStyle: false,
    qualityOptions: [],
    defaultQuality: 'standard',
    badges: ['Legacy', 'Budget'],
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
  hasProxy: boolean;
  proxyPreview?: string;
  textModel: string;
  imageModel: string;
  imageSize: EditorAiConfig['imageSize'];
  imageBackground: ImageBackgroundOption;
  imageOutputFormat: ImageOutputFormat;
  imageQuality: ImageQualityOption;
  imageStyle: DalleStyle;
}

export function getImageModelOption(modelId: string): ImageModelOption {
  return IMAGE_MODEL_OPTIONS.find((entry) => entry.id === modelId) ?? IMAGE_MODEL_OPTIONS[1];
}

export function sizesForImageModel(modelId: string): readonly ImageSizeOption[] {
  return getImageModelOption(modelId).sizes;
}

export function defaultSizeForImageModel(modelId: string): ImageSizeOption {
  const sizes = sizesForImageModel(modelId);
  return sizes.includes('1024x1024') ? '1024x1024' : sizes[0];
}

export function coerceImageSize(modelId: string, size: ImageSizeOption): ImageSizeOption {
  const sizes = sizesForImageModel(modelId);
  return sizes.includes(size) ? size : defaultSizeForImageModel(modelId);
}

export function coerceImageQuality(
  modelId: string,
  quality: ImageQualityOption | undefined,
): ImageQualityOption | undefined {
  const option = getImageModelOption(modelId);
  if (!option.supportsQuality) return undefined;
  const resolved = quality ?? option.defaultQuality;
  return option.qualityOptions.includes(resolved) ? resolved : option.defaultQuality;
}

export function coerceImageBackground(
  modelId: string,
  background: ImageBackgroundOption | undefined,
): ImageBackgroundOption | undefined {
  const option = getImageModelOption(modelId);
  if (!option.supportsTransparentBackground && background === 'transparent') {
    return 'opaque';
  }
  if (option.family === 'gpt-image') {
    return background ?? 'auto';
  }
  return undefined;
}

export function extensionForOutputFormat(format: ImageOutputFormat): string {
  if (format === 'jpeg') return 'jpg';
  return format;
}

export function applyOutputExtension(path: string, format: ImageOutputFormat): string {
  const ext = extensionForOutputFormat(format);
  const base = path.replace(/\.(png|jpe?g|webp)$/i, '');
  return `${base}.${ext}`;
}

export function normalizeOpenAiProxyUrl(raw?: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  let candidate = trimmed;
  if (!/^[a-z]+:\/\//i.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  const parsed = new URL(candidate);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Proxy URL must use http:// or https://');
  }
  if (!parsed.hostname) {
    throw new Error('Proxy URL must include a host');
  }

  return parsed.toString().replace(/\/$/, '');
}

export function maskProxyUrl(url?: string): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    const parsed = new URL(url);
    const host = `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    if (parsed.username) {
      return `${parsed.protocol}//••••@${host}`;
    }
    return `${parsed.protocol}//${host}`;
  } catch {
    return '••••';
  }
}
