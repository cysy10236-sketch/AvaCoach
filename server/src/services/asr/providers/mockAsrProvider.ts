import type { AsrTranscribeResponse } from "../../../types/asr.js";
import type { AsrProviderAdapter, AsrTranscriptionInput } from "./types.js";

export const mockAsrProvider: AsrProviderAdapter = {
  async transcribe(input: AsrTranscriptionInput): Promise<AsrTranscribeResponse> {
    if (input.mockText?.trim()) {
      return {
        transcript: input.mockText.trim(),
        provider: "mock",
        fallback: false,
        message: "Mock ASR transcript returned.",
      };
    }

    return {
      transcript: "",
      provider: "mock",
      fallback: true,
      message:
        "ASR provider is not configured. Please use browser speech recognition or manual typing.",
    };
  },
};
