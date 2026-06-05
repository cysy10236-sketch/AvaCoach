import type { TtsProviderResult } from "./types.js";

export async function synthesizeMockSpeech(): Promise<TtsProviderResult> {
  return {
    success: false,
    provider: "mock",
    fallback: true,
    message: "Mock TTS provider is active. Browser speech fallback should be used.",
  };
}
