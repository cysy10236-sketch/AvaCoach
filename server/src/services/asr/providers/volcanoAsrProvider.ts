import { randomUUID } from "node:crypto";
import { env } from "../../../config/env.js";
import type { AsrTranscribeResponse } from "../../../types/asr.js";
import type { AsrProviderAdapter, AsrTranscriptionInput } from "./types.js";

interface VolcanoAsrEvent {
  code?: number | string;
  data?: unknown;
  message?: string;
  result?: unknown;
  statusCode?: number | string;
  status_code?: number | string;
  taskId?: string;
  task_id?: string;
  text?: string;
  utterances?: unknown;
}

interface VolcanoDebug {
  eventsSeen: string[];
  message?: string;
  statusCode?: number;
  taskId?: string;
  utterancesCount: number;
}

interface InternalUtterance {
  start_time?: number;
  end_time?: number;
  text: string;
}

type MinimalWebSocket = {
  close: () => void;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: (() => void) | null;
  send: (data: string | Buffer) => void;
};

type MinimalWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
) => MinimalWebSocket;

const SUCCESS_CODE = 20000000;
const QUEUED_OR_PROCESSING_CODES = new Set([20000001, 20000002]);

export const volcanoAsrProvider: AsrProviderAdapter = {
  async transcribe(input: AsrTranscriptionInput): Promise<AsrTranscribeResponse> {
    if (!env.volcanoAsr.enabled) {
      return createFallback(
        "Volcano ASR is disabled. Set VOLCANO_ASR_ENABLED=true to use the provider.",
      );
    }

    if (!env.volcanoAsr.endpoint || !env.volcanoAsr.apiKey) {
      return createFallback("Volcano ASR endpoint or credentials are not configured.");
    }

    if (!input.audio && !input.audioBase64 && !input.audioUrl) {
      return createFallback(
        "Volcano ASR requires audio bytes, audioBase64, or audioUrl. Browser ASR/manual typing remain available.",
      );
    }

    try {
      const result = env.volcanoAsr.endpoint.startsWith("ws")
        ? await transcribeWithWebSocket(input)
        : await transcribeWithHttpChunked(input);

      debugVolcanoAsr("transcribe result", result.debug);
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Volcano ASR request failed. Please use browser ASR or manual typing.";

      return createFallback(message);
    }
  },
};

async function transcribeWithHttpChunked(
  input: AsrTranscriptionInput,
): Promise<AsrTranscribeResponse> {
  const requestId = randomUUID();
  const body = createVolcanoRequestBody(input);
  const submitResponse = await callVolcanoHttp({
    body,
    endpoint: resolveHttpEndpoint("submit"),
    requestId,
    sequence: 1,
  });
  const submitEvents = submitResponse.events;
  const submitParsed = parseVolcanoEvents(submitEvents, {
    httpStatus: submitResponse.httpStatus,
    httpOk: submitResponse.httpOk,
    contentType: submitResponse.contentType,
    requestId,
  });

  if (!submitParsed.fallback && submitParsed.transcript) {
    return submitParsed;
  }

  const taskId =
    submitParsed.debug?.taskId ??
    collectTaskId(submitEvents) ??
    requestId;
  const submitStatus = Number(submitParsed.debug?.statusCode);

  if (
    submitParsed.fallback &&
    Number.isFinite(submitStatus) &&
    !QUEUED_OR_PROCESSING_CODES.has(submitStatus) &&
    submitStatus !== SUCCESS_CODE
  ) {
    return submitParsed;
  }

  return queryVolcanoResult({
    input,
    requestId,
    taskId,
  });
}

