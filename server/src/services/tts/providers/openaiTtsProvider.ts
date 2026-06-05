import { env } from "../../../config/env.js";
import type { TtsProviderResult } from "./types.js";

export async function synthesizeOpenAiSpeech(
  input: string,
): Promise<TtsProviderResult> {
  if (!env.openai.apiKey) {
    return createFallback(
      "OPENAI_API_KEY is not configured. Browser speech fallback should be used.",
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: env.tts.model,
        voice: env.tts.voice,
        input,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      return createFallback(
        `OpenAI TTS failed with ${response.status}: ${response.statusText}`,
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    if (audioBuffer.length === 0) {
      return createFallback("OpenAI TTS returned an empty audio response.");
    }

    return {
      success: true,
      provider: "openai",
      fallback: false,
      audioBuffer,
      contentType: response.headers.get("content-type") ?? "audio/mpeg",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown TTS error";
    return createFallback(message);
  }
}

function createFallback(message: string): TtsProviderResult {
  return {
    success: false,
    provider: "openai",
    fallback: true,
    message,
  };
}
