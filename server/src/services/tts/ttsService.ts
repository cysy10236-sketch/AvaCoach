import { env } from "../../config/env.js";
import type { TtsProviderName, TtsResponse } from "../../types/tts.js";
import { synthesizeMockSpeech } from "./providers/mockTtsProvider.js";
import { synthesizeOpenAiSpeech } from "./providers/openaiTtsProvider.js";
import { synthesizeVolcanoSpeech } from "./providers/volcanoTtsProvider.js";
import type { TtsProviderResult } from "./providers/types.js";

const maxInputCharacters = 1800;

export async function createSpeechAudio(text: string): Promise<TtsResponse> {
  const input = text.trim().slice(0, maxInputCharacters);

  if (!input) {
    return createFallback(text, "Text is required for TTS.", env.tts.provider);
  }

  const result = await synthesizeWithProvider(input);

  if (result.fallback || !result.audioBuffer || !result.contentType) {
    return createFallback(
      input,
      result.message ?? "TTS provider returned fallback.",
      result.provider,
    );
  }

  return {
    source: "tts",
    fallback: false,
    audio: result.audioBuffer,
    contentType: result.contentType,
  };
}

async function synthesizeWithProvider(input: string): Promise<TtsProviderResult> {
  if (env.tts.provider === "mock") {
    return synthesizeMockSpeech();
  }

  if (env.tts.provider === "volcano") {
    return synthesizeVolcanoSpeech(input);
  }

  return synthesizeOpenAiSpeech(input);
}

function createFallback(
  text: string,
  message: string,
  provider: TtsProviderName,
): TtsResponse {
  return {
    source: "browser-fallback",
    fallback: true,
    provider,
    text,
    message,
  };
}
