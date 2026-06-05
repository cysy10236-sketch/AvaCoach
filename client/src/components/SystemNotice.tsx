import type { VoiceMode } from '../services/speechPlayer'
import type { SpatiusRuntimeStatus } from '../types/spatius'

interface SystemNoticeProps {
  error: string | null
  spatiusStatus: SpatiusRuntimeStatus
  voiceMode: VoiceMode
}

function SystemNotice({ error, spatiusStatus, voiceMode }: SystemNoticeProps) {
  const notices = Array.from(new Set([
    spatiusStatus.connectionState === 'connected'
      ? 'Spatius real avatar is connected.'
      : spatiusStatus.connectionState === 'not_configured'
        ? 'Avatar SDK not configured. Placeholder demo remains usable.'
        : spatiusStatus.connectionState === 'error'
          ? 'Avatar SDK failed, fallback demo remains usable.'
          : 'Avatar placeholder is available while SDK connection is pending.',
    voiceMode === 'avatar-tts'
      ? 'Avatar TTS Lip-Sync is active for interviewer replies.'
      : voiceMode === 'sample-pcm'
        ? 'Sample PCM mode validates AvatarKit audio driving.'
        : voiceMode === 'silent'
          ? 'Fallback demo is active. The interview flow remains fully usable.'
          : voiceMode === 'browser'
            ? 'Browser speech fallback is active. It does not drive avatar lip-sync.'
            : 'TTS audio is active for interviewer replies.',
    error,
  ].filter((notice): notice is string => Boolean(notice))))

  return (
    <section className="system-notice" aria-label="Demo status">
      {notices.map((notice) => (
        <p key={notice}>{notice}</p>
      ))}
    </section>
  )
}

export default SystemNotice
