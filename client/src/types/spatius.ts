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
  | 'placeholder'

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
  speakPcm: (pcmArrayBuffer: ArrayBuffer) => Promise<void>
  interrupt: () => void
  destroy: (reason?: AvatarRuntimeDestroyReason) => void
}

export type AvatarSpeechSender = (pcmArrayBuffer: ArrayBuffer) => Promise<void>

export type AvatarRuntimeDestroyReason =
  | 'component-unmount'
  | 'reset-demo'
  | 'disconnect-avatar'
  | 'reconnect'
  | 'error-cleanup'
  | 'unknown'
