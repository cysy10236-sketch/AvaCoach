import { env } from "../../../config/env.js";
import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  ReportInterviewResponse,
  StartInterviewResponse,
} from "../../../types/interview.js";
import { asStringArray, parseJsonObject } from "../jsonUtils.js";
import {
  buildNextPrompt,
  buildReportPrompt,
  buildStartPrompt,
} from "../prompts.js";
import type { LlmProvider } from "./types.js";

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

const startSchema = {
  type: "object",
  additionalProperties: false,
  required: ["replyText", "question", "stage"],
  properties: {
    replyText: { type: "string" },
    question: { type: "string" },
    stage: { type: "string", enum: ["asking"] },
  },
};

const nextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["replyText", "score", "feedback", "suggestion", "shouldEnd"],
  properties: {
    replyText: { type: "string" },
    score: { type: "number", minimum: 1, maximum: 10 },
    feedback: { type: "string" },
    suggestion: { type: "string" },
    shouldEnd: { type: "boolean" },
  },
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overallScore", "strengths", "weaknesses", "suggestions"],
  properties: {
    overallScore: { type: "number", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
};

export const openaiProvider: LlmProvider = {
  async generateOpeningAndFirstQuestion(role: InterviewRole): Promise<StartInterviewResponse> {
    const data = await requestJson<StartInterviewResponse>(
      buildStartPrompt(role),
      "avacoach_start_interview",
      startSchema,
    );

    return {
      replyText: data.replyText,
      question: data.question,
      stage: "asking",
      source: "llm",
      provider: "openai",
    };
  },

  async generateFollowUp(
    role: InterviewRole,
    answer: string,
    history: Message[],
  ): Promise<NextInterviewResponse> {
    const data = await requestJson<NextInterviewResponse>(
      buildNextPrompt(role, answer, history),
      "avacoach_next_question",
      nextSchema,
    );

    return {
      replyText: data.replyText,
      score: clamp(Math.round(Number(data.score)), 1, 10),
      feedback: data.feedback,
      suggestion: data.suggestion,
      shouldEnd: Boolean(data.shouldEnd),
      source: "llm",
      provider: "openai",
    };
  },

  async generateFinalReport(
    role: InterviewRole,
    history: Message[],
  ): Promise<ReportInterviewResponse> {
    const data = await requestJson<ReportInterviewResponse>(
      buildReportPrompt(role, history),
      "avacoach_final_report",
      reportSchema,
    );

    return {
      overallScore: clamp(Math.round(Number(data.overallScore)), 0, 100),
      strengths: asStringArray(data.strengths).slice(0, 5),
      weaknesses: asStringArray(data.weaknesses).slice(0, 5),
      suggestions: asStringArray(data.suggestions).slice(0, 5),
      source: "llm",
      provider: "openai",
    };
  },
};

async function requestJson<T>(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  if (!env.openai.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: env.openai.model,
      input: [{ role: "user", content: prompt }],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API failed with ${response.status}: ${detail || response.statusText}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const rawText = extractOutputText(payload);

  if (!rawText) {
    throw new Error("OpenAI response did not include output text.");
  }

  return parseJsonObject<T>(rawText);
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
