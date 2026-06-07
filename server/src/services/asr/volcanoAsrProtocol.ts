import { gzipSync, gunzipSync } from "node:zlib";

export interface VolcanoAsrConfig {
  audioCodec: string;
  audioFormat: string;
  bits: number;
  channel: number;
  enableDdc: boolean;
  enableItn: boolean;
  enableNonstream: boolean;
  enablePunc: boolean;
  endWindowSize: number;
  language: string;
  modelName: string;
  resultType: string;
  sampleRate: number;
}

export interface VolcanoServerPayload {
  code?: number;
  isFinal?: boolean;
  logId?: string;
  message?: string;
  payload?: unknown;
  text?: string;
}

const VERSION = 0b0001;
const HEADER_SIZE_WORDS = 0b0001;
const SERIALIZATION_NONE = 0b0000;
const SERIALIZATION_JSON = 0b0001;
const COMPRESSION_NONE = 0b0000;
const COMPRESSION_GZIP = 0b0001;
const MESSAGE_FULL_CLIENT_REQUEST = 0b0001;
const MESSAGE_AUDIO_ONLY_REQUEST = 0b0010;
const MESSAGE_FULL_SERVER_RESPONSE = 0b1001;
const MESSAGE_ERROR_RESPONSE = 0b1111;
const FLAG_NONE = 0b0000;
const FLAG_FINAL = 0b0010;

export function createFullClientRequest(config: VolcanoAsrConfig): Buffer {
  const payload = gzipSync(
    Buffer.from(
      JSON.stringify({
        audio: {
          format: config.audioFormat,
          codec: config.audioCodec,
          rate: config.sampleRate,
          bits: config.bits,
          channel: config.channel,
          language: config.language,
        },
        request: {
          model_name: config.modelName,
          enable_itn: config.enableItn,
          enable_punc: config.enablePunc,
          enable_ddc: config.enableDdc,
          enable_nonstream: config.enableNonstream,
          result_type: config.resultType,
          end_window_size: config.endWindowSize,
        },
      }),
      "utf8",
    ),
  );

  return createPacket({
    compression: COMPRESSION_GZIP,
    flags: FLAG_NONE,
    messageType: MESSAGE_FULL_CLIENT_REQUEST,
    payload,
    serialization: SERIALIZATION_JSON,
  });
}

export function createAudioOnlyRequest(audio: Buffer, isFinal = false): Buffer {
  return createPacket({
    compression: COMPRESSION_GZIP,
    flags: isFinal ? FLAG_FINAL : FLAG_NONE,
    messageType: MESSAGE_AUDIO_ONLY_REQUEST,
    payload: gzipSync(audio),
    serialization: SERIALIZATION_NONE,
  });
}

const FLAG_STREAMING_CHUNK = 0b0001; // 服务端流式分片：携带 seq 字段

export interface VolcanoServerPacketMeta {
  compression: number;
  flags: number;
  hasSeq: boolean;
  headerSize: number;
  messageType: number;
  payloadSize: number;
  seq?: number;
  serialization: number;
  totalLen: number;
}

export function parseServerPacket(data: Buffer): {
  meta: VolcanoServerPacketMeta;
  payload: VolcanoServerPayload;
} {
  if (data.length < 8) {
    return {
      meta: {
        compression: 0,
        flags: 0,
        hasSeq: false,
        headerSize: 0,
        messageType: 0,
        payloadSize: 0,
        serialization: 0,
        totalLen: data.length,
      },
      payload: {
        code: -1,
        message: "Volcano ASR packet is too short.",
      },
    };
  }

  const headerSize = (data[0] & 0x0f) * 4;
  const messageType = data[1] >> 4;
  const flags = data[1] & 0x0f;
  const serialization = data[2] >> 4;
  const compression = data[2] & 0x0f;

  // bigmodel_async 流式响应在 flags & 0b0001 时使用扩展头：
  //   [4B header][4B seq][4B actual_size][payload]
  // 非流式响应（flags=0）使用标准头：
  //   [4B header][4B size][payload]
  const hasSeq = !!(flags & FLAG_STREAMING_CHUNK);
  const seqOffset = hasSeq ? 4 : 0;
  const sizeOffset = headerSize + seqOffset;
  const payloadSize = data.readInt32BE(sizeOffset);
  const payloadStart = sizeOffset + 4;
  const payloadEnd = Math.min(payloadStart + Math.abs(payloadSize), data.length);
  const rawPayload = data.subarray(payloadStart, payloadEnd);
  const decompressed =
    compression === COMPRESSION_GZIP ? gunzipSync(rawPayload) : rawPayload;
  const seq = hasSeq ? data.readInt32BE(headerSize) : undefined;

  const meta: VolcanoServerPacketMeta = {
    compression,
    flags,
    hasSeq,
    headerSize,
    messageType,
    payloadSize,
    seq,
    serialization,
    totalLen: data.length,
  };

  if (messageType === MESSAGE_ERROR_RESPONSE) {
    return {
      meta,
      payload: {
        code: payloadSize,
        message: decompressed.toString("utf8"),
      },
    };
  }

  if (messageType !== MESSAGE_FULL_SERVER_RESPONSE) {
    return {
      meta,
      payload: {
        code: messageType,
        message: `Unsupported Volcano ASR message type ${messageType}.`,
      },
    };
  }

  if (serialization !== SERIALIZATION_JSON) {
    return {
      meta,
      payload: {
        code: messageType,
        message: decompressed.toString("utf8"),
      },
    };
  }

  // 火山 bigmodel_async 在无识别结果时返回 0x00 空包，
  // 这并非合法 JSON，但语义上等同于空结果 final 响应。
  if (decompressed.length <= 1 && (flags & FLAG_FINAL)) {
    return {
      meta,
      payload: {
        code: 0,
        isFinal: true,
        payload: {},
        text: "",
      },
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(decompressed.toString("utf8")) as Record<string, unknown>;
  } catch {
    return {
      meta,
      payload: {
        code: -2,
        isFinal: !!(flags & FLAG_FINAL),
        message: `Volcano ASR returned non-JSON payload (${decompressed.length} bytes).`,
      },
    };
  }

  const text = extractText(parsed);

  return {
    meta,
    payload: {
      code: readNumber(parsed.code ?? parsed.statusCode ?? parsed.status_code),
      isFinal: !!(flags & FLAG_FINAL),
      message: readString(parsed.message),
      payload: parsed,
      text,
      logId: readString(parsed.logId ?? parsed.log_id),
    },
  };
}

function createPacket({
  compression,
  flags,
  messageType,
  payload,
  serialization,
}: {
  compression: number;
  flags: number;
  messageType: number;
  payload: Buffer;
  serialization: number;
}): Buffer {
  const header = Buffer.from([
    (VERSION << 4) | HEADER_SIZE_WORDS,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0,
  ]);
  const size = Buffer.alloc(4);
  size.writeInt32BE(payload.length, 0);

  return Buffer.concat([header, size, payload]);
}

function extractText(payload: Record<string, unknown>): string {
  const candidates = [
    payload.text,
    readPath(payload, "result.text"),
    readPath(payload, "payload.text"),
    readPath(payload, "data.text"),
    readPath(payload, "result.utterances.0.text"),
  ];

  return candidates
    .map(readString)
    .find((value) => value.length > 0) ?? "";
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    if (/^\d+$/.test(key) && Array.isArray(current)) {
      return current[Number(key)];
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}
