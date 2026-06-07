export type InterviewRole =
  | 'frontend'
  | 'backend'
  | 'product'
  | 'ai'
  | 'behavioral'

export type QuestionSource = 'llm' | 'bank'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export type InterviewStage =
  | 'idle'
  | 'opening'
  | 'asking'
  | 'answering'
  | 'evaluating'
  | 'finished'

export type AvatarStatus = 'idle' | 'speaking' | 'listening' | 'evaluating'
export type ResponseSource = 'llm' | 'mock' | 'bank'
export type LlmProvider = 'openai' | 'deepseek' | 'mock'
export type InterviewFlowStatus = 'in_progress' | 'ended'

export interface Message {
  id: string
  speaker: 'interviewer' | 'candidate'
  text: string
  timestamp: string
}

export interface Feedback {
  score: number
  feedback: string
  suggestion: string
  knowledgeFeedback?: KnowledgeFeedback
}

export interface QuestionMeta {
  id: string
  role: InterviewRole
  difficulty: QuestionDifficulty
  topic: string
  expectedPoints: string[]
  followUps?: string[]
  tags: string[]
}

export interface KnowledgeFeedback {
  coveredPoints: string[]
  missingPoints: string[]
  improvementTips: string[]
}

export interface BankReportSummary {
  strongTopics: string[]
  weakTopics: string[]
  missedKnowledgePoints: string[]
  recommendedPracticeTopics: string[]
}

export interface Report {
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  source?: ResponseSource
  provider?: LlmProvider
  bankReport?: BankReportSummary
  status?: InterviewFlowStatus
  nextAllowed?: boolean
  reportReady?: boolean
}

export interface StartInterviewResponse {
  replyText: string
  question: string
  stage: Extract<InterviewStage, 'asking'>
  source?: ResponseSource
  provider?: LlmProvider
  questionMeta?: QuestionMeta
  status?: InterviewFlowStatus
  nextAllowed?: boolean
  reportReady?: boolean
}

export interface NextInterviewResponse extends Feedback {
  replyText: string
  shouldEnd: boolean
  source?: ResponseSource
  provider?: LlmProvider
  questionMeta?: QuestionMeta
  knowledgeFeedback?: KnowledgeFeedback
  status?: InterviewFlowStatus
  nextAllowed?: boolean
  reportReady?: boolean
  message?: string
}

export interface StartInterviewOptions {
  questionSource: QuestionSource
  difficulty?: QuestionDifficulty
  topic?: string
}
