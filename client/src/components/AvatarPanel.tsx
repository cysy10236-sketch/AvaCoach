import { useCallback } from 'react'
import AvatarStage from './AvatarStage'
import type { AvatarStatus } from '../types/interview'
import type { VoiceMode } from '../services/speechPlayer'
import type { AvatarSpeechSender, SpatiusRuntimeStatus } from '../types/spatius'

interface AvatarPanelProps {
  status: AvatarStatus
  spatiusStatus: SpatiusRuntimeStatus
  voiceMode: VoiceMode
  onAvatarSpeechReady: (sender: AvatarSpeechSender | null, interrupt: (() => void) | null) => void
  onSampleVoiceMode: () => void
  onSpatiusStatusChange: (status: SpatiusRuntimeStatus) => void
}

const statusLabels: Record<AvatarStatus, string> = {
  idle: 'Idle',
  speaking: 'Speaking',
  listening: 'Listening',
  evaluating: 'Evaluating',
}

const spatiusStateLabels: Record<SpatiusRuntimeStatus['connectionState'], string> = {
  avatar_connected: 'Avatar Connected',
  connected: 'Avatar Connected',
  error: 'SDK Error',
  not_configured: 'Not Configured',
  placeholder: 'Placeholder Mode',
  avatar_speaking: 'Avatar Speaking',
  avatar_speech_failed: 'SDK Error',
  avatar_speech_finished: 'Listening',
  avatar_speech_sending: 'Avatar Speaking',
  avatar_loaded: 'Avatar Loaded',
  avatar_loading: 'Avatar Loading',
  motion_server_connected: 'Motion Server Connected',
  render_ready: 'Render Ready',
  sample_audio_failed: 'Sample Audio Failed',
  sample_audio_finished: 'Sample Audio Finished',
  sample_audio_loading: 'Sample Audio Loading',
  sample_audio_playing: 'Sample Audio Playing',
  sample_audio_sending: 'Sample Audio Sending',
  sdk_ready: 'SDK Ready',
  sdk_loading: 'SDK Loading',
  token_not_checked: 'Not Checked',
  token_fallback: 'Token Fallback',
  token_loading: 'Token Loading',
}

const tokenStateLabels: Record<SpatiusRuntimeStatus['tokenState'], string> = {
  'direct-ready': 'Direct Ready',
  'expired-invalid': 'Expired / Invalid',
  fallback: 'Fallback',
  'not-checked': 'Not Checked',
}

const voiceModeLabels: Record<VoiceMode, string> = {
  'avatar-tts': 'Avatar TTS Lip-Sync',
  'sample-pcm': 'Sample PCM',
  tts: 'TTS Audio',
  browser: 'Browser Speech Fallback',
  silent: 'Silent Text Mode',
}

function AvatarPanel({
  status,
  spatiusStatus,
  voiceMode,
  onAvatarSpeechReady,
  onSampleVoiceMode,
  onSpatiusStatusChange,
}: AvatarPanelProps) {
  const handleStatusChange = useCallback(
    (nextStatus: SpatiusRuntimeStatus) => {
      onSpatiusStatusChange(nextStatus)
    },
    [onSpatiusStatusChange],
  )

  return (
    <section className="panel avatar-panel" aria-label="Digital human interviewer">
      <div className="panel-heading">
        <p className="eyebrow">Digital Human Interviewer</p>
        <span className={`status-badge status-${status}`}>
          {statusLabels[status]}
        </span>
      </div>

      <AvatarStage
        onAvatarSpeechReady={onAvatarSpeechReady}
        onSampleVoiceMode={onSampleVoiceMode}
        onStatusChange={handleStatusChange}
      />

      <div className="avatar-note">
        <strong>Spatius: {spatiusStateLabels[spatiusStatus.connectionState]}</strong>
        <span>{spatiusStatus.message}</span>
      </div>
      <div className="spatius-token-state">
        <span>Token</span>
        <strong>{tokenStateLabels[spatiusStatus.tokenState]}</strong>
      </div>
      <div className="spatius-token-state">
        <span>Voice</span>
        <strong>{voiceModeLabels[voiceMode]}</strong>
      </div>
    </section>
  )
}

export default AvatarPanel