async function queryVolcanoResult({
  input,
  requestId,
  taskId,
}: {
  input: AsrTranscriptionInput;
  requestId: string;
  taskId: string;
}): Promise<AsrTranscribeResponse> {
  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await sleep(attempt === 1 ? 700 : 1200);

    const queryBody = {
      user: {
        uid: "avacoach",
        appid: env.volcanoAsr.appId || undefined,
        ...input.user,
      },
      request: {
        language: input.language || env.volcanoAsr.language || "zh-CN",
        task_id: taskId,
        taskId,
        ...input.request,
      },
    };
    const queryResponse = await callVolcanoHttp({
      body: queryBody,
      endpoint: resolveHttpEndpoint("query"),
      requestId,
      sequence: attempt + 1,
    });
    const parsed = parseVolcanoEvents(queryResponse.events, {
      httpStatus: queryResponse.httpStatus,
      httpOk: queryResponse.httpOk,
      contentType: queryResponse.contentType,
      requestId,
    });

    if (!parsed.fallback && parsed.transcript) {
      return parsed;
    }

    const statusCode = Number(parsed.debug?.statusCode);
    if (
      parsed.fallback &&
      Number.isFinite(statusCode) &&
      !QUEUED_OR_PROCESSING_CODES.has(statusCode) &&
      statusCode !== SUCCESS_CODE
    ) {
      return parsed;
    }
  }

    return createFallback("Volcano ASR query timed out before transcript was ready.", {
    eventsSeen: Array.from({ length: maxAttempts }, (_, index) => `query:${index + 1}:processing`),
    statusCode: 20000002,
    taskId,
    utterancesCount: 0,
  });
}

async function callVolcanoHttp({
  body,
  endpoint,
  requestId,
  sequence,
}: {
  body: unknown;
  endpoint: string;
  requestId: string;
  sequence: number;
}): Promise<{
  contentType: string;
  events: VolcanoAsrEvent[];
  httpOk: boolean;
  httpStatus: number;
}> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": env.volcanoAsr.apiKey,
      "X-Api-Resource-Id": env.volcanoAsr.resourceId,
      "X-Api-Request-Id": requestId,
      "X-Api-Sequence": String(sequence),
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const events = response.body
    ? await readChunkedJsonEvents(response.body)
    : await safeParseJsonEvents(await response.text());
  const headerEvent = createEventFromHeaders(response);
  const finalEvents = headerEvent ? [headerEvent, ...events] : events;

  return {
    contentType,
    events: finalEvents,
    httpOk: response.ok,
    httpStatus: response.status,
  };
}

async function transcribeWithWebSocket(
  input: AsrTranscriptionInput,
): Promise<AsrTranscribeResponse> {
  const WebSocketCtor = (globalThis as unknown as {
    WebSocket?: MinimalWebSocketConstructor;
  }).WebSocket;

  if (!WebSocketCtor) {
    return createFallback(
      "Volcano ASR WebSocket endpoint is configured, but this Node runtime does not expose global WebSocket.",
    );
  }

  const requestId = randomUUID();
  const body = createVolcanoRequestBody(input);
  const endpoint = addQueryParams(env.volcanoAsr.endpoint, {
    resource_id: env.volcanoAsr.resourceId,
    request_id: requestId,
  });
  const events: VolcanoAsrEvent[] = [];

  return new Promise((resolve) => {
    const socket = new WebSocketCtor(endpoint);
    const timeout = setTimeout(() => {
      socket.close();
      resolve(
        createFallback("Volcano ASR WebSocket timed out before completion.", {
          eventsSeen: summarizeEvents(events),
          taskId: collectTaskId(events),
          utterancesCount: 0,
        }),
      );
    }, 60000);

    socket.onopen = () => {
      // API key is sent inside the JSON envelope because browser-like Node
      // WebSocket constructors do not support custom headers.
      socket.send(
        JSON.stringify({
          headers: {
            "X-Api-Key": env.volcanoAsr.apiKey,
            "X-Api-Resource-Id": env.volcanoAsr.resourceId,
            "X-Api-Request-Id": requestId,
            "X-Api-Sequence": "1",
          },
          ...body,
        }),
      );
    };

    socket.onmessage = (event) => {
      const text =
        typeof event.data === "string"
          ? event.data
          : Buffer.isBuffer(event.data)
            ? event.data.toString("utf8")
            : String(event.data);
      events.push(...safeParseJsonEvents(text));

      if (events.some((item) => normalizeCode(item.code ?? item.statusCode) === SUCCESS_CODE)) {
        clearTimeout(timeout);
        socket.close();
        const parsed = parseVolcanoEvents(events, { requestId });
        debugVolcanoAsr("websocket final", parsed.debug);
        resolve(parsed);
      }
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      socket.close();
      resolve(
        createFallback("Volcano ASR WebSocket failed. Please use browser ASR or manual typing.", {
          eventsSeen: summarizeEvents(events),
          taskId: collectTaskId(events),
          utterancesCount: 0,
        }),
      );
    };

    socket.onclose = () => {
      clearTimeout(timeout);

      if (events.length === 0) {
        resolve(
          createFallback("Volcano ASR WebSocket closed without events.", {
            eventsSeen: [],
            utterancesCount: 0,
          }),
        );
        return;
      }

      const parsed = parseVolcanoEvents(events, { requestId });
      debugVolcanoAsr("websocket closed", parsed.debug);
      resolve(parsed);
    };
  });
}

