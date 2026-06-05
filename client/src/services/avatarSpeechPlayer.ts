import { convertTtsAudioToAvatarPcm } from './audioToPcm'
import { fetchTtsAudio } from './ttsApi'
import {
  speakWithBrowserSpeech,
  type VoiceMode,
} from './speechPlayer'
import type { AvatarSpeechSender } from '../types/spatius'

interface SpeakWithAvatarOptions {
  signal?: AbortSignal
  avatarSpeechSender: AvatarSpeechSender | null
  onEvaluating?: () => void
  onStart?: (mode: VoiceMode) => void
  onEnd?: (mode: VoiceMode) => void
  onNotice?: (message: string | null) => void
}

export async function speakTextWithAvatar(
  text: string,
  {
    signal,
    avatarSpeechSender,
    onEvaluating,
    onStart,
    onEnd,
    onNotice,
  }: SpeakWithAvatarOptions,
): Promise<VoiceMode> {
  onEvaluating?.()

  if (!avatarSpeechSender) {
    onNotice?.('AvatarKit is not connected. Browser speech does not drive avatar lip-sync.')
    return speakBrowser(text, { onStart, onEnd })
  }

  try {
    const ttsResponse = await fetchTtsAudio(text, signal)

    if (signal?.aborted) {
      return 'silent'
    }

    if (ttsResponse.fallback) {
      onNotice?.('TTS audio is unavailable. Browser speech does not drive avatar lip-sync.')
      return speakBrowser(text, { onStart, onEnd })
    }

    onStart?.('avatar-tts')
    onNotice?.(null)
    const ttsArrayBuffer = await ttsResponse.audio.arrayBuffer()
    const avatarPcm = await convertTtsAudioToAvatarPcm(
      ttsArrayBuffer,
      ttsResponse.contentType,
    )

    if (signal?.aborted) {
      return 'silent'
    }

    await avatarSpeechSender(avatarPcm)
    onEnd?.('avatar-tts')
    return 'avatar-tts'
  } catch (error) {
    if (signal?.aborted) {
      return 'silent'
    }

    console.info('[AvaCoach AvatarKit]', 'avatar tts lip-sync fallback', {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: 'UnknownError', message: String(error) },
    })
    onNotice?.('Avatar TTS lip-sync unavailable. Browser speech does not drive avatar lip-sync.')
    return speakBrowser(text, { onStart, onEnd })
  }
}

function speakBrowser(
  text: string,
  callbacks: {
    onStart?: (mode: VoiceMode) => void
    onEnd?: (mode: VoiceMode) => void
  },
): Promise<VoiceMode> {
  return speakWithBrowserSpeech(text, callbacks)
}
