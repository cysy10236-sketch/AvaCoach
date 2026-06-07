import {
  type AvatarController,
  AvatarManager,
  AvatarSDK,
  AvatarView,
  ConnectionState,
  ConversationState,
  DrivingServiceMode,
  LogLevel,
} from '@spatius/avatarkit'
import { fetchSpatiusSessionToken } from './spatiusApi'
import type {
  AvatarKitRuntime,
  AvatarSpeechSendResult,
  AvatarRuntimeSnapshot,
  AvatarRuntimeState,
  AvatarRuntimeDestroyReason,
  SpatiusConnectionState,
} from '../types/spatius'

const AVATAR_INPUT_SAMPLE_RATE = 16_000
const CONNECTION_TIMEOUT_MS = 15_000
const QUICKSTART_AUDIO_URL = '/audio/quickstart_voice.pcm'

interface CreateAvatarKitOptions {
  container: HTMLElement
  onStateChange: (state: SpatiusConnectionState, message: string) => void
}

export function getSpatiusClientConfig() {
  return {
    appId: import.meta.env.VITE_SPATIUS_APP_ID?.trim() ?? '',
    avatarId: import.meta.env.VITE_SPATIUS_AVATAR_ID?.trim() ?? '',
  }
}

export async function createAvatarKitRuntime({
  container,
  onStateChange,
}: CreateAvatarKitOptions): Promise<AvatarKitRuntime> {
  const { appId, avatarId } = getSpatiusClientConfig()

  debugAvatarKit('config checked', {
    appIdExists: Boolean(appId),
    avatarIdExists: Boolean(avatarId),
    container: getContainerDebug(container),
  })

  if (!appId || !avatarId) {
    throw new Error('Avatar SDK not configured: missing VITE_SPATIUS_APP_ID or VITE_SPATIUS_AVATAR_ID.')
  }

  // Local runtime state is kept separately from UI labels so speech can make
  // readiness decisions without guessing from display strings.
  let earlyRuntimeState: AvatarRuntimeState = 'token_loading'
  onStateChange('token_loading', 'Requesting short-lived Spatius Session Token from AvaCoach backend.')
  const tokenResponse = await fetchSpatiusSessionToken()
  debugAvatarKit('session token response', {
    tokenReceived: Boolean(tokenResponse.sessionToken),
    tokenLength: tokenResponse.sessionToken?.length ?? 0,
    fallback: tokenResponse.fallback,
    mode: tokenResponse.mode,
    region: tokenResponse.debug?.region,
    container: getContainerDebug(container),
  })

  if (tokenResponse.fallback || !tokenResponse.sessionToken) {
    onStateChange(
      'token_fallback',
      tokenResponse.message ?? 'Spatius Session Token fallback response received.',
    )
    throw new Error(tokenResponse.message ?? 'Spatius Session Token fallback response received.')
  }

  earlyRuntimeState = 'sdk_initializing'
  onStateChange('sdk_loading', 'Initializing AvatarKit with Direct Mode sample audio settings.')
  debugAvatarKit('sdk initialize started', {
    container: getContainerDebug(container),
  })

  if (!AvatarSDK.configuration) {
    const configuration = {
      region: tokenResponse.debug?.region ?? 'us-west',
      drivingServiceMode: DrivingServiceMode.sdk,
      logLevel: LogLevel.warning,
      audioFormat: {
        channelCount: 1,
        sampleRate: AVATAR_INPUT_SAMPLE_RATE,
      },
    } as Parameters<typeof AvatarSDK.initialize>[1] & { region: string }

    try {
      await AvatarSDK.initialize(appId, configuration)
      debugAvatarKit('sdk initialize success', {
        container: getContainerDebug(container),
      })
    } catch (error) {
      debugAvatarKit('sdk initialize failed', {
        error: formatErrorDebug(error),
      })
      throw error
    }
  } else {
    debugAvatarKit('sdk initialize skipped existing configuration', {
      container: getContainerDebug(container),
    })
  }

  onStateChange('sdk_ready', 'AvatarKit SDK initialized. Setting short-lived Session Token.')

  try {
    AvatarSDK.setSessionToken(tokenResponse.sessionToken)
    debugAvatarKit('set session token success', {
      tokenReceived: true,
      tokenLength: tokenResponse.sessionToken.length,
    })
  } catch (error) {
    debugAvatarKit('set session token failed', {
      error: formatErrorDebug(error),
    })
    throw error
  }

  earlyRuntimeState = 'avatar_loading'
  onStateChange('avatar_loading', 'Loading Spatius avatar assets.')
  debugAvatarKit('avatar load started', {
    avatarIdExists: Boolean(avatarId),
    container: getContainerDebug(container),
  })

  let avatarView: AvatarView | null = null

  try {
    const avatar = await AvatarManager.shared.load(avatarId)
    onStateChange('avatar_loaded', 'Avatar assets loaded. Creating AvatarView.')
    debugAvatarKit('avatar load success', {
      container: getContainerDebug(container),
    })

    debugAvatarKit('avatar view create started', {
      container: getContainerDebug(container),
    })
    avatarView = new AvatarView(avatar, container)
    avatarView.onFirstRendering = () => {
      setRuntimeState('render_ready')
      onStateChange('render_ready', 'Avatar render system is ready.')
      debugAvatarKit('avatar first rendering', {
        container: getContainerDebug(container),
      })
    }
    debugAvatarKit('avatar view create success', {
      container: getContainerDebug(container),
    })
  } catch (error) {
    avatarView?.dispose()
    debugAvatarKit('avatar load or view create failed', {
      error: formatErrorDebug(error),
      container: getContainerDebug(container),
    })
    throw error
  }

  const controller = avatarView.controller
  let avatarRuntimeState: AvatarRuntimeState = earlyRuntimeState
  let latestConnectionState: ConnectionState | 'unknown' = 'unknown'
  let latestConversationState: ConversationState | 'unknown' = 'unknown'
  let controllerStarted = false
  let samplePlaybackObserved = false
  let avatarSpeechObserved = false
  let sampleStateTimer: number | null = null
  let speechStateTimer: number | null = null
  let activeAudioKind: 'sample' | 'speech' | null = null
  let pendingSpeechResolve: ((result: AvatarSpeechSendResult) => void) | null = null
  let pendingSpeechReject: ((error: Error) => void) | null = null
  let readyWaiters: Array<(ready: boolean) => void> = []
  let idleWaiters: Array<(idle: boolean) => void> = []

  const setRuntimeState = (nextState: AvatarRuntimeState) => {
    avatarRuntimeState = nextState
  }
  const getSnapshot = (): AvatarRuntimeSnapshot => ({
    avatarRuntimeState,
    connectionState: String(latestConnectionState),
    conversationState: String(latestConversationState),
    controllerStarted,
    isReady: controllerStarted && latestConnectionState === ConnectionState.connected,
  })
  const notifyReadyWaiters = () => {
    if (controllerStarted && latestConnectionState === ConnectionState.connected) {
      readyWaiters.forEach((resolve) => resolve(true))
      readyWaiters = []
    }
  }
  const notifyIdleWaiters = () => {
    if (latestConversationState === ConversationState.idle) {
      idleWaiters.forEach((resolve) => resolve(true))
      idleWaiters = []
    }
  }
  const waitForReady = (timeoutMs = 5000): Promise<boolean> => {
    if (controllerStarted && latestConnectionState === ConnectionState.connected) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        readyWaiters = readyWaiters.filter((waiter) => waiter !== finish)
        resolve(false)
      }, timeoutMs)
      const finish = (ready: boolean) => {
        window.clearTimeout(timeoutId)
        resolve(ready)
      }
      readyWaiters.push(finish)
    })
  }
  const waitForIdle = (timeoutMs = 1200): Promise<boolean> => {
    if (
      latestConversationState === ConversationState.idle ||
      latestConversationState === 'unknown'
    ) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        idleWaiters = idleWaiters.filter((waiter) => waiter !== finish)
        resolve(false)
      }, timeoutMs)
      const finish = (idle: boolean) => {
        window.clearTimeout(timeoutId)
        resolve(idle)
      }
      idleWaiters.push(finish)
    })
  }

  controller.onConversationState = (conversationState) => {
    latestConversationState = conversationState
    debugAvatarKit('conversation state', {
      state: String(conversationState),
    })

    if (conversationState === ConversationState.playing) {
      if (activeAudioKind === 'speech') {
        avatarSpeechObserved = true
        if (speechStateTimer) {
          window.clearTimeout(speechStateTimer)
          speechStateTimer = null
        }
        setRuntimeState('speaking')
        onStateChange('avatar_speaking', 'Avatar is speaking the interviewer reply with TTS lip-sync.')
      } else {
        samplePlaybackObserved = true
        if (sampleStateTimer) {
          window.clearTimeout(sampleStateTimer)
          sampleStateTimer = null
        }
        onStateChange('sample_audio_playing', 'Sample PCM audio is playing through AvatarKit.')
      }
    } else if (conversationState === ConversationState.idle) {
      if (sampleStateTimer) {
        window.clearTimeout(sampleStateTimer)
        sampleStateTimer = null
      }

      if (speechStateTimer) {
        window.clearTimeout(speechStateTimer)
        speechStateTimer = null
      }

      if (activeAudioKind === 'speech' && avatarSpeechObserved) {
        activeAudioKind = null
        setRuntimeState('speech_finished')
        onStateChange('avatar_speech_finished', 'Avatar finished speaking. Listening for candidate answer.')
        pendingSpeechResolve?.({
          sent: true,
          conversationIdReturned: true,
          playingObserved: true,
          shouldFallback: false,
        })
        pendingSpeechResolve = null
        pendingSpeechReject = null
      } else if (samplePlaybackObserved) {
        activeAudioKind = null
        onStateChange('sample_audio_finished', 'Sample audio finished. Avatar is ready for another test.')
      } else {
        setRuntimeState('connected')
        onStateChange('avatar_connected', 'Avatar is idle and ready for bundled sample audio.')
      }
      notifyIdleWaiters()
    }
  }

  setRuntimeState('connecting')
  onStateChange('sdk_loading', 'Connecting AvatarKit to the Spatius Motion Server.')
  await controller.initializeAudioContext()
  debugAvatarKit('audio context initialized', {
    container: getContainerDebug(container),
  })
  const animationChannelReady = waitForAnimationChannel(
    controller,
    onStateChange,
    (state) => {
      latestConnectionState = state
      if (state === ConnectionState.connected) {
        setRuntimeState('connected')
        notifyReadyWaiters()
      } else if (state === ConnectionState.failed) {
        setRuntimeState('error')
      } else if (String(state) === 'disconnected') {
        setRuntimeState('disconnected')
      } else {
        setRuntimeState('connecting')
      }
    },
  )
  debugAvatarKit('controller.start called', {
    connectionStateBeforeStart: String(latestConnectionState),
  })
  await Promise.all([
    controller.start().then(() => {
      controllerStarted = true
      debugAvatarKit('controller.start success', {
        connectionStateAfterStart: String(latestConnectionState),
      })
      notifyReadyWaiters()
    }),
    animationChannelReady,
  ])

  setRuntimeState('connected')
  notifyReadyWaiters()
  onStateChange('avatar_connected', 'Real Avatar Connected. Ready to send bundled sample PCM audio.')

  return {
    sendSampleAudio: async () => {
      if (!controllerStarted) {
        const message = 'controller.start has not completed. Connect Avatar again before sending sample audio.'
        onStateChange('sample_audio_failed', message)
        throw new Error(message)
      }

      if (latestConnectionState !== ConnectionState.connected) {
        const message = `Motion Server is not connected (${String(latestConnectionState)}). Sample audio was not sent.`
        onStateChange('sample_audio_failed', message)
        throw new Error(message)
      }

      samplePlaybackObserved = false
      avatarSpeechObserved = false
      activeAudioKind = 'sample'
      if (sampleStateTimer) {
        window.clearTimeout(sampleStateTimer)
        sampleStateTimer = null
      }

      onStateChange('sample_audio_loading', 'Loading bundled PCM16 mono 16 kHz sample audio.')
      debugAvatarKit('sample audio fetch started', {
        url: QUICKSTART_AUDIO_URL,
        connectionStateBeforeSend: String(latestConnectionState),
        conversationStateBeforeSend: String(latestConversationState),
        controllerStarted,
      })
      const audioData = await downloadSampleAudio()
      const int16Preview = new Int16Array(audioData.slice(0, Math.min(audioData.byteLength, 20)))
      debugAvatarKit('sample audio loaded', {
        byteLength: audioData.byteLength,
        typedArrayType: 'ArrayBuffer',
        pcmInterpretation: 'Int16Array preview only; SDK receives ArrayBuffer',
        firstNumericValues: Array.from(int16Preview).slice(0, 10),
      })

      if (audioData.byteLength === 0) {
        const message = 'Sample PCM audio file is empty. AvatarKit send was skipped.'
        onStateChange('sample_audio_failed', message)
        throw new Error(message)
      }

      onStateChange('sample_audio_sending', 'Sending bundled PCM16 mono 16 kHz sample audio.')
      debugAvatarKit('controller.send called', {
        connectionStateBeforeSend: String(latestConnectionState),
        conversationStateBeforeSend: String(latestConversationState),
        audioArgumentType: 'ArrayBuffer',
        sendChunkCount: 1,
        sendEndFlag: true,
      })

      const conversationId = avatarView.controller.send(audioData, true)
      debugAvatarKit('controller.send success', {
        conversationIdReturned: Boolean(conversationId),
        conversationStateAfterSend: String(latestConversationState),
        sendChunkCount: 1,
        sendEndFlag: true,
      })

      if (!conversationId) {
        const message = 'AvatarKit controller.send returned no conversation id. Check connection state and PCM format.'
        onStateChange('sample_audio_failed', message)
        throw new Error(message)
      }

      onStateChange('sample_audio_sending', 'Sample audio sent; verify lip-sync visually.')
      sampleStateTimer = window.setTimeout(() => {
        if (!samplePlaybackObserved) {
          debugAvatarKit('sample audio no playing state observed', {
            connectionState: String(latestConnectionState),
            conversationState: String(latestConversationState),
          })
          onStateChange(
            'sample_audio_failed',
            'Sample audio sent, but AvatarKit did not enter playing state. Check Motion Server state and PCM format.',
          )
        }
      }, 2500)
    },
    speakPcm: async (pcmArrayBuffer) => {
      pendingSpeechReject?.(new Error('Interrupted by a newer AvatarKit speech request.'))
      const ready = await waitForReady(5000)
      if (!ready) {
        throw new Error('Avatar not ready timeout.')
      }

      if (latestConversationState === ConversationState.playing) {
        controller.interrupt()
        await waitForIdle(1200)
      }

      return new Promise<AvatarSpeechSendResult>((resolve, reject) => {
        pendingSpeechResolve = resolve
        pendingSpeechReject = reject
        try {
          sendAvatarPcm({
            audioData: pcmArrayBuffer,
            onStateChange,
            getConnectionState: () => latestConnectionState,
            getConversationState: () => latestConversationState,
            getControllerStarted: () => controllerStarted,
            controller: avatarView.controller,
            onSpeechTimer: (timer) => {
              speechStateTimer = timer
            },
            clearSpeechTimer: () => {
              if (speechStateTimer) {
                window.clearTimeout(speechStateTimer)
                speechStateTimer = null
              }
            },
            markSpeechStarted: () => {
              avatarSpeechObserved = false
              activeAudioKind = 'speech'
              setRuntimeState('speech_sending')
            },
            onFailed: (error) => {
              pendingSpeechResolve = null
              pendingSpeechReject = null
              reject(error)
            },
            onAcceptedWithoutPlayingObserved: (result) => {
              pendingSpeechResolve = null
              pendingSpeechReject = null
              resolve(result)
            },
          })
        } catch (error) {
          pendingSpeechResolve = null
          pendingSpeechReject = null
          reject(error)
        }
      })
    },
    waitForReady,
    getSnapshot,
    interrupt: () => {
      activeAudioKind = null
      samplePlaybackObserved = false
      avatarSpeechObserved = false
      if (sampleStateTimer) {
        window.clearTimeout(sampleStateTimer)
        sampleStateTimer = null
      }
      if (speechStateTimer) {
        window.clearTimeout(speechStateTimer)
        speechStateTimer = null
      }
      controller.interrupt()
      pendingSpeechReject?.(new Error('AvatarKit speech interrupted.'))
      pendingSpeechResolve = null
      pendingSpeechReject = null
    },
    destroy: (reason: AvatarRuntimeDestroyReason = 'unknown') => {
      setRuntimeState('disconnected')
      debugAvatarLifecycleDestroy(reason)
      debugAvatarKit('runtime destroy started', { reason })
      if (sampleStateTimer) {
        window.clearTimeout(sampleStateTimer)
      }
      if (speechStateTimer) {
        window.clearTimeout(speechStateTimer)
      }
      controller.close()
      readyWaiters.forEach((resolve) => resolve(false))
      idleWaiters.forEach((resolve) => resolve(false))
      readyWaiters = []
      idleWaiters = []
      pendingSpeechReject?.(new Error('AvatarKit runtime destroyed.'))
      avatarView.dispose()
      AvatarSDK.cleanup()
    },
  }
}

