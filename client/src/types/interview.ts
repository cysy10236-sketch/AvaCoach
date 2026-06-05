export type InterviewRole =
  | 'frontend'
  | 'product'
  | 'ai'
  | 'behavioral'

export type InterviewStage =
  | 'idle'
  | 'opening'
  | 'asking'
  | 'answering'
  | 'evaluating'
  | 'finished'

export type AvatarStatus = 'idle' | 'speaking' | 'listening' | 'evaluating'
export type ResponseSource = 'llm' | 'mock'
export type LlmProvider = 'openai' | 'deepseek' | 'mock'

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
}

export interface Report {
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  source?: ResponseSource
  provider?: LlmProvider
}

export interface StartInterviewResponse {
  replyText: string
  question: string
  stage: Extract<InterviewStage, 'asking'>
  source?: ResponseSource
  provider?: LlmProvider
}

export interface NextInterviewResponse extends Feedback {
  replyText: string
  shouldEnd: boolean
  source?: ResponseSource
  provider?: LlmProvider
}
