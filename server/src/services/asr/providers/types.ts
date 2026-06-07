import type { AsrTranscribeResponse } from "../../../types/asr.js";

export interface AsrTranscriptionInput {
  audio?: Buffer;
  audioBase64?: string;
  audioFormat?: string;
  audioUrl?: string;
  callbackData?: string;
  callbackUrl?: string;
  contentType?: string;
  language: string;
  mockText?: string;
  request?: Record<string, unknown>;
  user?: Record<string, unknown>;
}

export interface AsrProviderAdapter {
  transcribe(input: AsrTranscriptionInput): Promise<AsrTranscribeResponse>;
}
