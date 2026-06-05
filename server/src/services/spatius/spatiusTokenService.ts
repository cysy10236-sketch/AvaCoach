import { env } from "../../config/env.js";

export interface SpatiusTokenDebugInfo {
  status?: number;
  ok?: boolean;
  contentType?: string | null;
  cwd?: string;
  envFileLoaded?: boolean;
  envFilePathExists?: boolean;
  hasApiKey?: boolean;
  apiKeyLength?: number;
  apiKeyLooksLikeSkPrefix?: boolean;
  apiKeyHasWhitespace?: boolean;
  apiKeyHasQuotes?: boolean;
  hasAppId?: boolean;
  appIdLooksLikeAppPrefix?: boolean;
  endpointHost?: string;
  region?: string;
  attemptedAuthSchemes?: AuthScheme[];
  authSchemeUsed?: AuthScheme;
  topLevelKeys?: string[];
  nestedKeys?: {
    data?: string[];
    result?: string[];
  };
  tokenCandidates?: Record<string, TokenPreview>;
  requestShape?: SpatiusRequestShapeDebug;
  safeErrors?: SafeSpatiusError[];
  errorMessage?: string;
}

export interface TokenPreview {
  exists: boolean;
  length?: number;
  preview?: string;
}

export interface SpatiusRequestShapeDebug {
  hasAppId: boolean;
  hasExpireAt: boolean;
  expireAtType: "number" | "string" | "missing" | "unknown";
  expireAtUnitGuess: "seconds" | "milliseconds" | "unknown";
  hasModelVersion: boolean;
  modelVersionEmpty: boolean;
  endpointHost: string;
  region: string;
}

export interface SafeSpatiusError {
  code?: string;
  message?: string;
  field?: string;
  path?: string;
  reason?: string;
}

export interface SpatiusSessionTokenSuccess {
  sessionToken: string;
  expireAt: number | null;
  mode: "direct";
  fallback: false;
  debug?: SpatiusTokenDebugInfo;
}

export interface SpatiusSessionTokenFallback {
  sessionToken: null;
  expireAt: null;
  mode: "fallback";
  fallback: true;
  message: string;
  debug?: SpatiusTokenDebugInfo;
}

export type SpatiusSessionTokenResponse =
  | SpatiusSessionTokenSuccess
  | SpatiusSessionTokenFallback;

type JsonRecord = Record<string, unknown>;
type AuthScheme = "x-api-key" | "bearer";

interface TokenRequestAttemptResult {
  response: Response;
  parsedBody: unknown;
  contentType: string | null;
  debug: SpatiusTokenDebugInfo;
  authScheme: AuthScheme;
}

