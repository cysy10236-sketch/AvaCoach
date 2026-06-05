import type { InterviewRole, QuestionDifficulty } from "./interview.js";

export interface InterviewQuestion {
  id: string;
  role: Extract<InterviewRole, "frontend" | "backend" | "ai" | "behavioral">;
  difficulty: QuestionDifficulty;
  topic: string;
  question: string;
  expectedPoints: string[];
  followUps: string[];
  tags: string[];
  source: "seed";
  sourceNote: string;
}

export interface QuestionFilters {
  role?: InterviewQuestion["role"];
  difficulty?: QuestionDifficulty;
  topic?: string;
}
