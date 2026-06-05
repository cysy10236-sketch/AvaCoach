import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  Report,
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

export function startInterview(role: InterviewRole) {
  return postJson<StartInterviewResponse>('/api/interview/start', { role })
}

export function nextInterview(
  role: InterviewRole,
  answer: string,
  history: Message[],
) {
  return postJson<NextInterviewResponse>('/api/interview/next', {
    role,
    answer,
    history,
  })
}

export function createInterviewReport(role: InterviewRole, history: Message[]) {
  return postJson<Report>('/api/interview/report', {
    role,
    history,
  })
}