export async function createSpatiusSessionToken(): Promise<SpatiusSessionTokenResponse> {
  if (!env.spatius.apiKey) {
    return {
      sessionToken: null,
      expireAt: null,
      mode: "fallback",
      fallback: true,
      message:
        "SPATIUS_API_KEY is not configured. AvaCoach is running in fallback demo mode.",
      debug: {
        ...createBaseDebugInfo(),
        hasApiKey: false,
        apiKeyLength: 0,
      },
    };
  }

  const requestedExpireAt =
    Math.floor(Date.now() / 1000) + env.spatius.tokenExpireMinutes * 60;
  const endpoint = `https://${env.spatius.consoleApiHost}/v1/console/session-tokens`;
  const requestBody = {
    ...(env.spatius.includeAppIdInTokenRequest && env.spatius.appId
      ? { appId: env.spatius.appId }
      : {}),
    expireAt: requestedExpireAt,
  };
  const requestShape = createRequestShapeDebug(requestBody);
  const attemptedAuthSchemes: AuthScheme[] = ["x-api-key", "bearer"];

  try {
    let lastAttempt: TokenRequestAttemptResult | null = null;

    for (const authScheme of attemptedAuthSchemes) {
      const attempt = await requestSessionToken({
        authScheme,
        endpoint,
        requestBody,
        requestShape,
        attemptedAuthSchemes,
      });
      lastAttempt = attempt;

      const token = extractToken(attempt.parsedBody);

      if (attempt.response.ok && token) {
        const expireAt = extractExpireAt(attempt.parsedBody) ?? requestedExpireAt;

        return {
          sessionToken: token,
          expireAt,
          mode: "direct",
          fallback: false,
          debug: {
            ...attempt.debug,
            authSchemeUsed: authScheme,
          },
        };
      }

      if (!shouldTryNextAuthScheme(attempt.parsedBody, authScheme)) {
        break;
      }
    }

    return {
      sessionToken: null,
      expireAt: null,
      mode: "fallback",
      fallback: true,
      message: createFallbackMessage(
        lastAttempt?.parsedBody ?? {},
        lastAttempt?.response.ok
          ? "Spatius Console API response did not include a recognized session token field."
          : `Spatius Console API failed with ${lastAttempt?.response.status ?? "unknown status"}.`,
      ),
      debug: lastAttempt
        ? {
            ...lastAttempt.debug,
            errorMessage: extractSafeErrorMessage(
              lastAttempt.parsedBody,
              lastAttempt.response.statusText,
            ),
          }
        : {
            ...createBaseDebugInfo(),
            requestShape,
            attemptedAuthSchemes,
            errorMessage: "No Spatius Console API attempt was made.",
          },
    };
  } catch (error) {
    return {
      sessionToken: null,
      expireAt: null,
      mode: "fallback",
      fallback: true,
      message: "Failed to request Spatius session token.",
      debug: {
        ...createBaseDebugInfo(),
        requestShape,
        attemptedAuthSchemes,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

async function requestSessionToken({
  authScheme,
  endpoint,
  requestBody,
  requestShape,
  attemptedAuthSchemes,
}: {
  authScheme: AuthScheme;
  endpoint: string;
  requestBody: JsonRecord;
  requestShape: SpatiusRequestShapeDebug;
  attemptedAuthSchemes: AuthScheme[];
}): Promise<TokenRequestAttemptResult> {
  // The Console API key must stay on the backend. The browser only receives a
  // short-lived session token that the Avatar SDK can use in Direct/SDK mode.
  const response = await fetch(endpoint, {
    method: "POST",
    headers: createAuthHeaders(authScheme),
    body: JSON.stringify(requestBody),
  });

  const contentType = response.headers.get("content-type");
  const rawBody = await response.text();
  const parsedBody = parseMaybeJson(rawBody);
  const debug = createDebugInfo(
    response,
    contentType,
    parsedBody,
    requestShape,
    attemptedAuthSchemes,
  );

  return {
    response,
    parsedBody,
    contentType,
    debug,
    authScheme,
  };
}

function createAuthHeaders(authScheme: AuthScheme): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authScheme === "bearer") {
    headers.Authorization = `Bearer ${env.spatius.apiKey}`;
  } else {
    headers["X-Api-Key"] = env.spatius.apiKey;
  }

  return headers;
}

function parseMaybeJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return {};
  }
}

function createDebugInfo(
  response: Response,
  contentType: string | null,
  parsedBody: unknown,
  requestShape: SpatiusRequestShapeDebug,
  attemptedAuthSchemes: AuthScheme[],
): SpatiusTokenDebugInfo {
  const body = asRecord(parsedBody);
  const data = asRecord(body.data);
  const result = asRecord(body.result);
  const safeErrors = extractSafeErrors(parsedBody);

  return {
    ...createBaseDebugInfo(),
    status: response.status,
    ok: response.ok,
    contentType,
    attemptedAuthSchemes,
    topLevelKeys: Object.keys(body),
    nestedKeys: {
      data: Object.keys(data),
      result: Object.keys(result),
    },
    requestShape,
    safeErrors,
    tokenCandidates: {
      sessionToken: previewToken(body.sessionToken),
      sessionKey: previewToken(body.sessionKey),
      session_token: previewToken(body.session_token),
      token: previewToken(body.token),
      accessToken: previewToken(body.accessToken),
      "data.sessionToken": previewToken(data.sessionToken),
      "data.sessionKey": previewToken(data.sessionKey),
      "data.session_token": previewToken(data.session_token),
      "data.token": previewToken(data.token),
      "result.sessionToken": previewToken(result.sessionToken),
      "result.sessionKey": previewToken(result.sessionKey),
      "result.token": previewToken(result.token),
    },
  };
}

