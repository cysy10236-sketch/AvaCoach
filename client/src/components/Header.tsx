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
        {formatMode(source, provider)}
      </span>
    </header>
  )
}

function formatMode(source: ResponseSource, provider: LlmProvider) {
  if (source === 'bank') {
    return 'IT 题库模式'
  }

  return source === 'llm' ? `AI 模式: ${formatProvider(provider)}` : 'Mock fallback 模式'
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
