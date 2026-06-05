import { env } from "../../config/env.js";
import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  ReportInterviewResponse,
  StartInterviewResponse,
} from "../../types/interview.js";
import { deepseekProvider } from "./providers/deepseekProvider.js";
import { mockProvider } from "./providers/mockProvider.js";
import { openaiProvider } from "./providers/openaiProvider.js";
import type { LlmProvider } from "./providers/types.js";

export async function generateOpeningAndFirstQuestion(
  role: InterviewRole,
): Promise<StartInterviewResponse> {
  return withFallback("start", (provider) =>
    provider.generateOpeningAndFirstQuestion(role),
  );
}

export async function generateFollowUp(
  role: InterviewRole,
  answer: string,
  history: Message[],
): Promise<NextInterviewResponse> {
  return withFallback("next", (provider) =>
    provider.generateFollowUp(role, answer, history),
  );
}

export async function generateFinalReport(
  role: InterviewRole,
  history: Message[],
): Promise<ReportInterviewResponse> {
  return withFallback("report", (provider) =>
    provider.generateFinalReport(role, history),
  );
}

async function withFallback<T>(
  operation: string,
  run: (provider: LlmProvider) => Promise<T>,
): Promise<T> {
  const providerName = env.llm.provider;

  if (providerName === "mock") {
    return run(mockProvider);
  }

  const provider = providerName === "deepseek" ? deepseekProvider : openaiProvider;

  try {
    return await run(provider);
  } catch (error) {
    logProviderFallback(providerName, operation, error);
    return run(mockProvider);
  }
}

function logProviderFallback(providerName: string, operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown provider error";
  console.warn(
    `[AvaCoach] LLM provider "${providerName}" failed during ${operation}; falling back to mock. ${message}`,
  );
}
