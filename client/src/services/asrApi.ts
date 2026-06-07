export interface AsrTranscribeResponse {
  transcript: string
  text?: string
  utterances?: string[]
  provider: 'mock' | 'volcano'
  fallback: boolean
  message: string
}

export async function transcribeCandidateAudio(
  audio: Blob | ArrayBuffer | File,
  signal?: AbortSignal,
): Promise<AsrTranscribeResponse> {
  const blob =
    audio instanceof Blob
      ? audio
      : new Blob([audio], { type: 'application/octet-stream' })

  const response = await fetch('/api/asr/transcribe?language=zh-CN', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
    signal,
  })

  if (!response.ok) {
    throw new Error(`ASR request failed with HTTP ${response.status}.`)
  }

  return response.json() as Promise<AsrTranscribeResponse>
}
