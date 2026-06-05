import { randomUUID } from "node:crypto";
import { env } from "../../../config/env.js";
import type { TtsProviderResult } from "./types.js";

interface VolcanoTtsChunk {
  code?: number;
  message?: string;
  data?: string;
}

interface VolcanoTtsSafeDebug {
  [key: string]: unknown;
  provider: "volcano";
  httpStatus: number;
  contentType: string;
  eventsSeen: number;
  codesSeen: number[];
  audioChunkCount: number;
  totalAudioBytes: number;
  finished: boolean;
  lastSafeMessage?: string;
}

export async function synthesizeVolcanoSpeech(
  input: string,
): Promise<TtsProviderResult> {
  logSafeVolcanoConfig("volcano tts provider selected", {
    provider: env.volcanoTts.provider,
    endpointConfigured: Boolean(env.volcanoTts.endpoint),
    enabled: env.volcanoTts.enabled,
    voiceType: env.volcanoTts.voiceType,
    resourceId: env.volcanoTts.resourceId,
    format: env.volcanoTts.format,
    sampleRate: env.volcanoTts.sampleRate,
  });

  if (!env.volcanoTts.enabled) {
    return createFallback(
      "Volcano TTS provider is disabled. Set VOLCANO_TTS_ENABLED=true to enable V3 HTTP Chunked synthesis.",
    );
  }

  if (!env.volcanoTts.apiKey) {
    return createFallback("VOLCANO_TTS_API_KEY is not configured.");
  }

  try {
    const response = await fetch(env.volcanoTts.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": env.volcanoTts.apiKey,
        "X-Api-Resource-Id": env.volcanoTts.resourceId,
        "X-Api-Request-Id": randomUUID(),
      },
      body: JSON.stringify(createVolcanoRequestBody(input)),
    });

    if (!response.ok) {
      return createFallback(
        `Volcano TTS failed with HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const parsed = await parseVolcanoChunkedResponse(response);

    if (!parsed.ok) {
      logSafeVolcanoConfig("volcano tts fallback", parsed.debug);
      return createFallback(parsed.message, parsed.code);
    }

    if (parsed.audioBuffer.length === 0) {
      logSafeVolcanoConfig("volcano tts empty audio", parsed.debug);
      return createFallback("Volcano TTS finished but returned no audio chunks.");
    }

    logSafeVolcanoConfig("volcano tts success", parsed.debug);

    return {
      success: true,
      provider: "volcano",
      fallback: false,
      audioBuffer: parsed.audioBuffer,
      contentType: createVolcanoContentType(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Volcano TTS error";
    return createFallback(message);
  }
}

function createVolcanoRequestBody(text: string) {
  return {
    user: {
      uid: "avacoach",
    },
    req_params: {
      text,
      speaker: env.volcanoTts.voiceType,
      audio_params: {
        format: env.volcanoTts.format,
        sample_rate: env.volcanoTts.sampleRate,
        speech_rate: env.volcanoTts.speechRate,
      },
      additions: JSON.stringify({
        disable_markdown_filter: env.volcanoTts.disableMarkdownFilter,
        enable_language_detector: env.volcanoTts.enableLanguageDetector,
      }),
    },
  };
}

async function parseVolcanoChunkedResponse(
  response: Response,
): Promise<
  | {
      ok: true;
      audioBuffer: Buffer;
      debug: VolcanoTtsSafeDebug;
    }
  | {
      ok: false;
      code?: number;
      message: string;
      debug: VolcanoTtsSafeDebug;
    }
> {
  const chunks = await readChunkedJsonObjects(response);
  const audioBuffers: Buffer[] = [];
  const codesSeen: number[] = [];
  let finished = false;
  let lastError: { code?: number; message: string } | null = null;
  let lastSafeMessage: string | undefined;

  for (const chunk of chunks) {
    if (chunk.code !== undefined) {
      codesSeen.push(chunk.code);
    }

    if (chunk.message) {
      lastSafeMessage = chunk.message;
    }

    if (chunk.code === 0 && chunk.data) {
      audioBuffers.push(Buffer.from(chunk.data, "base64"));
      continue;
    }

    if (chunk.code === 20000000) {
      finished = true;
      continue;
    }

    if (chunk.code !== undefined && chunk.code !== 0 && chunk.code !== 20000000) {
      lastError = {
        code: chunk.code,
        message: chunk.message ?? `Volcano TTS returned code ${chunk.code}.`,
      };
    }
  }

  const audioBuffer = Buffer.concat(audioBuffers);
  const debug: VolcanoTtsSafeDebug = {
    provider: "volcano",
    httpStatus: response.status,
    contentType: response.headers.get("content-type") ?? "",
    eventsSeen: chunks.length,
    codesSeen: Array.from(new Set(codesSeen)),
    audioChunkCount: audioBuffers.length,
    totalAudioBytes: audioBuffer.length,
    finished,
    lastSafeMessage,
  };

  if (lastError) {
    return {
      ok: false,
      code: lastError.code,
      message: lastError.message,
      debug,
    };
  }

  if (audioBuffers.length === 0) {
    return {
      ok: false,
      message: "Volcano TTS finished but returned no audio chunks.",
      debug,
    };
  }

  return {
    ok: true,
    audioBuffer,
    debug,
  };
}

async function readChunkedJsonObjects(response: Response): Promise<VolcanoTtsChunk[]> {
  if (!response.body) {
    const text = await response.text();
    return parseJsonChunksFromText(text);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const chunks: VolcanoTtsChunk[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";

    for (const line of lines) {
      chunks.push(...parseJsonChunksFromText(line));
    }
  }

  pending += decoder.decode();
  chunks.push(...parseJsonChunksFromText(pending));

  return chunks;
}

function parseJsonChunksFromText(text: string): VolcanoTtsChunk[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^data:\s*/i, ""))
    .flatMap((line) => parseJsonObjectsFromText(line));
}

function parseJsonObjectsFromText(text: string): VolcanoTtsChunk[] {
  const parsedWhole = parseSingleJsonChunk(text);

  if (parsedWhole.length > 0) {
    return parsedWhole;
  }

  return extractJsonObjectStrings(text).flatMap((jsonText) =>
    parseSingleJsonChunk(jsonText),
  );
}

function parseSingleJsonChunk(line: string): VolcanoTtsChunk[] {
  try {
    const parsed = JSON.parse(line) as VolcanoTtsChunk | VolcanoTtsChunk[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function extractJsonObjectStrings(text: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function createVolcanoContentType(): string {
  if (env.volcanoTts.format === "pcm") {
    return `audio/pcm; rate=${env.volcanoTts.sampleRate}; channels=1; encoding=signed-integer; bits=16`;
  }

  return "application/octet-stream";
}

function createFallback(message: string, code?: number): TtsProviderResult {
  const safeMessage =
    code === undefined ? message : `Volcano TTS failed with code ${code}: ${message}`;

  return {
    success: false,
    provider: "volcano",
    fallback: true,
    message: safeMessage,
  };
}

function logSafeVolcanoConfig(message: string, details: Record<string, unknown>) {
  console.info("[AvaCoach TTS]", message, details);
}
