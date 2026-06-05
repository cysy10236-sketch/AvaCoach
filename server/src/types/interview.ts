export type InterviewRole =
  | "frontend"
  | "backend"
  | "product"
  | "ai"
  | "behavioral";

export type QuestionSource = "llm" | "bank";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export type InterviewStage =
  | "idle"
  | "opening"
  | "asking"
  | "answering"
  | "evaluating"
  | "finished";

export type Speaker = "interviewer" | "candidate";
export type ResponseSource = "llm" | "mock" | "bank";
export type LlmProvider = "openai" | "deepseek" | "mock";

export interface Message {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: string;
}

export interface QuestionMeta {
  id: string;
  role: InterviewRole;
  difficulty: QuestionDifficulty;
  topic: string;
  expectedPoints: string[];
  followUps?: string[];
  tags: string[];
}

export interface KnowledgeFeedback {
  coveredPoints: string[];
  missingPoints: string[];
  improvementTips: string[];
}

export interface BankReportSummary {
  strongTopics: string[];
  weakTopics: string[];
  missedKnowledgePoints: string[];
  recommendedPracticeTopics: string[];
}

export interface LlmEvaluationContext {
  questionMeta?: QuestionMeta;
}

export interface StartInterviewRequest {
  role: InterviewRole;
  questionSource?: QuestionSource;
  difficulty?: QuestionDifficulty;
  topic?: string;
}

export interface StartInterviewResponse {
  replyText: string;
  question: string;
  stage: Extract<InterviewStage, "asking">;
  source?: ResponseSource;
  provider?: LlmProvider;
  questionMeta?: QuestionMeta;
}

export interface NextInterviewRequest {
  role: InterviewRole;
  answer: string;
  history: Message[];
  questionMeta?: QuestionMeta;
}

export interface NextInterviewResponse {
  replyText: string;
  score: number;
  feedback: string;
  suggestion: string;
  shouldEnd: boolean;
  source?: ResponseSource;
  provider?: LlmProvider;
  questionMeta?: QuestionMeta;
  knowledgeFeedback?: KnowledgeFeedback;
}

export interface ReportInterviewRequest {
  role: InterviewRole;
  history: Message[];
  questionMetas?: QuestionMeta[];
}

export interface ReportInterviewResponse {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  source?: ResponseSource;
  provider?: LlmProvider;
  bankReport?: BankReportSummary;
}
