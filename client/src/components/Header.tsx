import type { LlmProvider, InterviewRole, ResponseSource } from '../types/interview'
import type { VoiceMode } from '../services/speechPlayer'
import type { SpatiusRuntimeStatus } from '../types/spatius'

type AsrMode = 'stream' | 'browser' | 'mock' | 'unavailable'

interface HeaderProps {
  asrMode: AsrMode
  provider: LlmProvider
  role: InterviewRole
  source: ResponseSource
  spatiusStatus: SpatiusRuntimeStatus
  voiceMode: VoiceMode
}

function Header({
  asrMode,
  provider,
  role,
  source,
  spatiusStatus,
  voiceMode,
}: HeaderProps) {
  const avatarConnected = isAvatarConnected(spatiusStatus)

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">A</div>
        <div className="brand-copy">
          <strong>AvaCoach</strong>
          <h1>中文 AI 数字人模拟面试训练系统</h1>
          <p>AI 数字人面试官 · 语音交互 · 技术面试反馈</p>
        </div>
      </div>

      <div className="topbar-status" aria-label="系统状态">
        <StatusBadge label={`LLM ${formatProvider(provider)}`} tone={source === 'mock' ? 'warn' : 'ok'} />
        <StatusBadge label={voiceMode === 'avatar-tts' ? 'TTS Volcano' : 'TTS Fallback'} tone={voiceMode === 'silent' ? 'muted' : 'ok'} />
        <StatusBadge label={asrMode === 'stream' ? 'ASR Volcano Streaming' : 'ASR Fallback'} tone={asrMode === 'unavailable' ? 'muted' : 'ok'} />
        <StatusBadge label={avatarConnected ? 'Avatar 已连接' : 'Avatar Fallback'} tone={avatarConnected ? 'ok' : 'muted'} />
      </div>

      <div className="topbar-context">
        <span className="mode-pill">{formatMode(source, provider)}</span>
        <span className="mode-pill subtle">当前岗位：{formatRole(role)}</span>
        <span className="candidate-entry">候选人</span>
      </div>
    </header>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'muted' }) {
  return (
    <span className={`status-chip status-chip-${tone}`}>
      <span className="chip-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function isAvatarConnected(status: SpatiusRuntimeStatus) {
  return status.connectionState === 'connected' || status.connectionState === 'avatar_connected'
}

function formatMode(source: ResponseSource, provider: LlmProvider) {
  if (source === 'bank') {
    return '模拟面试模式 · IT 题库'
  }

  return source === 'llm'
    ? `模拟面试模式 · ${formatProvider(provider)}`
    : '模拟面试模式 · Mock Fallback'
}

function formatProvider(provider: LlmProvider) {
  if (provider === 'deepseek') {
    return 'DeepSeek'
  }

  if (provider === 'openai') {
    return 'OpenAI'
  }

  return 'Mock'
}

function formatRole(role: InterviewRole) {
  const labels: Record<InterviewRole, string> = {
    ai: 'AI Engineer',
    backend: 'Backend Engineer',
    behavioral: 'Behavioral',
    frontend: 'Frontend Engineer',
    product: 'Product Manager',
  }

  return labels[role]
}

export default Header
