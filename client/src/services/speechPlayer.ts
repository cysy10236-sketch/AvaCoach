import { fetchTtsAudio } from './ttsApi'

export type VoiceMode = 'avatar-tts' | 'sample-pcm' | 'tts' | 'browser' | 'silent'

interface SpeakCallbacks {
  onEvaluating?: () => void
  onStart?: (mode: VoiceMode) => void
  onEnd?: (mode: VoiceMode) => void
}

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null
let currentController: AbortController | null = null

export async function speakText(
  text: string,
  callbacks: SpeakCallbacks = {},
): Promise<VoiceMode> {
  stopSpeech()
  callbacks.onEvaluating?.()

  const controller = new AbortController()
  currentController = controller

  try {
    const response = await fetchTtsAudio(text, controller.signal)

    if (!response.fallback) {
      await playAudioBlob(response.audio, callbacks)
      return 'tts'
    }
  } catch {
    if (controller.signal.aborted) {
      return 'silent'
    }
  }

  return speakWithBrowserFallback(text, callbacks)
}

export function stopSpeech() {
  currentController?.abort()
  currentController = null

  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl)
    currentAudioUrl = null
  }

  window.speechSynthesis?.cancel()
}

export function speakWithBrowserSpeech(
  text: string,
  callbacks: SpeakCallbacks = {},
): Promise<VoiceMode> {
  stopSpeech()
  callbacks.onEvaluating?.()

  return speakWithBrowserFallback(text, callbacks)
}

async function playAudioBlob(
  audio: Blob,
  callbacks: SpeakCallbacks,
): Promise<void> {
  currentAudioUrl = URL.createObjectURL(audio)
  currentAudio = new Audio(currentAudioUrl)

  callbacks.onStart?.('tts')

  try {
    await new Promise<void>((resolve, reject) => {
      if (!currentAudio) {
        reject(new Error('Audio was stopped before playback started.'))
        return
      }

      currentAudio.onended = () => resolve()
      currentAudio.onerror = () => reject(new Error('Audio playback failed.'))
      void currentAudio.play().catch(reject)
    })

    callbacks.onEnd?.('tts')
  } finally {
    cleanupAudio()
  }
}

function speakWithBrowserFallback(
  text: string,
  callbacks: SpeakCallbacks,
): Promise<VoiceMode> {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    callbacks.onEnd?.('silent')
    return Promise.resolve('silent')
  }

  return new Promise((resolve) => {
    let settled = false
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.95
    utterance.pitch = 1

    utterance.onend = () => {
      if (settled) {
        return
      }

      settled = true
      callbacks.onEnd?.('browser')
      resolve('browser')
    }
    utterance.onerror = () => {
      if (settled) {
        return
      }

      settled = true
      callbacks.onEnd?.('silent')
      resolve('silent')
    }

    window.speechSynthesis.cancel()
    waitForVoices().finally(() => {
      callbacks.onStart?.('browser')
      window.speechSynthesis.speak(utterance)

      window.setTimeout(() => {
        if (
          !settled &&
          !window.speechSynthesis.speaking &&
          !window.speechSynthesis.pending
        ) {
          settled = true
          callbacks.onEnd?.('silent')
          resolve('silent')
        }
      }, 800)
    })
  })
}

function waitForVoices(): Promise<void> {
  if (window.speechSynthesis.getVoices().length > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 400)

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout)
      resolve()
    }
  })
}

function cleanupAudio() {
  currentAudio = null

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl)
    currentAudioUrl = null
  }
}