async function downloadSampleAudio(): Promise<ArrayBuffer> {
  const response = await fetch(QUICKSTART_AUDIO_URL)
  debugAvatarKit('sample audio fetch status', {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
  })

  if (!response.ok) {
    throw new Error(`Sample PCM audio file missing or unavailable (${response.status}).`)
  }

  return response.arrayBuffer()
}

function waitForAnimationChannel(
  controller: AvatarController,
  onStateChange: (state: SpatiusConnectionState, message: string) => void,
  onConnectionStateSeen: (state: ConnectionState) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    let lastError: string | null = null

    const finish = (error?: Error) => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeoutId)

      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    const timeoutId = window.setTimeout(() => {
      finish(new Error(lastError ?? 'Timed out waiting for AvatarKit animation channel. Refresh the Session Token and try again.'))
    }, CONNECTION_TIMEOUT_MS)

    controller.onConnectionState = (state) => {
      onConnectionStateSeen(state)
      if (state === ConnectionState.connected) {
        onStateChange('motion_server_connected', 'AvatarKit Motion Server connection established.')
        debugAvatarKit('connection state', {
          state: String(state),
        })
        finish()
      } else if (state === ConnectionState.failed) {
        window.setTimeout(() => {
          finish(new Error(lastError ?? 'AvatarKit failed to connect to the Motion Server. Refresh the Session Token and check region.'))
        }, 100)
      } else {
        onStateChange('sdk_loading', `AvatarKit connection state: ${String(state)}.`)
        debugAvatarKit('connection state', {
          state: String(state),
        })
      }
    }

    controller.onError = (error) => {
      lastError = formatAvatarError(error)
      debugAvatarKit('controller error', {
        error: formatErrorDebug(error),
      })
      finish(new Error(lastError))
    }
  })
}

