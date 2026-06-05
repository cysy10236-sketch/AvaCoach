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
import type { ChatCompletionsResponse, LlmProvider } from "./types.js";

export const deepseekProvider: LlmProvider = {
  async generateOpeningAndFirstQuestion(role: InterviewRole): Promise<StartInterviewResponse> {
    const data = await requestJson<StartInterviewResponse>(buildStartPrompt(role));

    return {
      replyText: data.replyText,
      question: data.question,
      stage: "asking",
      source: "llm",
      provider: "deepseek",
    };
  },

  async generateFollowUp(
    role: InterviewRole,
    answer: string,
    history: Message[],
  ): Promise<NextInterviewResponse> {
    const data = await requestJson<NextInterviewResponse>(
      buildNextPrompt(role, answer, history),
    );

    return {
      replyText: data.replyText,
      score: clamp(Math.round(Number(data.score)), 1, 10),
      feedback: data.feedback,
      suggestion: data.suggestion,
      shouldEnd: Boolean(data.shouldEnd),
      source: "llm",
      provider: "deepseek",
    };
  },

  async generateFinalReport(
    role: InterviewRole,
    history: Message[],
  ): Promise<ReportInterviewResponse> {
    const data = await requestJson<ReportInterviewResponse>(buildReportPrompt(role, history));

    return {
      overallScore: clamp(Math.round(Number(data.overallScore)), 0, 100),
      strengths: asStringArray(data.strengths).slice(0, 5),
      weaknesses: asStringArray(data.weaknesses).slice(0, 5),
      suggestions: asStringArray(data.suggestions).slice(0, 5),
      source: "llm",
      provider: "deepseek",
    };
  },
};

async function requestJson<T>(prompt: string): Promise<T> {
  if (!env.deepseek.apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.deepseek.apiKey}`,
    },
    body: JSON.stringify({
      model: env.deepseek.model,
      messages: [
        {
          role: "system",
          content: "You return strict JSON only. Do not output markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_object",
      },
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek API failed with ${response.status}: ${detail || response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionsResponse;
  const rawText = payload.choices?.[0]?.message?.content?.trim();

  if (!rawText) {
    throw new Error("DeepSeek response did not include message content.");
  }

  return parseJsonObject<T>(rawText);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
