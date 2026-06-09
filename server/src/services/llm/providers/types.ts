import type {
  InterviewRole,
  LlmEvaluationContext,
  Message,
  NextInterviewResponse,
  ReportInterviewResponse,
  StartInterviewResponse,
} from "../../../types/interview.js";

export interface LlmProvider {
  generateOpeningAndFirstQuestion(
    role: InterviewRole,
    topic?: string,
  ): Promise<StartInterviewResponse>;
  generateFollowUp(
    role: InterviewRole,
    answer: string,
    history: Message[],
    context?: LlmEvaluationContext,
  ): Promise<NextInterviewResponse>;
  generateFinalReport(
    role: InterviewRole,
    history: Message[],
  ): Promise<ReportInterviewResponse>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
