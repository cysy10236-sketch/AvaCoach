export type TtsProviderName = "openai" | "volcano" | "mock";
export type TtsSource = "tts" | "browser-fallback";

export interface TtsRequest {
  text: string;
}

export interface TtsFallbackResponse {
  source: "browser-fallback";
  fallback: true;
  text: string;
  message: string;
  provider?: TtsProviderName;
}

export interface TtsAudioResponse {
  source: "tts";
  fallback: false;
  audio: Buffer;
  contentType: string;
}

export type TtsResponse = TtsAudioResponse | TtsFallbackResponse;
