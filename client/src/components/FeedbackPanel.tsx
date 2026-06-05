import type { Feedback, Report } from '../types/interview'

interface FeedbackPanelProps {
  currentFeedback: Feedback | null
  report: Report | null
  round: number
  canEnd: boolean
}

function FeedbackPanel({
  currentFeedback,
  report,
  round,
  canEnd,
}: FeedbackPanelProps) {
  return (
    <aside className="panel feedback-panel" aria-label="Interview feedback">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Evaluation</p>
          <h2>Feedback</h2>
        </div>
      </div>

      <div className="score-card">
        <span>Current Score</span>
        <strong>{currentFeedback ? currentFeedback.score : '--'}</strong>
        <p>{currentFeedback ? 'Latest answer score' : 'Score appears after answer'}</p>
      </div>

      <div className="meta-grid">
        <div>
          <span>Round</span>
          <strong>{round}/3</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{canEnd ? 'Ready to end' : 'In progress'}</strong>
        </div>
      </div>

      <div className="feedback-copy">
        <h3>Latest Feedback</h3>
        <p>{currentFeedback?.feedback ?? 'Submit an answer to receive mock feedback.'}</p>
        <h3>Suggestion</h3>
        <p>{currentFeedback?.suggestion ?? 'Ava will suggest how to improve your response.'}</p>
      </div>

      <div className="report-summary">
        <h3>Final Report</h3>
        {report ? (
          <>
            <div className="overall-score">
              <span>Overall Score</span>
              <strong>{report.overallScore}</strong>
            </div>
            <List title="Strengths" items={report.strengths} />
            <List title="Weaknesses" items={report.weaknesses} />
            <List title="Suggestions" items={report.suggestions} />
          </>
        ) : (
          <p>End the interview to generate a final mock report.</p>
        )}
      </div>
    </aside>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="report-list">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default FeedbackPanel
