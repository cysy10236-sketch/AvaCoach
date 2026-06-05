import type { InterviewRole, InterviewStage } from '../types/interview'

interface ControlPanelProps {
  answer: string
  error: string | null
  isBusy: boolean
  role: InterviewRole
  stage: InterviewStage
  canEnd: boolean
  onAnswerChange: (value: string) => void
  onEnd: () => void
  onReset: () => void
  onRoleChange: (role: InterviewRole) => void
  onStart: () => void
  onSubmit: () => void
}

const roles: { value: InterviewRole; label: string }[] = [
  { value: 'frontend', label: 'Frontend Engineer' },
  { value: 'product', label: 'Product Manager' },
  { value: 'ai', label: 'AI Engineer' },
  { value: 'behavioral', label: 'General Behavioral' },
]

function ControlPanel({
  answer,
  error,
  isBusy,
  role,
  stage,
  canEnd,
  onAnswerChange,
  onEnd,
  onReset,
  onRoleChange,
  onStart,
  onSubmit,
}: ControlPanelProps) {
  const canStart = stage === 'idle' || stage === 'finished'
  const canSubmit = stage === 'answering' && answer.trim().length > 0 && !isBusy
  const canUseEnd = (canEnd || stage === 'answering' || stage === 'asking') && !isBusy

  return (
    <section className="control-panel" aria-label="Interview controls">
      <label>
        <span>Role</span>
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

      <label className="answer-input">
        <span>Your Answer</span>
        <textarea
          disabled={stage !== 'answering' || isBusy}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="Type your answer here..."
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
          Start Interview
        </button>
        <button disabled={!canSubmit} onClick={onSubmit} type="button">
          Submit Answer
        </button>
        <button disabled={!canUseEnd} onClick={onEnd} type="button">
          End Interview
        </button>
        <button className="secondary" disabled={isBusy} onClick={onReset} type="button">
          Reset Demo
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}

export default ControlPanel
