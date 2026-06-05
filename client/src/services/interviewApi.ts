import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  QuestionMeta,
  Report,
  StartInterviewOptions,
  StartInterviewResponse,
} from '../types/interview'

async function postJson<TResponse>(
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<TResponse>
}

export function startInterview(role: InterviewRole, options?: StartInterviewOptions) {
  return postJson<StartInterviewResponse>('/api/interview/start', {
    role,
    ...options,
  })
}

export function nextInterview(
  role: InterviewRole,
  answer: string,
  history: Message[],
  questionMeta?: QuestionMeta | null,
) {
  return postJson<NextInterviewResponse>('/api/interview/next', {
    role,
    answer,
    history,
    questionMeta,
  })
}

export function createInterviewReport(
  role: InterviewRole,
  history: Message[],
  questionMetas?: QuestionMeta[],
) {
  return postJson<Report>('/api/interview/report', {
    role,
    history,
    questionMetas,
  })
}
