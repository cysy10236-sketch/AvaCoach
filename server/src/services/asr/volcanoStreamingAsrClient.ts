import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { env } from "../../config/env.js";
import {
  createAudioOnlyRequest,
  createFullClientRequest,
  parseServerPacket,
} from "./volcanoAsrProtocol.js";

interface StreamingClientCallbacks {
  onDebug?: (debug: Record<string, unknown>) => void;
  onError: (message: string, debug?: Record<string, unknown>) => void;
  onFinal: (text: string, debug?: Record<string, unknown>) => void;
  onOpen: (debug?: Record<string, unknown>) => void;
  onPartial: (text: string, debug?: Record<string, unknown>) => void;
  onVolcanoAudioSent?: (chunkCount: number, bytesTotal: number) => void;
}

export class VolcanoStreamingAsrClient {
  private audioBytes = 0;
  private audioChunkCount = 0;
  private finalReceived = false;
  private finalText = "";
  private socket: WebSocket | null = null;

  private readonly callbacks: StreamingClientCallbacks;
  private readonly requestId = randomUUID();

  constructor(callbacks: StreamingClientCallbacks) {
    this.callbacks = callbacks;
  }

  connect() {
    if (!env.volcanoAsr.enabled || !env.volcanoAsr.apiKey) {
      this.callbacks.onError("火山流式 ASR 未配置，已切换到浏览器识别或手动输入。", {
        safeErrorCode: "not_configured",
      });
      return;
    }

    const endpoint = env.volcanoAsr.endpoint;
    const endpointHost = safeHost(endpoint);
    const socket = new WebSocket(endpoint, {
      headers: {
        "X-Api-Key": env.volcanoAsr.apiKey,
        "X-Api-Resource-Id": env.volcanoAsr.resourceId,
        "X-Api-Request-Id": this.requestId,
        "X-Api-Sequence": "-1",
      },
    });
    this.socket = socket;

    socket.binaryType = "nodebuffer";
    socket.on("open", () => {
      socket.send(
        createFullClientRequest({
          audioCodec: env.volcanoAsr.audioCodec,
          audioFormat: env.volcanoAsr.audioFormat,
          bits: env.volcanoAsr.bits,
          channel: env.volcanoAsr.channel,
          enableDdc: env.volcanoAsr.enableDdc,
          enableItn: env.volcanoAsr.enableItn,
          enableNonstream: env.volcanoAsr.enableNonstream,
          enablePunc: env.volcanoAsr.enablePunc,
          endWindowSize: env.volcanoAsr.endWindowSize,
          language: env.volcanoAsr.language,
          modelName: env.volcanoAsr.modelName,
          resultType: env.volcanoAsr.resultType,
          sampleRate: env.volcanoAsr.sampleRate,
        }),
      );
      this.callbacks.onOpen({
        connectId: this.requestId,
        endpointHost,
        resourceId: env.volcanoAsr.resourceId,
      });
    });

    socket.on("message", (data) => {
      try {
        const { meta, payload } = parseServerPacket(Buffer.from(data as Buffer));

        if (env.volcanoAsr.streamDebug) {
          console.log(
            `[ASR] totalLen=${meta.totalLen} msgType=0b${meta.messageType.toString(2).padStart(4, "0")} ` +
              `flags=0b${meta.flags.toString(2).padStart(4, "0")} hasSeq=${meta.hasSeq} ` +
              `${meta.hasSeq ? `seq=${meta.seq} ` : ""}` +
              `payloadSize=${meta.payloadSize} decompressedLen=${payload.text?.length ?? 0}`,
          );
        }

        if (payload.code && payload.code >= 400) {
          this.callbacks.onError(payload.message || "火山流式 ASR 返回错误。", {
            logId: payload.logId,
            safeErrorCode: payload.code,
            safeErrorMessage: payload.message,
          });
          return;
        }

        if (payload.text) {
          this.finalText = payload.text;
          this.callbacks.onPartial(payload.text, {
            logId: payload.logId,
            partialTranscriptLength: payload.text.length,
          });
        }

        // 火山 bigmodel_async 在最终结果包中设置 FLAG_FINAL，
        // 无论 text 是否为空都应触发 onFinal（空结果也是合法最终状态）。
        if (payload.isFinal && !this.finalReceived) {
          this.finalReceived = true;
          this.callbacks.onFinal(this.finalText, {
            audioBytes: this.audioBytes,
            audioChunkCount: this.audioChunkCount,
            connectId: this.requestId,
            endpointHost,
            finalTranscriptLength: this.finalText.length,
            logId: payload.logId,
          });
        }
      } catch (error) {
        this.callbacks.onError("火山流式 ASR 协议解析失败。", {
          safeErrorCode: "parse_error",
          safeErrorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("error", (error) => {
      this.callbacks.onError("火山流式 ASR 连接失败，请检查 Resource ID 和 API Key。", {
        endpointHost,
        safeErrorCode: "socket_error",
        safeErrorMessage: error.message,
      });
    });

    socket.on("close", () => {
      // 兜底：如果火山服务器关闭了连接但还没收到 final 包，
      // 且至少收到过一些文本，则视为最终结果。
      if (!this.finalReceived && this.finalText) {
        this.finalReceived = true;
        this.callbacks.onFinal(this.finalText, {
          audioBytes: this.audioBytes,
          audioChunkCount: this.audioChunkCount,
          connectId: this.requestId,
          endpointHost,
          finalTranscriptLength: this.finalText.length,
        });
      }
    });
  }

  sendAudio(audio: Buffer) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.audioChunkCount += 1;
    this.audioBytes += audio.byteLength;
    this.socket.send(createAudioOnlyRequest(audio));
    this.callbacks.onVolcanoAudioSent?.(this.audioChunkCount, this.audioBytes);
  }

  finish() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.close();
      return;
    }

    this.socket.send(createAudioOnlyRequest(Buffer.alloc(0), true));
    windowlessSetTimeout(() => this.close(), 1200);
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "unknown";
  }
}

function windowlessSetTimeout(callback: () => void, ms: number) {
  setTimeout(callback, ms);
}
