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
  disconnected: 'Disconnected',
  error: 'SDK Error',
  not_configured: 'Not Configured',
  placeholder: 'Placeholder',
  avatar_speaking: 'Avatar Speaking',
  avatar_speech_failed: 'Speech Failed',
  avatar_speech_finished: 'Listening',
  avatar_speech_sending: 'Speech Sending',
  avatar_loaded: 'Avatar Loaded',
  avatar_loading: 'Avatar Loading',
  motion_server_connected: 'Motion Connected',
  render_ready: 'Render Ready',
  sample_audio_failed: 'Sample Failed',
  sample_audio_finished: 'Sample Finished',
  sample_audio_loading: 'Sample Loading',
  sample_audio_playing: 'Sample Playing',
  sample_audio_sending: 'Sample Sending',
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
  browser: 'Browser Speech',
  silent: 'Silent Text',
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
    <section className="panel avatar-panel" aria-label="数字人面试官">
      <div className="panel-heading compact">
        <div className="section-title">
          <span className="section-icon">●</span>
          <h2>数字人面试官</h2>
        </div>
        <span className={`status-badge status-${status}`}>
          当前状态：{statusLabels[status]}
        </span>
      </div>

      <AvatarStage
        onAvatarSpeechReady={onAvatarSpeechReady}
        onSampleVoiceMode={onSampleVoiceMode}
        onStatusChange={handleStatusChange}
      />

      <div className="avatar-meta-row">
        <Metric label="Spatius" value={spatiusStateLabels[spatiusStatus.connectionState]} />
        <Metric label="Token" value={tokenStateLabels[spatiusStatus.tokenState]} />
        <Metric label="Voice" value={voiceModeLabels[voiceMode]} />
      </div>
      <p className="avatar-note">{spatiusStatus.message}</p>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="avatar-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default AvatarPanel
