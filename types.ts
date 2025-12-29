
export interface FrameData {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  index: number;
}

export interface SVGAConfig {
  fps: number;
  duration: number; // in seconds
  loop: boolean;
}

export interface GenerationStatus {
  progress: number;
  message: string;
  isGenerating: boolean;
}
