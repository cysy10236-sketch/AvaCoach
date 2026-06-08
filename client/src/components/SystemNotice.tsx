import type { VoiceMode } from '../services/speechPlayer'
import type { InterviewFlowStatus } from '../types/interview'
import type { SpatiusRuntimeStatus } from '../types/spatius'

type AsrMode = 'stream' | 'browser' | 'mock' | 'unavailable'

interface SystemNoticeProps {
  asrError: string | null
  asrMode: AsrMode
  interviewStatus: InterviewFlowStatus
  interviewError: string | null
  isRecording: boolean
  isTranscribing: boolean
  spatiusStatus: SpatiusRuntimeStatus
  voiceMode: VoiceMode
  voiceNotice: string | null
}

function SystemNotice({
  asrError,
  asrMode,
  interviewStatus,
  interviewError,
  isRecording,
  isTranscribing,
  spatiusStatus,
  voiceMode,
  voiceNotice,
}: SystemNoticeProps) {
  const primaryNotice = interviewError
    ? interviewError
    : interviewStatus === 'ended'
      ? '面试流程已结束，请生成最终报告或 Reset Demo 后重新开始。'
      : voiceNotice || getAsrNotice(asrMode, isRecording, isTranscribing)
  const notices = [
    primaryNotice,
    isAvatarConnected(spatiusStatus)
      ? 'Avatar 已连接，数字人渲染与口型同步可用。'
      : 'Avatar fallback 可用，面试流程保持稳定。',
    getVoiceNotice(voiceMode),
    asrError,
  ].filter((notice): notice is string => Boolean(notice))

  return (
    <section className="system-notice" aria-label="系统状态">
      {Array.from(new Set(notices)).slice(0, 4).map((notice) => (
        <p key={notice}>{notice}</p>
      ))}
    </section>
  )
}

function isAvatarConnected(status: SpatiusRuntimeStatus) {
  return status.connectionState === 'connected' || status.connectionState === 'avatar_connected'
}

function getVoiceNotice(voiceMode: VoiceMode) {
  if (voiceMode === 'avatar-tts') {
    return 'Voice: Avatar TTS Lip-Sync'
  }

  if (voiceMode === 'sample-pcm') {
    return 'Voice: Sample PCM 验证模式'
  }

  if (voiceMode === 'browser') {
    return 'Voice: 浏览器语音 fallback，不驱动口型'
  }

  return 'Voice: 文本模式 fallback'
}

function getAsrNotice(
  asrMode: AsrMode,
  isRecording: boolean,
  isTranscribing: boolean,
): string {
  if (isRecording) {
    return 'ASR: Recording / Partial Transcript'
  }

  if (isTranscribing) {
    return 'ASR: Recognizing / Waiting Final'
  }

  if (asrMode === 'stream') {
    return 'ASR: Volcano Streaming Ready'
  }

  if (asrMode === 'browser') {
    return 'ASR: Browser Speech Ready'
  }

  if (asrMode === 'mock') {
    return 'ASR: Fallback Active'
  }

  return 'ASR: Manual Input'
}

export default SystemNotice
