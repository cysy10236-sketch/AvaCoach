export type AsrProvider = "browser" | "mock" | "volcano";

export interface AsrTranscribeRequest {
  audio?: {
    base64?: string;
    data?: string;
    format?: string;
    url?: string;
  };
  audioBase64?: string;
  audioUrl?: string;
  callbackData?: string;
  callbackUrl?: string;
  language?: string;
  mockText?: string;
  request?: Record<string, unknown>;
  user?: Record<string, unknown>;
}

export interface AsrTranscribeResponse {
  debug?: {
    eventsSeen?: string[];
    message?: string;
    statusCode?: number;
    taskId?: string;
    utterancesCount?: number;
  };
  transcript: string;
  text?: string;
  utterances?: string[];
  provider: Exclude<AsrProvider, "browser">;
  fallback: boolean;
  message: string;
}