function createBaseDebugInfo(): SpatiusTokenDebugInfo {
  return {
    cwd: env.runtime.cwd,
    envFileLoaded: env.runtime.envFileLoaded,
    envFilePathExists: env.runtime.envFilePathExists,
    hasApiKey: env.spatius.apiKey.length > 0,
    apiKeyLength: env.spatius.apiKey.length,
    apiKeyLooksLikeSkPrefix: env.spatius.apiKey.startsWith("sk-"),
    apiKeyHasWhitespace: hasWhitespace(env.spatius.rawApiKey),
    apiKeyHasQuotes: hasWrappingQuotes(env.spatius.rawApiKey),
    hasAppId: env.spatius.appId.length > 0,
    appIdLooksLikeAppPrefix: env.spatius.appId.toLowerCase().startsWith("app"),
    endpointHost: env.spatius.consoleApiHost,
    region: env.spatius.region,
  };
}

function createRequestShapeDebug(requestBody: JsonRecord): SpatiusRequestShapeDebug {
  return {
    hasAppId: typeof requestBody.appId === "string" && requestBody.appId.length > 0,
    hasExpireAt: requestBody.expireAt !== undefined,
    expireAtType:
      typeof requestBody.expireAt === "number"
        ? "number"
        : typeof requestBody.expireAt === "string"
          ? "string"
          : requestBody.expireAt === undefined
            ? "missing"
            : "unknown",
    expireAtUnitGuess: guessExpireAtUnit(requestBody.expireAt),
    hasModelVersion: requestBody.modelVersion !== undefined,
    modelVersionEmpty: requestBody.modelVersion === "",
    endpointHost: env.spatius.consoleApiHost,
    region: env.spatius.region,
  };
}

function guessExpireAtUnit(value: unknown): "seconds" | "milliseconds" | "unknown" {
  const numericValue = readNumber(value);

  if (!numericValue) {
    return "unknown";
  }

  if (numericValue > 1_000_000_000_000) {
    return "milliseconds";
  }

  if (numericValue > 1_000_000_000) {
    return "seconds";
  }

  return "unknown";
}

function extractToken(parsedBody: unknown): string | null {
  const body = asRecord(parsedBody);
  const data = asRecord(body.data);
  const result = asRecord(body.result);

  return (
    readString(body.sessionToken) ??
    readString(body.sessionKey) ??
    readString(body.session_token) ??
    readString(body.token) ??
    readString(body.accessToken) ??
    readString(data.sessionToken) ??
    readString(data.sessionKey) ??
    readString(data.session_token) ??
    readString(data.token) ??
    readString(result.sessionToken) ??
    readString(result.sessionKey) ??
    readString(result.token) ??
    null
  );
}

function extractExpireAt(parsedBody: unknown): number | null {
  const body = asRecord(parsedBody);
  const data = asRecord(body.data);
  const result = asRecord(body.result);

  return (
    readNumber(body.expireAt) ??
    readNumber(body.expiresAt) ??
    readNumber(body.expire_at) ??
    readNumber(data.expireAt) ??
    readNumber(data.expiresAt) ??
    readNumber(data.expire_at) ??
    readNumber(result.expireAt) ??
    readNumber(result.expiresAt) ??
    readNumber(result.expire_at) ??
    null
  );
}