function formatAvatarError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'AvatarKit failed. Placeholder demo remains usable.'
}

async function sendAvatarPcm({
  audioData,
  onStateChange,
  getConnectionState,
  getConversationState,
  getControllerStarted,
  controller,
  onSpeechTimer,
  clearSpeechTimer,
  markSpeechStarted,
  onFailed,
  onAcceptedWithoutPlayingObserved,
}: {
  audioData: ArrayBuffer
  onStateChange: (state: SpatiusConnectionState, message: string) => void
  getConnectionState: () => ConnectionState | 'unknown'
  getConversationState: () => ConversationState | 'unknown'
  getControllerStarted: () => boolean
  controller: AvatarController
  onSpeechTimer: (timer: number) => void
  clearSpeechTimer: () => void
  markSpeechStarted: () => void
  onFailed: (error: Error) => void
  onAcceptedWithoutPlayingObserved: (result: AvatarSpeechSendResult) => void
}) {
  if (!getControllerStarted()) {
    const message = 'controller.start has not completed. Browser speech fallback should be used.'
    onStateChange('avatar_speech_failed', message)
    const error = new Error(message)
    onFailed(error)
    throw error
  }

  if (getConnectionState() !== ConnectionState.connected) {
    const message = `Motion Server is not connected (${String(getConnectionState())}). Browser speech fallback should be used.`
    onStateChange('avatar_speech_failed', message)
    const error = new Error(message)
    onFailed(error)
    throw error
  }

  if (audioData.byteLength === 0) {
    const message = 'Avatar TTS PCM buffer is empty. Browser speech fallback should be used.'
    onStateChange('avatar_speech_failed', message)
    const error = new Error(message)
    onFailed(error)
    throw error
  }

  markSpeechStarted()
  clearSpeechTimer()
  onStateChange('avatar_speech_sending', 'Sending interviewer TTS PCM to AvatarKit for lip-sync.')
  debugAvatarKit('avatar speech send called', {
    byteLength: audioData.byteLength,
    typedArrayType: 'ArrayBuffer',
    pcmFormat: 'PCM16 mono 16 kHz',
    firstNumericValues: Array.from(
      new Int16Array(audioData.slice(0, Math.min(audioData.byteLength, 20))),
    ).slice(0, 10),
    connectionStateBeforeSend: String(getConnectionState()),
    conversationStateBeforeSend: String(getConversationState()),
    sendChunkCount: 1,
    sendEndFlag: true,
  })

  const conversationId = controller.send(audioData, true)

  debugSpeechLifecycle('avatar speech send completed', {
    speechSendCalled: true,
    conversationIdReturned: Boolean(conversationId),
    connectionState: String(getConnectionState()),
    conversationState: String(getConversationState()),
  })
  debugAvatarKit('avatar speech send success', {
    conversationIdReturned: Boolean(conversationId),
    conversationStateAfterSend: String(getConversationState()),
    sendChunkCount: 1,
    sendEndFlag: true,
  })

  if (!conversationId) {
    const message = 'AvatarKit controller.send returned no conversation id for TTS PCM.'
    onStateChange('avatar_speech_failed', message)
    const error = new Error(message)
    onFailed(error)
    throw error
  }

  const timer = window.setTimeout(() => {
    debugAvatarKit('avatar speech no playing state observed', {
      connectionState: String(getConnectionState()),
      conversationState: String(getConversationState()),
    })
    debugSpeechLifecycle('avatar speech accepted without playing observation', {
      avatarSendSucceeded: true,
      conversationIdReturned: true,
      playingObserved: false,
      browserFallbackTriggered: false,
      fallbackReason: 'avatar-send-success-playing-not-observed',
      finalVoiceMode: 'avatar-tts',
      connectionState: String(getConnectionState()),
      conversationState: String(getConversationState()),
    })
    onStateChange(
      'avatar_speech_sending',
      'TTS PCM was sent to AvatarKit; playback state is not confirmed yet.',
    )
    onAcceptedWithoutPlayingObserved({
      sent: true,
      conversationIdReturned: true,
      playingObserved: false,
      shouldFallback: false,
      fallbackReason: 'avatar-send-success-playing-not-observed',
    })
  }, 2500)
  onSpeechTimer(timer)
}

function debugAvatarKit(message: string, details: Record<string, unknown>) {
  console.info('[AvaCoach AvatarKit]', message, details)
}

function debugSpeechLifecycle(message: string, details: Record<string, unknown>) {
  console.info('[AvaCoach Speech Lifecycle]', message, details)
}

function debugAvatarLifecycleDestroy(reason: AvatarRuntimeDestroyReason) {
  console.debug('[AvaCoach AvatarLifecycle] destroy called', {
    reason,
    stack: new Error().stack?.split('\n').slice(0, 8).join('\n'),
  })
}

function getContainerDebug(container: HTMLElement) {
  const rect = container.getBoundingClientRect()

  return {
    exists: true,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    offsetWidth: container.offsetWidth,
    offsetHeight: container.offsetHeight,
    isConnected: container.isConnected,
  }
}

function formatErrorDebug(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}
