import { getApiBaseUrl } from './apiConfig'

export type StreamingAsrStatus =
  | 'ready'
  | 'connecting'
  | 'recording'
  | 'recognizing'
  | 'partial'
  | 'final'
  | 'fallback'
  | 'manual'

export interface StreamingAsrClient {
  close: () => void
  sendAudio: (audio: ArrayBuffer) => void
  stop: () => void
}

export interface StreamingAsrCallbacks {
  onDebug?: (message: string, details: Record<string, unknown>) => void
  onError?: (message: string, debug?: Record<string, unknown>) => void
  onFinal?: (text: string, debug?: Record<string, unknown>) => void
  onOpen?: (debug?: Record<string, unknown>) => void
  onPartial?: (text: string, debug?: Record<string, unknown>) => void
  onStatus?: (status: StreamingAsrStatus) => void
}

function safeDebug(label: string, details: Record<string, unknown>) {
  // 安全日志：不输出 API Key / headers / 完整音频 / 过长 transcript
  const safe = { ...details }
  if (typeof safe.transcript === 'string' && safe.transcript.length > 80) {
    safe.transcript = safe.transcript.slice(0, 80) + '…'
  }
  console.info('[AvaCoach ASR Stream]', label, safe)
}

export function createStreamingAsrClient(
  callbacks: StreamingAsrCallbacks,
): StreamingAsrClient {
  callbacks.onStatus?.('connecting')

  // 生产使用 VITE_API_BASE_URL；开发通过 Vite proxy (ws: true) 转发
  const apiBase = getApiBaseUrl()
  const wsUrl = apiBase
    ? `${apiBase.replace(/^http/, 'ws')}/api/asr/stream`
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/asr/stream`

  safeDebug('ws connecting', { wsUrl })

  const socket = new WebSocket(wsUrl)
  socket.binaryType = 'arraybuffer'

  let wsConnected = false

  socket.onopen = () => {
    wsConnected = true
    safeDebug('ws connected', { wsUrl, wsConnected })
    callbacks.onStatus?.('recording')
    callbacks.onOpen?.()
  }

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data)) as {
        type: 'ready' | 'partial' | 'final' | 'error' | 'fallback'
        text?: string
        message?: string
        debug?: Record<string, unknown>
      }

      if (message.type === 'ready') {
        safeDebug('stream ready', message.debug ?? {})
        callbacks.onStatus?.('ready')
        return
      }

      if (message.type === 'partial' && message.text) {
        callbacks.onStatus?.('partial')
        callbacks.onPartial?.(message.text, message.debug)
        safeDebug('partial transcript', {
          partialTranscriptLength: message.text.length,
          ...message.debug,
        })
        return
      }

      if (message.type === 'final') {
        callbacks.onStatus?.('final')
        callbacks.onFinal?.(message.text ?? '', message.debug)
        safeDebug('final transcript', {
          finalTranscriptLength: (message.text ?? '').length,
          ...message.debug,
        })
        return
      }

      if (message.type === 'fallback' || message.type === 'error') {
        const reason = message.message ?? '流式 ASR 失败。'
        callbacks.onStatus?.('fallback')
        callbacks.onError?.(reason, message.debug)
        safeDebug('stream fallback/error', {
          fallbackReason: reason,
          safeErrorCode: message.debug?.safeErrorCode,
          safeErrorMessage: message.debug?.safeErrorMessage,
        })
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : '流式 ASR 消息解析失败。'
      callbacks.onStatus?.('fallback')
      callbacks.onError?.(reason)
      safeDebug('parse error', { fallbackReason: reason })
    }
  }

  socket.onerror = () => {
    const reason = wsConnected
      ? '火山流式 ASR 连接中断，已切换到浏览器识别或手动输入。'
      : '火山流式 ASR 无法连接，请确认后端已启动且端口 3001 可访问。'
    callbacks.onStatus?.('fallback')
    callbacks.onError?.(reason)
    safeDebug('ws error', { wsConnected, wsUrl, fallbackReason: reason })
  }

  socket.onclose = () => {
    safeDebug('ws closed', { wsConnected })
  }

  let pcmChunkCount = 0
  let pcmBytesTotal = 0
  let droppedChunkCount = 0
  let droppedBytesTotal = 0
  let firstDropReadyState: number | null = null

  return {
    close: () => socket.close(),
    sendAudio: (audio) => {
      if (socket.readyState === WebSocket.OPEN) {
        pcmChunkCount += 1
        pcmBytesTotal += audio.byteLength
        socket.send(audio)
        if (pcmChunkCount % 50 === 0) {
          safeDebug('audio sending', { pcmChunkCount, pcmBytesTotal, droppedChunkCount, droppedBytesTotal })
        }
      } else {
        droppedChunkCount += 1
        droppedBytesTotal += audio.byteLength
        if (firstDropReadyState === null) {
          firstDropReadyState = socket.readyState
          const stateMap: Record<number, string> = {
            0: 'CONNECTING',
            2: 'CLOSING',
            3: 'CLOSED',
          }
          safeDebug('audio dropped — ws not open', {
            readyState: stateMap[socket.readyState] ?? String(socket.readyState),
            wsConnected,
            wsUrl,
            droppedReason: wsConnected
              ? 'ws was connected but now not OPEN'
              : 'ws never reached OPEN',
          })
        }
        if (droppedChunkCount % 50 === 0) {
          safeDebug('audio dropping continued', {
            droppedChunkCount,
            droppedBytesTotal,
            readyState: socket.readyState,
            wsConnected,
          })
        }
      }
    },
    stop: () => {
      safeDebug('sending stop', {
        pcmChunkCount,
        pcmBytesTotal,
        droppedChunkCount,
        droppedBytesTotal,
        firstDropReadyState,
      })
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('stop')
      } else {
        safeDebug('stop not sent — ws not open', {
          readyState: socket.readyState,
          wsConnected,
        })
      }
    },
  }
}
