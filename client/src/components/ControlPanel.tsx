import type {
  InterviewRole,
  InterviewStage,
  QuestionDifficulty,
  QuestionSource,
} from '../types/interview'

interface ControlPanelProps {
  answer: string
  error: string | null
  isBusy: boolean
  role: InterviewRole
  stage: InterviewStage
  canEnd: boolean
  difficulty: QuestionDifficulty
  questionSource: QuestionSource
  topic: string
  topics: string[]
  onAnswerChange: (value: string) => void
  onDifficultyChange: (difficulty: QuestionDifficulty) => void
  onEnd: () => void
  onQuestionSourceChange: (source: QuestionSource) => void
  onReset: () => void
  onRoleChange: (role: InterviewRole) => void
  onStart: () => void
  onSubmit: () => void
  onTopicChange: (topic: string) => void
}

const roles: { value: InterviewRole; label: string }[] = [
  { value: 'frontend', label: 'Frontend Engineer' },
  { value: 'backend', label: 'Backend Engineer' },
  { value: 'product', label: 'Product Manager' },
  { value: 'ai', label: 'AI Engineer' },
  { value: 'behavioral', label: 'General Behavioral' },
]

const difficulties: { value: QuestionDifficulty; label: string }[] = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

function ControlPanel({
  answer,
  error,
  isBusy,
  role,
  stage,
  canEnd,
  difficulty,
  questionSource,
  topic,
  topics,
  onAnswerChange,
  onDifficultyChange,
  onEnd,
  onQuestionSourceChange,
  onReset,
  onRoleChange,
  onStart,
  onSubmit,
  onTopicChange,
}: ControlPanelProps) {
  const canStart = stage === 'idle' || stage === 'finished'
  const canSubmit = stage === 'answering' && answer.trim().length > 0 && !isBusy
  const canUseEnd = (canEnd || stage === 'answering' || stage === 'asking') && !isBusy

  return (
    <section className="control-panel" aria-label="Interview controls">
      <div className="control-options">
        <label>
          <span>岗位</span>
          <select
            disabled={!canStart || isBusy}
            onChange={(event) => onRoleChange(event.target.value as InterviewRole)}
            value={role}
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>问题来源</span>
          <select
            disabled={!canStart || isBusy}
            onChange={(event) => onQuestionSourceChange(event.target.value as QuestionSource)}
            value={questionSource}
          >
            <option value="llm">AI 生成</option>
            <option value="bank">IT 题库</option>
          </select>
        </label>

        {questionSource === 'bank' ? (
          <div className="bank-options">
            <label>
              <span>难度</span>
              <select
                disabled={!canStart || isBusy}
                onChange={(event) => onDifficultyChange(event.target.value as QuestionDifficulty)}
                value={difficulty}
              >
                {difficulties.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>知识点</span>
              <select
                disabled={!canStart || isBusy || topics.length === 0}
                onChange={(event) => onTopicChange(event.target.value)}
                value={topic}
              >
                <option value="">任意知识点</option>
                {topics.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <label className="answer-input">
        <span>你的回答</span>
        <textarea
          disabled={stage !== 'answering' || isBusy}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="请输入你的回答..."
          value={answer}
        />
      </label>

      <div className="button-row">
        <button
          className="primary-action"
          disabled={!canStart || isBusy}
          onClick={onStart}
          type="button"
        >
          开始面试
        </button>
        <button disabled={!canSubmit} onClick={onSubmit} type="button">
          提交回答
        </button>
        <button disabled={!canUseEnd} onClick={onEnd} type="button">
          结束面试
        </button>
        <button className="secondary" disabled={isBusy} onClick={onReset} type="button">
          重置 Demo
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}

export default ControlPanel