function createVolcanoRequestBody(input: AsrTranscriptionInput) {
  const audioBase64 =
    input.audioBase64 ??
    (input.audio ? input.audio.toString("base64") : undefined);
  const request: Record<string, unknown> = {
    language: input.language || env.volcanoAsr.language || "zh-CN",
    enable_itn: true,
    enable_punc: true,
    audio_params: {
      channel: 1,
      channels: 1,
      sample_rate: 16000,
    },
    ...input.request,
  };

  if (input.callbackUrl) {
    request.callback_url = input.callbackUrl;
  }

  if (input.callbackData) {
    request.callback_data = input.callbackData;
  }

  return {
    user: {
      uid: "avacoach",
      appid: env.volcanoAsr.appId || undefined,
      ...input.user,
    },
    audio: {
      data: audioBase64,
      format: input.audioFormat ?? inferAudioFormat(input.contentType),
      codec: input.audioFormat ?? inferAudioFormat(input.contentType),
      rate: 16000,
      sample_rate: 16000,
      channels: 1,
      url: input.audioUrl,
    },
    request,
  };
}

function resolveHttpEndpoint(action: "submit" | "query"): string {
  const endpoint = env.volcanoAsr.endpoint.trim();

  if (endpoint.includes("{action}")) {
    return endpoint.replace("{action}", action);
  }

  if (/\/submit\/?$/.test(endpoint)) {
    return action === "submit"
      ? endpoint
      : endpoint.replace(/\/submit\/?$/, "/query");
  }

  if (/\/query\/?$/.test(endpoint)) {
    return action === "query"
      ? endpoint
      : endpoint.replace(/\/query\/?$/, "/submit");
  }

  return `${endpoint.replace(/\/$/, "")}/${action}`;
}

function createEventFromHeaders(response: Response): VolcanoAsrEvent | null {
  const statusCode =
    response.headers.get("x-api-status-code") ??
    undefined;
  const message =
    response.headers.get("x-api-message") ??
    response.headers.get("x-api-status-message") ??
    undefined;
  const taskId =
    response.headers.get("x-api-task-id") ??
    response.headers.get("x-api-request-id") ??
    undefined;

  if (!statusCode && !message && !taskId) {
    return null;
  }

  return {
    statusCode,
    message,
    taskId,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readChunkedJsonEvents(
  body: ReadableStream<Uint8Array>,
): Promise<VolcanoAsrEvent[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: VolcanoAsrEvent[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { parsed, rest } = parseJsonStreamBuffer(buffer);
    events.push(...parsed);
    buffer = rest;
  }

  buffer += decoder.decode();
  events.push(...safeParseJsonEvents(buffer));

  return events;
}

function parseJsonStreamBuffer(buffer: string): {
  parsed: VolcanoAsrEvent[];
  rest: string;
} {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";

  return {
    parsed: lines.flatMap((line) => safeParseJsonEvents(line)),
    rest,
  };
}

function safeParseJsonEvents(text: string): VolcanoAsrEvent[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  const normalized = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line))
    .filter((line) => line && line !== "[DONE]");

  const events: VolcanoAsrEvent[] = [];

  for (const line of normalized) {
    try {
      const parsed = JSON.parse(line) as VolcanoAsrEvent | VolcanoAsrEvent[];
      events.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      events.push(...parseAdjacentJsonObjects(line));
    }
  }

  return events;
}

