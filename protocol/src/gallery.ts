import type { AiImageGenerationMode } from './ai';

export const GALLERY_FOLDER_NAME = 'Gallery';

export interface GalleryImageMetadata {
  id: string;
  filename: string;
  prompt?: string;
  mode?: AiImageGenerationMode;
  model?: string;
  imageSize?: string;
  createdAt: string;
}

export interface GalleryImageEntry extends GalleryImageMetadata {
  absolutePath: string;
}
