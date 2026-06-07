export type SpatiusConnectionState =
  | 'not_configured'
  | 'token_not_checked'
  | 'token_loading'
  | 'token_fallback'
  | 'sdk_loading'
  | 'sdk_ready'
  | 'avatar_loading'
  | 'avatar_loaded'
  | 'render_ready'
  | 'motion_server_connected'
  | 'avatar_connected'
  | 'sample_audio_loading'
  | 'sample_audio_sending'
  | 'sample_audio_playing'
  | 'sample_audio_finished'
  | 'sample_audio_failed'
  | 'avatar_speech_sending'
  | 'avatar_speaking'
  | 'avatar_speech_finished'
  | 'avatar_speech_failed'
  | 'connected'
  | 'error'
  | 'disconnected'
  | 'placeholder'

export type AvatarRuntimeState =
  | 'idle'
  | 'token_loading'
  | 'sdk_initializing'
  | 'avatar_loading'
  | 'render_ready'
  | 'connecting'
  | 'connected'
  | 'speech_sending'
  | 'speaking'
  | 'speech_finished'
  | 'error'
  | 'disconnected'

export type SpatiusAvatarMode = 'real-avatar' | 'placeholder'

export type SpatiusTokenState = 'direct-ready' | 'fallback' | 'not-checked' | 'expired-invalid'

export interface SpatiusRuntimeStatus {
  connectionState: SpatiusConnectionState
  avatarMode: SpatiusAvatarMode
  tokenState: SpatiusTokenState
  message: string
}

export interface AvatarKitRuntime {
  sendSampleAudio: () => Promise<void>
  speakPcm: (pcmArrayBuffer: ArrayBuffer) => Promise<AvatarSpeechSendResult>
  waitForReady: (timeoutMs?: number) => Promise<boolean>
  getSnapshot: () => AvatarRuntimeSnapshot
  interrupt: () => void
  destroy: (reason?: AvatarRuntimeDestroyReason) => void
}

export interface AvatarRuntimeSnapshot {
  avatarRuntimeState: AvatarRuntimeState
  connectionState: string
  conversationState: string
  controllerStarted: boolean
  isReady: boolean
}

export interface AvatarSpeechSender {
  speakPcm: (pcmArrayBuffer: ArrayBuffer) => Promise<AvatarSpeechSendResult>
  waitForReady: (timeoutMs?: number) => Promise<boolean>
  getSnapshot: () => AvatarRuntimeSnapshot
  interrupt: () => void
}

export interface AvatarSpeechSendResult {
  sent: boolean
  conversationIdReturned: boolean
  playingObserved: boolean
  shouldFallback: boolean
  fallbackReason?: string
}

export type AvatarRuntimeDestroyReason =
  | 'component-unmount'
  | 'reset-demo'
  | 'disconnect-avatar'
  | 'reconnect'
  | 'error-cleanup'
  | 'unknown'