function parseAdjacentJsonObjects(text: string): VolcanoAsrEvent[] {
  const events: VolcanoAsrEvent[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = text.slice(start, index + 1);
        try {
          events.push(JSON.parse(candidate) as VolcanoAsrEvent);
        } catch {
          // Ignore malformed fragments; fallback debug will show no events.
        }
        start = -1;
      }
    }
  }

  return events;
}

function parseVolcanoEvents(
  events: VolcanoAsrEvent[],
  context: {
    contentType?: string;
    httpOk?: boolean;
    httpStatus?: number;
    requestId?: string;
  },
): AsrTranscribeResponse {
  const utterances: InternalUtterance[] = [];
  const textParts: string[] = [];
  const codesSeen: Array<number | string> = [];
  let finished = false;
  let lastMessage = "";
  let lastStatusCode: number | string | undefined = context.httpStatus;
  let taskId: string | undefined;

  for (const event of events) {
    const code = normalizeCode(event.code ?? event.statusCode ?? event.status_code);
    if (code !== undefined) {
      codesSeen.push(code);
      lastStatusCode = code;
    }

    taskId =
      taskId ??
      event.taskId ??
      event.task_id ??
      readString(event.data, "taskId") ??
      readString(event.data, "task_id") ??
      readString(event.result, "taskId") ??
      readString(event.result, "task_id");
    lastMessage = event.message ?? lastMessage;

    const eventUtterances = extractUtterances(event);
    utterances.push(...eventUtterances);

    const text = extractText(event);
    if (text) {
      textParts.push(text);
    }

    if (code === SUCCESS_CODE) {
      finished = true;
      continue;
    }

    if (
      code !== undefined &&
      code !== 0 &&
      !QUEUED_OR_PROCESSING_CODES.has(Number(code))
    ) {
      const safeMessage = createErrorHint(code, event.message ?? "Volcano ASR returned an error.");
      return createFallback(safeMessage, {
        eventsSeen: summarizeEvents(events),
        message: event.message,
        statusCode: normalizeNumber(code),
        taskId,
        utterancesCount: utterances.length,
      });
    }
  }

  const combinedText = dedupeText([
    ...textParts,
    ...utterances.map((item) => item.text),
  ]);

  if (combinedText) {
    return {
      transcript: combinedText,
      text: combinedText,
      utterances: utterances.map((item) => item.text),
      provider: "volcano",
      fallback: false,
      message: finished ? "Volcano ASR completed." : "Volcano ASR returned transcript.",
      debug: {
        eventsSeen: summarizeEvents(events),
        message: lastMessage || undefined,
        statusCode: normalizeNumber(lastStatusCode),
        taskId,
        utterancesCount: utterances.length,
      },
    };
  }

  const onlyProcessing = codesSeen.some((code) =>
    QUEUED_OR_PROCESSING_CODES.has(Number(code)),
  );

  return createFallback(
    onlyProcessing
      ? "Volcano ASR task is queued or processing. Retry later or configure callbackUrl."
      : "Volcano ASR completed but returned no transcript.",
    {
      eventsSeen: summarizeEvents(events),
      message: lastMessage || undefined,
      statusCode: normalizeNumber(lastStatusCode),
      taskId,
      utterancesCount: utterances.length,
    },
  );
}

function extractText(event: VolcanoAsrEvent): string {
  const data = event.data;
  const candidates = [
    event.text,
    readString(data, "text"),
    readString(data, "result.text"),
    readString(event.result, "text"),
    readString(event.result, "result.text"),
  ];

  return candidates.find(Boolean)?.trim() ?? "";
}

function extractUtterances(event: VolcanoAsrEvent): InternalUtterance[] {
  const sources = [
    event.utterances,
    readUnknown(event.data, "utterances"),
    readUnknown(event.data, "result.utterances"),
    readUnknown(event.result, "utterances"),
    readUnknown(event.result, "result.utterances"),
  ];

  return sources.flatMap((source) => normalizeUtterances(source));
}

