import {
  createNextResponse,
  createReportResponse,
  createStartResponse,
} from "../../../mocks/interviewMock.js";
import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  ReportInterviewResponse,
  StartInterviewResponse,
} from "../../../types/interview.js";
import type { LlmProvider } from "./types.js";

export const mockProvider: LlmProvider = {
  async generateOpeningAndFirstQuestion(role: InterviewRole): Promise<StartInterviewResponse> {
    return {
      ...createStartResponse(role),
      source: "mock",
      provider: "mock",
    };
  },

  async generateFollowUp(
    role: InterviewRole,
    answer: string,
    history: Message[],
  ): Promise<NextInterviewResponse> {
    return {
      ...createNextResponse(role, answer, history),
      source: "mock",
      provider: "mock",
    };
  },

  async generateFinalReport(
    role: InterviewRole,
    history: Message[],
  ): Promise<ReportInterviewResponse> {
    return {
      ...createReportResponse(role, history),
      source: "mock",
      provider: "mock",
    };
  },
};
