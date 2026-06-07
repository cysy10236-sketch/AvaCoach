import { getApiUrl } from './apiConfig'

export interface TtsFallbackResponse {
  source: 'browser-fallback'
  fallback: true
  text: string
  message: string
}

export type TtsApiResponse =
  | {
      source: 'tts'
      fallback: false
      audio: Blob
      contentType: string
    }
  | TtsFallbackResponse

export async function fetchTtsAudio(
  text: string,
  signal?: AbortSignal,
): Promise<TtsApiResponse> {
  const response = await fetch(getApiUrl('/api/tts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
    signal,
  })

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as TtsFallbackResponse
  }

  if (
    response.ok &&
    (
      contentType.startsWith('audio/') ||
      contentType.includes('audio/pcm') ||
      contentType.includes('application/octet-stream')
    )
  ) {
    return {
      source: 'tts',
      fallback: false,
      audio: await response.blob(),
      contentType,
    }
  }

  throw new Error(`TTS request failed: ${response.status}`)
}
