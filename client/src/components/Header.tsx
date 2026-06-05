import type { LlmProvider, ResponseSource } from '../types/interview'

interface HeaderProps {
  provider: LlmProvider
  source: ResponseSource
}

function Header({ provider, source }: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">AvaCoach</p>
        <h1>AI Digital Human Mock Interviewer</h1>
      </div>
      <span className="mode-pill">
        {source === 'llm' ? `AI Mode: ${formatProvider(provider)}` : 'Mock Fallback Mode'}
      </span>
    </header>
  )
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

export default Header