function extractSafeErrors(parsedBody: unknown): SafeSpatiusError[] {
  const body = asRecord(parsedBody);
  const data = asRecord(body.data);
  const result = asRecord(body.result);

  return [
    ...normalizeSafeErrors(body.errors),
    ...normalizeSafeErrors(data.errors),
    ...normalizeSafeErrors(result.errors),
    ...normalizeSafeErrors(body.error),
    ...normalizeSafeErrors(data.error),
    ...normalizeSafeErrors(result.error),
  ];
}

function normalizeSafeErrors(value: unknown): SafeSpatiusError[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeSafeErrors(item));
  }

  if (typeof value === "string") {
    return [
      {
        message: value,
      },
    ];
  }

  const record = asRecord(value);

  if (Object.keys(record).length === 0) {
    return [];
  }

  const safeError: SafeSpatiusError = {};
  const code = readString(record.code);
  const message = readString(record.message);
  const field = readString(record.field);
  const path = readString(record.path);
  const reason = readString(record.reason);

  if (code) safeError.code = code;
  if (message) safeError.message = message;
  if (field) safeError.field = field;
  if (path) safeError.path = path;
  if (reason) safeError.reason = reason;

  const details = [
    ...normalizeSafeErrors(record.details),
    ...normalizeSafeErrors(record.detail),
  ];

  return Object.keys(safeError).length > 0 ? [safeError, ...details] : details;
}

function createFallbackMessage(parsedBody: unknown, baseMessage: string): string {
  const hint = inferErrorHint(extractSafeErrors(parsedBody));

  return hint ? `${baseMessage} ${hint}` : baseMessage;
}

function inferErrorHint(errors: SafeSpatiusError[]): string | null {
  const joined = errors
    .map((error) =>
      [error.code, error.message, error.field, error.path, error.reason]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .toLowerCase();

  if (!joined) {
    return null;
  }

  if (joined.includes("appid") || joined.includes("app id") || joined.includes("app_id")) {
    return "Check SPATIUS_APP_ID or request body appId.";
  }

  if (joined.includes("expireat") || joined.includes("expires") || joined.includes("expire_at")) {
    return "Check expireAt format. It may need Unix seconds, milliseconds, or ISO string.";
  }

  if (
    joined.includes("api key") ||
    joined.includes("apikey") ||
    joined.includes("unauthorized") ||
    joined.includes("auth") ||
    joined.includes("forbidden")
  ) {
    return "Check SPATIUS_API_KEY.";
  }

  if (joined.includes("region") || joined.includes("host")) {
    return "Check SPATIUS_REGION and console API host.";
  }

  if (joined.includes("modelversion") || joined.includes("model version")) {
    return "Check whether modelVersion is required or should be removed.";
  }

  return null;
}

function shouldTryNextAuthScheme(parsedBody: unknown, authScheme: AuthScheme): boolean {
  if (authScheme !== "x-api-key") {
    return false;
  }

  const joined = extractSafeErrors(parsedBody)
    .map((error) =>
      [error.code, error.message, error.field, error.path, error.reason]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .toLowerCase();

  return (
    joined.includes("api key") ||
    joined.includes("apikey") ||
    joined.includes("unauthorized") ||
    joined.includes("auth") ||
    joined.includes("forbidden") ||
    joined.includes("invalid")
  );
}

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function hasWrappingQuotes(value: string): boolean {
  const trimmed = value.trim();

  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  );
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function previewToken(value: unknown): TokenPreview {
  const token = readString(value);

  if (!token) {
    return {
      exists: false,
    };
  }

  return {
    exists: true,
    length: token.length,
    preview:
      token.length > 10
        ? `${token.slice(0, 6)}...${token.slice(-4)}`
        : "[short-token-redacted]",
  };
}

function extractSafeErrorMessage(parsedBody: unknown, fallback: string): string {
  const body = asRecord(parsedBody);
  const data = asRecord(body.data);
  const result = asRecord(body.result);

  return (
    readString(body.message) ??
    readString(body.error) ??
    readString(data.message) ??
    readString(data.error) ??
    readString(result.message) ??
    readString(result.error) ??
    fallback
  );
}
