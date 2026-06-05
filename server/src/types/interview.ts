export type InterviewRole =
  | "frontend"
  | "product"
  | "ai"
  | "behavioral";

export type InterviewStage =
  | "idle"
  | "opening"
  | "asking"
  | "answering"
  | "evaluating"
  | "finished";

export type Speaker = "interviewer" | "candidate";
export type ResponseSource = "llm" | "mock";
export type LlmProvider = "openai" | "deepseek" | "mock";

export interface Message {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: string;
}

export interface StartInterviewRequest {
  role: InterviewRole;
}

export interface StartInterviewResponse {
  replyText: string;
  question: string;
  stage: Extract<InterviewStage, "asking">;
  source?: ResponseSource;
  provider?: LlmProvider;
}

export interface NextInterviewRequest {
  role: InterviewRole;
  answer: string;
  history: Message[];
}

export interface NextInterviewResponse {
  replyText: string;
  score: number;
  feedback: string;
  suggestion: string;
  shouldEnd: boolean;
  source?: ResponseSource;
  provider?: LlmProvider;
}

export interface ReportInterviewRequest {
  role: InterviewRole;
  history: Message[];
}

export interface ReportInterviewResponse {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  source?: ResponseSource;
  provider?: LlmProvider;
}
