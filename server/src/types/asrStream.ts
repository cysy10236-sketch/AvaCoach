export type AsrStreamClientMessage =
  | {
      type: "audio";
      audio: Buffer;
    }
  | {
      type: "stop";
    };

export interface AsrStreamServerMessage {
  type: "ready" | "partial" | "final" | "error" | "fallback";
  text?: string;
  message?: string;
  debug?: {
    // 诊断字段（允许输出）
    audioBytes?: number;
    audioChunkCount?: number;
    connectId?: string;
    endpointHost?: string;
    fallbackReason?: string | null;
    finalReceived?: boolean;
    finalTranscriptLength?: number;
    firstFrontChunkBytes?: number;
    frontAudioBytesTotal?: number;
    frontAudioChunkCount?: number;
    lastFrontChunkBytes?: number;
    logId?: string;
    partialCount?: number;
    partialTranscriptLength?: number;
    receivedStop?: boolean;
    resourceId?: string;
    safeErrorCode?: number | string;
    safeErrorMessage?: string;
    sentFinalPacket?: boolean;
    volcanoAudioBytesTotal?: number;
    volcanoAudioChunkCount?: number;
    volcanoWsReady?: boolean;

    // 以下字段禁止输出
    // apiKey, headers, rawAudio, fullTranscript (>80 chars truncated), rawHex
  };
}