function normalizeUtterances(source: unknown): InternalUtterance[] {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item): InternalUtterance | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const text = String(record.text ?? record.result ?? "").trim();

      if (!text) {
        return null;
      }

      return {
        start_time: readOptionalNumber(record.start_time ?? record.startTime),
        end_time: readOptionalNumber(record.end_time ?? record.endTime),
        text,
      };
    })
    .filter((item): item is InternalUtterance => Boolean(item));
}

function createFallback(
  message: string,
  debug: Partial<VolcanoDebug> = {},
): AsrTranscribeResponse {
  const safeDebug: VolcanoDebug = {
    eventsSeen: debug.eventsSeen ?? [],
    message: debug.message,
    statusCode: normalizeNumber(debug.statusCode),
    taskId: debug.taskId,
    utterancesCount: debug.utterancesCount ?? 0,
  };

  debugVolcanoAsr("fallback", safeDebug);

  return {
    transcript: "",
    text: "",
    utterances: [],
    provider: "volcano",
    fallback: true,
    message,
    debug: safeDebug,
  };
}

function createErrorHint(code: number | string, message: string): string {
  const codeText = String(code);

  if (codeText.startsWith("450")) {
    return `Volcano ASR client error ${codeText}: ${message}`;
  }

  if (codeText.startsWith("550")) {
    return `Volcano ASR server/provider error ${codeText}: ${message}`;
  }

  return `Volcano ASR failed with code ${codeText}: ${message}`;
}

function inferAudioFormat(contentType?: string): string {
  if (!contentType) {
    return "webm";
  }

  if (contentType.includes("wav")) {
    return "wav";
  }

  if (contentType.includes("mpeg") || contentType.includes("mp3")) {
    return "mp3";
  }

  if (contentType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function readString(source: unknown, path: string): string {
  const value = readUnknown(source, path);
  return typeof value === "string" ? value : "";
}

function readUnknown(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function readOptionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeCode(value: unknown): number | string | undefined {
  if (typeof value === "number" || typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }

  return undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function summarizeEvents(events: VolcanoAsrEvent[]): string[] {
  return events.map((event, index) => {
    const code = normalizeCode(event.code ?? event.statusCode ?? event.status_code);
    const taskId =
      event.taskId ??
      event.task_id ??
      readString(event.data, "taskId") ??
      readString(event.data, "task_id") ??
      readString(event.result, "taskId") ??
      readString(event.result, "task_id");
    const message = event.message ? `:${event.message}` : "";
    const task = taskId ? `:task` : "";

    return `${index + 1}:${code ?? "no-code"}${task}${message}`;
  });
}

function dedupeText(parts: string[]): string {
  const normalized = parts.map((part) => part.trim()).filter(Boolean);

  if (normalized.length === 0) {
    return "";
  }

  const unique = normalized.filter(
    (item, index) => normalized.findIndex((candidate) => candidate === item) === index,
  );

  return unique.join("").trim();
}

function collectTaskId(events: VolcanoAsrEvent[]): string | undefined {
  for (const event of events) {
    const taskId =
      event.taskId ??
      event.task_id ??
      readString(event.data, "taskId") ??
      readString(event.data, "task_id") ??
      readString(event.result, "taskId") ??
      readString(event.result, "task_id");

    if (taskId) {
      return taskId;
    }
  }

  return undefined;
}

function addQueryParams(url: string, params: Record<string, string>): string {
  const parsed = new URL(url);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      parsed.searchParams.set(key, value);
    }
  });

  return parsed.toString();
}

function debugVolcanoAsr(message: string, debug?: Partial<VolcanoDebug>) {
  console.info("[AvaCoach ASR]", message, {
    taskId: debug?.taskId,
    statusCode: debug?.statusCode,
    message: debug?.message,
    eventsSeen: debug?.eventsSeen,
    utterancesCount: debug?.utterancesCount,
  });
}
