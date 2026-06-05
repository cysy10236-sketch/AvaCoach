import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  ReportInterviewResponse,
  StartInterviewResponse,
} from "../../../types/interview.js";

export interface LlmProvider {
  generateOpeningAndFirstQuestion(role: InterviewRole): Promise<StartInterviewResponse>;
  generateFollowUp(
    role: InterviewRole,
    answer: string,
    history: Message[],
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
