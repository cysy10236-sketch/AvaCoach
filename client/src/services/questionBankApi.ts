import type {
  InterviewRole,
  QuestionDifficulty,
  QuestionMeta,
} from '../types/interview'
import { getApiUrl } from './apiConfig'

export interface QuestionBankQuestion extends QuestionMeta {
  question: string
  source: 'seed'
  sourceNote: string
}

export async function fetchQuestionBankTopics(role: InterviewRole): Promise<string[]> {
  const response = await fetch(getApiUrl(`/api/question-bank/topics?role=${encodeURIComponent(role)}`))

  if (!response.ok) {
    throw new Error(`Question bank topics request failed: ${response.status}`)
  }

  const data = (await response.json()) as { topics?: string[] }
  return Array.isArray(data.topics) ? data.topics : []
}

export async function pickQuestionBankQuestion({
  role,
  difficulty,
  topic,
}: {
  role: InterviewRole
  difficulty?: QuestionDifficulty
  topic?: string
}): Promise<QuestionBankQuestion> {
  const response = await fetch(getApiUrl('/api/question-bank/pick'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role,
      difficulty,
      topic,
    }),
  })

  if (!response.ok) {
    throw new Error(`Question bank pick request failed: ${response.status}`)
  }

  const data = (await response.json()) as { question: QuestionBankQuestion }
  return data.question
}
