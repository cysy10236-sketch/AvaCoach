import { useEffect, useRef, useState } from 'react'
import {
  createAvatarKitRuntime,
  getSpatiusClientConfig,
} from '../services/avatarKitClient'
import type {
  AvatarKitRuntime,
  AvatarSpeechSender,
  SpatiusConnectionState,
  SpatiusRuntimeStatus,
} from '../types/spatius'

interface AvatarStageProps {
  onAvatarSpeechReady: (sender: AvatarSpeechSender | null, interrupt: (() => void) | null) => void
  onSampleVoiceMode: () => void
  onStatusChange: (status: SpatiusRuntimeStatus) => void
}

function AvatarStage({
  onAvatarSpeechReady,
  onSampleVoiceMode,
  onStatusChange,
}: AvatarStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<AvatarKitRuntime | null>(null)
  const onAvatarSpeechReadyRef = useRef(onAvatarSpeechReady)
  const [state, setState] = useState<SpatiusConnectionState>('placeholder')
  const [message, setMessage] = useState('Placeholder avatar is ready. Connect Avatar to verify the real SDK path.')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSendingSample, setIsSendingSample] = useState(false)

  useEffect(() => {
    onAvatarSpeechReadyRef.current = onAvatarSpeechReady
  }, [onAvatarSpeechReady])

  useEffect(
    () => () => {
      onAvatarSpeechReadyRef.current(null, null)
      runtimeRef.current?.destroy('component-unmount')
      runtimeRef.current = null
    },
    [],
  )

  function update(nextState: SpatiusConnectionState, nextMessage: string) {
    setState(nextState)
    setMessage(nextMessage)
    onStatusChange(toRuntimeStatus(nextState, nextMessage))
  }

  async function handleConnectAvatar() {
    if (isConnecting) {
      return
    }

    const { appId, avatarId } = getSpatiusClientConfig()

    if (!appId || !avatarId) {
      update(
        'not_configured',
        'Missing VITE_SPATIUS_APP_ID or VITE_SPATIUS_AVATAR_ID. Placeholder remains active.',
      )
      return
    }

    if (!containerRef.current) {
      update('placeholder', 'Avatar container is not ready.')
      return
    }

    if (runtimeRef.current) {
      const snapshot = runtimeRef.current.getSnapshot()

      if (snapshot.isReady) {
        update('avatar_connected', 'Real Avatar Connected. Ready to send bundled sample PCM audio.')
      } else if (
        snapshot.avatarRuntimeState === 'connecting' ||
        snapshot.avatarRuntimeState === 'render_ready' ||
        snapshot.avatarRuntimeState === 'token_loading' ||
        snapshot.avatarRuntimeState === 'sdk_initializing' ||
        snapshot.avatarRuntimeState === 'avatar_loading'
      ) {
        update('sdk_loading', 'AvatarKit is still connecting. Please wait for Avatar Connected.')
      } else {
        update('error', `Avatar runtime exists but is not ready (${snapshot.avatarRuntimeState}). Refresh or reset before reconnecting.`)
      }
      return
    }

    setIsConnecting(true)

    try {
      runtimeRef.current = await createAvatarKitRuntime({
        container: containerRef.current,
        onStateChange: update,
      })
      const runtime = runtimeRef.current
      onAvatarSpeechReady(
        runtime
          ? {
              speakPcm: (pcmArrayBuffer) => runtime.speakPcm(pcmArrayBuffer),
              waitForReady: (timeoutMs) => runtime.waitForReady(timeoutMs),
              getSnapshot: () => runtime.getSnapshot(),
              interrupt: () => runtime.interrupt(),
            }
          : null,
        () => runtimeRef.current?.interrupt(),
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'AvatarKit failed. Placeholder demo remains usable.'
      update(isTokenIssue(errorMessage) ? 'token_fallback' : 'error', errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  async function handleSendSampleAudio() {
    if (!runtimeRef.current) {
      update('placeholder', 'Connect Avatar before sending bundled sample PCM audio.')
      return
    }

    setIsSendingSample(true)

    try {
      await runtimeRef.current.sendSampleAudio()
      onSampleVoiceMode()
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Sample audio failed. Interview flow remains usable.'
      update('error', errorMessage)
    } finally {
      setIsSendingSample(false)
    }
  }

  const isAvatarConnected =
    state === 'render_ready' ||
    state === 'motion_server_connected' ||
    state === 'avatar_connected' ||
    state === 'avatar_speech_sending' ||
    state === 'avatar_speaking' ||
    state === 'avatar_speech_finished' ||
    state === 'avatar_speech_failed' ||
    state === 'sample_audio_finished' ||
    state === 'sample_audio_failed' ||
    state === 'sample_audio_sending' ||
    state === 'sample_audio_playing'
  const showPlaceholder = !isAvatarConnected

  return (
    <div className={`avatar-stage avatar-stage-${state}`}>
      <div className="avatarkit-container" ref={containerRef} />
      {showPlaceholder ? (
        <div className="avatar-placeholder-layer">
          <div className="avatar-rings" />
          <div className="avatar-core">
            <span>A</span>
          </div>
          <div className="signal-line" />
          <p>{message}</p>
        </div>
      ) : null}

      <div className="avatarkit-actions">
        <button
          className="secondary-action"
          disabled={isConnecting}
          type="button"
          onClick={handleConnectAvatar}
        >
          {isAvatarConnected ? 'Avatar Connected' : isConnecting ? 'Connecting...' : 'Connect Avatar'}
        </button>
        <button
          className="secondary-action"
          disabled={!isAvatarConnected || isConnecting || isSendingSample}
          type="button"
          onClick={handleSendSampleAudio}
        >
          {isSendingSample ? 'Sending...' : 'Send Sample Audio'}
        </button>
      </div>
    </div>
  )
}

function isTokenIssue(message: string) {
  return (
    message.includes('SPATIUS_API_KEY') ||
    message.includes('Session Token') ||
    message.includes('session token') ||
    message.includes('fallback response') ||
    message.includes('expired')
  )
}

function toRuntimeStatus(
  connectionState: SpatiusConnectionState,
  message: string,
): SpatiusRuntimeStatus {
  return {
    connectionState,
    avatarMode:
      connectionState === 'avatar_connected' ||
      connectionState === 'avatar_speech_sending' ||
      connectionState === 'avatar_speaking' ||
      connectionState === 'avatar_speech_finished' ||
      connectionState === 'avatar_speech_failed' ||
      connectionState === 'render_ready' ||
      connectionState === 'motion_server_connected' ||
      connectionState === 'sample_audio_finished' ||
      connectionState === 'sample_audio_failed' ||
      connectionState === 'sample_audio_sending' ||
      connectionState === 'sample_audio_playing'
        ? 'real-avatar'
        : 'placeholder',
    tokenState:
      connectionState === 'avatar_connected' ||
      connectionState === 'avatar_speech_sending' ||
      connectionState === 'avatar_speaking' ||
      connectionState === 'avatar_speech_finished' ||
      connectionState === 'avatar_speech_failed' ||
      connectionState === 'render_ready' ||
      connectionState === 'motion_server_connected' ||
      connectionState === 'sample_audio_finished' ||
      connectionState === 'sample_audio_failed' ||
      connectionState === 'sample_audio_sending' ||
      connectionState === 'sample_audio_playing' ||
      connectionState === 'sdk_ready' ||
      connectionState === 'avatar_loading' ||
      connectionState === 'avatar_loaded' ||
      connectionState === 'sdk_loading'
        ? 'direct-ready'
        : connectionState === 'token_fallback'
          ? 'fallback'
          : connectionState === 'error' && isTokenIssue(message)
            ? 'expired-invalid'
            : 'not-checked',
    message,
  }
}

export default AvatarStage
