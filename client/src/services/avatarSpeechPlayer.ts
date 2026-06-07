import { convertTtsAudioToAvatarPcm } from './audioToPcm'
import { fetchTtsAudio } from './ttsApi'
import {
  speakWithBrowserSpeech,
  stopSpeech,
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

let speechAttempt = 0
let activeSpeechAttempt = 0

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
  const attemptId = speechAttempt + 1
  speechAttempt = attemptId
  activeSpeechAttempt = attemptId

  stopSpeech()
  onEvaluating?.()

  debugSpeechLifecycle('speech attempt started', {
    attemptId,
    avatarRuntimeExists: Boolean(avatarSpeechSender),
    ...(avatarSpeechSender?.getSnapshot() ?? {
      avatarRuntimeState: 'idle',
      connectionState: 'none',
      conversationState: 'none',
    }),
  })

  if (!avatarSpeechSender) {
    return fallbackToBrowser({
      text,
      attemptId,
      fallbackReason: 'avatar-runtime-missing',
      callbacks: { onStart, onEnd },
      onNotice,
    })
  }

  try {
    const ready = await avatarSpeechSender.waitForReady(5000)
    const readySnapshot = avatarSpeechSender.getSnapshot()

    debugSpeechLifecycle('waitForAvatarReady result', {
      attemptId,
      avatarReady: ready,
      ...readySnapshot,
    })

    if (!ready) {
      return fallbackToBrowser({
        text,
        attemptId,
        fallbackReason: 'avatar-not-ready-timeout',
        callbacks: { onStart, onEnd },
        onNotice,
        details: readySnapshot,
      })
    }

    const ttsResponse = await fetchTtsAudio(text, signal)

    if (signal?.aborted || activeSpeechAttempt !== attemptId) {
      debugSpeechLifecycle('speech aborted after tts request', {
        attemptId,
        browserFallbackTriggered: false,
        finalVoiceMode: 'silent',
      })
      return 'silent'
    }

    if (ttsResponse.fallback) {
      return fallbackToBrowser({
        text,
        attemptId,
        fallbackReason: ttsResponse.message ?? 'tts-json-fallback',
        callbacks: { onStart, onEnd },
        onNotice,
        details: {
          ttsContentType: 'application/json',
          ...avatarSpeechSender.getSnapshot(),
        },
      })
    }

    const ttsArrayBuffer = await ttsResponse.audio.arrayBuffer()
    debugSpeechLifecycle('ttsProvider result', {
      attemptId,
      ttsContentType: ttsResponse.contentType,
      ttsAudioBytes: ttsArrayBuffer.byteLength,
      avatarReady: true,
      ...avatarSpeechSender.getSnapshot(),
    })

    const avatarPcm = await convertTtsAudioToAvatarPcm(
      ttsArrayBuffer,
      ttsResponse.contentType,
    )

    if (signal?.aborted || activeSpeechAttempt !== attemptId) {
      debugSpeechLifecycle('speech aborted before avatar send', {
        attemptId,
        browserFallbackTriggered: false,
        finalVoiceMode: 'silent',
      })
      return 'silent'
    }

    onStart?.('avatar-tts')
    onNotice?.(null)
    debugSpeechLifecycle('avatar speech send requested', {
      attemptId,
      speechSendCalled: true,
      pcmBytes: avatarPcm.byteLength,
      ...avatarSpeechSender.getSnapshot(),
    })

    const sendResult = await avatarSpeechSender.speakPcm(avatarPcm)

    debugSpeechLifecycle('avatar speech send result', {
      attemptId,
      avatarSendSucceeded: sendResult.sent,
      conversationIdReturned: sendResult.conversationIdReturned,
      playingObserved: sendResult.playingObserved,
      browserFallbackTriggered: sendResult.shouldFallback,
      fallbackReason: sendResult.fallbackReason,
      finalVoiceMode: sendResult.shouldFallback ? 'browser' : 'avatar-tts',
      ...avatarSpeechSender.getSnapshot(),
    })

    if (sendResult.shouldFallback) {
      return fallbackToBrowser({
        text,
        attemptId,
        fallbackReason: sendResult.fallbackReason ?? 'avatar-send-failed',
        callbacks: { onStart, onEnd },
        onNotice,
        details: avatarSpeechSender.getSnapshot(),
      })
    }

    debugSpeechLifecycle('speech attempt finished', {
      attemptId,
      avatarSendSucceeded: true,
      conversationIdReturned: sendResult.conversationIdReturned,
      playingObserved: sendResult.playingObserved,
      browserFallbackTriggered: false,
      fallbackReason: sendResult.fallbackReason,
      finalVoiceMode: 'avatar-tts',
      ...avatarSpeechSender.getSnapshot(),
    })
    onEnd?.('avatar-tts')
    return 'avatar-tts'
  } catch (error) {
    if (signal?.aborted || activeSpeechAttempt !== attemptId) {
      debugSpeechLifecycle('speech aborted after error', {
        attemptId,
        browserFallbackTriggered: false,
        finalVoiceMode: 'silent',
      })
      return 'silent'
    }

    const fallbackReason = error instanceof Error ? error.message : String(error)
    debugSpeechLifecycle('avatar speech failed before accepted send', {
      attemptId,
      avatarSendSucceeded: false,
      browserFallbackTriggered: true,
      fallbackReason,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: 'UnknownError', message: String(error) },
    })

    return fallbackToBrowser({
      text,
      attemptId,
      fallbackReason,
      callbacks: { onStart, onEnd },
      onNotice,
      details: avatarSpeechSender.getSnapshot(),
    })
  }
}

function fallbackToBrowser({
  text,
  attemptId,
  fallbackReason,
  callbacks,
  onNotice,
  details = {},
}: {
  text: string
  attemptId: number
  fallbackReason: string
  callbacks: {
    onStart?: (mode: VoiceMode) => void
    onEnd?: (mode: VoiceMode) => void
  }
  onNotice?: (message: string | null) => void
  details?: object
}): Promise<VoiceMode> {
  if (activeSpeechAttempt !== attemptId) {
    debugSpeechLifecycle('speech fallback skipped stale attempt', {
      attemptId,
      browserFallbackTriggered: false,
      fallbackReason,
      finalVoiceMode: 'silent',
      ...details,
    })
    return Promise.resolve('silent')
  }

  debugSpeechLifecycle('speech fallback', {
    attemptId,
    avatarSendSucceeded: false,
    playingObserved: false,
    browserFallbackTriggered: true,
    fallbackReason,
    finalVoiceMode: 'browser',
    ...details,
  })
  onNotice?.(`${fallbackReason}. 已启用浏览器语音；浏览器语音不会驱动数字人口型。`)
  return speakWithBrowserSpeech(text, callbacks)
}

function debugSpeechLifecycle(message: string, details: Record<string, unknown>) {
  console.info('[AvaCoach Speech Lifecycle]', message, details)
}
