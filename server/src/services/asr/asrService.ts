import { env } from "../../config/env.js";
import type { AsrTranscribeResponse } from "../../types/asr.js";
import { mockAsrProvider } from "./providers/mockAsrProvider.js";
import type { AsrTranscriptionInput } from "./providers/types.js";
import { volcanoAsrProvider } from "./providers/volcanoAsrProvider.js";

export async function transcribeSpeech(
  input: Partial<AsrTranscriptionInput>,
): Promise<AsrTranscribeResponse> {
  const normalizedInput: AsrTranscriptionInput = {
    language: input.language?.trim() || env.volcanoAsr.language || "zh-CN",
    audio: input.audio,
    audioBase64: input.audioBase64,
    audioFormat: input.audioFormat,
    audioUrl: input.audioUrl,
    callbackData: input.callbackData,
    callbackUrl: input.callbackUrl,
    contentType: input.contentType,
    mockText: input.mockText,
    request: input.request,
    user: input.user,
  };

  if (env.asr.provider === "volcano" || env.volcanoAsr.enabled) {
    const result = await volcanoAsrProvider.transcribe(normalizedInput);

    if (!result.fallback) {
      return result;
    }

    return result;
  }

  return mockAsrProvider.transcribe(normalizedInput);
}
