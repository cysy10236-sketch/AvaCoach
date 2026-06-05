import type { TtsProviderName } from "../../../types/tts.js";

export interface TtsProviderResult {
  success: boolean;
  provider: TtsProviderName;
  audioBuffer?: Buffer;
  contentType?: string;
  fallback: boolean;
  message?: string;
}

export interface TtsProvider {
  synthesizeSpeech(text: string): Promise<TtsProviderResult>;
}
