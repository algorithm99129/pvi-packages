import type { AiImageGenerationMode } from './ai';

export const DEFAULT_GALLERY_DIRECTORY = 'gallery';

/** @deprecated Use DEFAULT_GALLERY_DIRECTORY */
export const GALLERY_FOLDER_NAME = DEFAULT_GALLERY_DIRECTORY;

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
