export type BrowserAsrMode = 'browser' | 'mock' | 'stream' | 'unavailable'

export interface BrowserAsrResult {
  transcript: string
}

export interface BrowserAsrSession {
  promise: Promise<BrowserAsrResult>
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: {
      transcript: string
    }
  }>
}

interface SpeechRecognitionErrorEventLike {
  error: string
  message?: string
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function isBrowserAsrSupported(): boolean {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
}

export function startBrowserAsr(lang = 'zh-CN'): BrowserAsrSession {
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

  if (!Recognition) {
    throw new Error(getBrowserAsrErrorMessage('unsupported'))
  }

  const recognition = new Recognition()
  let settled = false
  let transcript = ''

  recognition.lang = lang
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  const promise = new Promise<BrowserAsrResult>((resolve, reject) => {
    recognition.onresult = (event) => {
      const parts: string[] = []

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result?.[0]?.transcript?.trim()

        if (text) {
          parts.push(text)
        }
      }

      transcript = [...[transcript], ...parts]
        .filter(Boolean)
        .join('')
        .trim()
    }

    recognition.onerror = (event) => {
      if (settled) {
        return
      }

      settled = true
      reject(new Error(getBrowserAsrErrorMessage(event.error)))
    }

    recognition.onend = () => {
      if (settled) {
        return
      }

      settled = true

      if (!transcript) {
        reject(new Error(getBrowserAsrErrorMessage('no-speech')))
        return
      }

      resolve({ transcript })
    }

    try {
      recognition.start()
    } catch (error) {
      settled = true
      reject(
        error instanceof Error
          ? error
          : new Error(getBrowserAsrErrorMessage('unsupported')),
      )
    }
  })

  return {
    promise,
    stop: () => {
      recognition.stop()
    },
    abort: () => {
      recognition.abort()
    },
  }
}

export function getBrowserAsrErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'permission-denied':
      return '麦克风权限被拒绝，请手动输入回答。'
    case 'no-speech':
      return '没有检测到语音，请重试或手动输入。'
    case 'network':
      return '语音识别网络异常，请稍后重试或手动输入。'
    case 'aborted':
      return '语音识别已取消。'
    case 'unsupported':
      return '浏览器不支持语音识别，请使用文字输入。'
    default:
      return '语音识别失败，请重试或手动输入。'
  }
}
