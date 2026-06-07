import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(configDirectory, "..", "..");
const envFilePath = path.join(serverRoot, ".env");
const envFilePathExists = fs.existsSync(envFilePath);
const envResult = dotenv.config({ path: envFilePath });

export type SpatiusRegion = "us-west" | "ap-northeast";
export type LlmProviderName = "openai" | "deepseek" | "mock";
export type TtsProviderName = "openai" | "volcano" | "mock";
export type AsrProviderName = "browser" | "volcano" | "volcano_stream" | "mock";
export type VolcanoTtsProviderMode = "volcano_bidirection" | "volcano";

const regionHosts: Record<SpatiusRegion, string> = {
  "us-west": "console.us-west.spatius.ai",
  "ap-northeast": "console.ap-northeast.spatius.ai",
};

function readNumber(name: string, defaultValue: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function readSpatiusRegion(): SpatiusRegion {
  const value = process.env.SPATIUS_REGION;

  if (value === "ap-northeast" || value === "us-west") {
    return value;
  }

  return "us-west";
}

function readLlmProvider(): LlmProviderName {
  const value = process.env.LLM_PROVIDER;

  if (value === "deepseek" || value === "mock" || value === "openai") {
    return value;
  }

  return "openai";
}

function readTtsProvider(): TtsProviderName {
  const value = process.env.TTS_PROVIDER;

  if (value === "volcano" || value === "mock" || value === "openai") {
    return value;
  }

  return "openai";
}

function readAsrProvider(): AsrProviderName {
  const value = process.env.ASR_PROVIDER;

  if (
    value === "browser" ||
    value === "volcano" ||
    value === "volcano_stream" ||
    value === "mock"
  ) {
    return value;
  }

  return "mock";
}

function readVolcanoTtsProviderMode(): VolcanoTtsProviderMode {
  const value = process.env.VOLCANO_TTS_PROVIDER;

  if (value === "volcano" || value === "volcano_bidirection") {
    return value;
  }

  return "volcano_bidirection";
}

function readBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }

  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  return defaultValue;
}

function sanitizeEnvSecret(value: string | undefined): string {
  const trimmed = (value ?? "").replace(/^\uFEFF/, "").trim();
  const withoutQuotes = trimmed.replace(/^(['"])(.*)\1$/, "$2");

  return withoutQuotes.trim();
}

const spatiusRegion = readSpatiusRegion();
const spatiusTokenExpireMinutes = Math.min(
  readNumber("SPATIUS_TOKEN_EXPIRE_MINUTES", 30),
  1439,
);

export const env = {
  runtime: {
    cwd: process.cwd(),
    envFilePath,
    envFilePathExists,
    envFileLoaded: !envResult.error,
  },
  port: readNumber("PORT", 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  llm: {
    provider: readLlmProvider(),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
    model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash",
  },
  tts: {
    provider: readTtsProvider(),
    model: process.env.TTS_MODEL?.trim() || "gpt-4o-mini-tts",
    voice: process.env.TTS_VOICE?.trim() || "alloy",
  },
  asr: {
    provider: readAsrProvider(),
  },
  volcanoAsr: {
    enabled: readBoolean("VOLCANO_ASR_ENABLED", false),
    streamDebug: readBoolean("ASR_STREAM_DEBUG", false),
    apiKey: sanitizeEnvSecret(process.env.VOLCANO_ASR_API_KEY),
    appId: sanitizeEnvSecret(process.env.VOLCANO_ASR_APP_ID),
    accessToken: sanitizeEnvSecret(process.env.VOLCANO_ASR_ACCESS_TOKEN),
    resourceId:
      sanitizeEnvSecret(process.env.VOLCANO_ASR_RESOURCE_ID) ||
      "volc.seedasr.sauc.duration",
    endpoint:
      process.env.VOLCANO_ASR_ENDPOINT?.trim() ||
      "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async",
    language: process.env.VOLCANO_ASR_LANGUAGE?.trim() || "zh-CN",
    audioFormat: process.env.VOLCANO_ASR_AUDIO_FORMAT?.trim() || "pcm",
    audioCodec: process.env.VOLCANO_ASR_AUDIO_CODEC?.trim() || "raw",
    sampleRate: readNumber("VOLCANO_ASR_SAMPLE_RATE", 16000),
    bits: readNumber("VOLCANO_ASR_BITS", 16),
    channel: readNumber("VOLCANO_ASR_CHANNEL", 1),
    modelName: process.env.VOLCANO_ASR_MODEL_NAME?.trim() || "bigmodel",
    enableItn: readBoolean("VOLCANO_ASR_ENABLE_ITN", true),
    enablePunc: readBoolean("VOLCANO_ASR_ENABLE_PUNC", true),
    enableDdc: readBoolean("VOLCANO_ASR_ENABLE_DDC", false),
    enableNonstream: readBoolean("VOLCANO_ASR_ENABLE_NONSTREAM", true),
    resultType: process.env.VOLCANO_ASR_RESULT_TYPE?.trim() || "single",
    endWindowSize: readNumber("VOLCANO_ASR_END_WINDOW_SIZE", 800),
  },
  volcanoTts: {
    enabled: readBoolean("VOLCANO_TTS_ENABLED", false),
    provider: readVolcanoTtsProviderMode(),
    resourceId: process.env.VOLCANO_TTS_RESOURCE_ID?.trim() || "seed-tts-2.0",
    voiceType:
      process.env.VOLCANO_TTS_VOICE_TYPE?.trim() ||
      "zh_female_vv_uranus_bigtts",
    speechRate: Number.isFinite(Number(process.env.VOLCANO_TTS_SPEECH_RATE))
      ? Number(process.env.VOLCANO_TTS_SPEECH_RATE)
      : 0,
    disableMarkdownFilter: readBoolean(
      "VOLCANO_TTS_DISABLE_MARKDOWN_FILTER",
      true,
    ),
    enableLanguageDetector: readBoolean(
      "VOLCANO_TTS_ENABLE_LANGUAGE_DETECTOR",
      false,
    ),
    apiKey: sanitizeEnvSecret(process.env.VOLCANO_TTS_API_KEY),
    format: process.env.VOLCANO_TTS_FORMAT?.trim() || "pcm",
    sampleRate: readNumber("VOLCANO_TTS_SAMPLE_RATE", 16000),
    accessKeyId: sanitizeEnvSecret(process.env.VOLCANO_ACCESS_KEY_ID),
    secretAccessKey: sanitizeEnvSecret(process.env.VOLCANO_SECRET_ACCESS_KEY),
    appId: sanitizeEnvSecret(process.env.VOLCANO_APP_ID),
    endpoint:
      process.env.VOLCANO_TTS_ENDPOINT?.trim() ||
      "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
  },
  spatius: {
    apiKey: sanitizeEnvSecret(process.env.SPATIUS_API_KEY),
    rawApiKey: process.env.SPATIUS_API_KEY ?? "",
    appId: sanitizeEnvSecret(process.env.SPATIUS_APP_ID),
    rawAppId: process.env.SPATIUS_APP_ID ?? "",
    region: spatiusRegion,
    consoleApiHost: regionHosts[spatiusRegion],
    tokenExpireMinutes: spatiusTokenExpireMinutes,
    includeAppIdInTokenRequest: readBoolean(
      "SPATIUS_INCLUDE_APP_ID_IN_TOKEN_REQUEST",
      false,
    ),
  },
};
