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
  const coveredPoints = currentFeedback?.knowledgeFeedback?.coveredPoints ?? []
  const missingPoints = currentFeedback?.knowledgeFeedback?.missingPoints ?? []
  const tips =
    currentFeedback?.knowledgeFeedback?.improvementTips ??
    (currentFeedback?.suggestion ? [currentFeedback.suggestion] : [])
  const scoreLabel = getScoreLabel(currentFeedback?.score)

  return (
    <aside className="panel feedback-panel" aria-label="反馈与报告">
      <div className="panel-heading compact">
        <div className="section-title">
          <span className="section-icon">◆</span>
          <h2>反馈与报告</h2>
        </div>
        <span className="stage-pill">{canEnd ? '可生成报告' : `第 ${round}/3 轮`}</span>
      </div>

      <div className="feedback-scroll">
        <section className="score-card">
          <div className="score-ring">
            <span>当前评分</span>
            <strong>{currentFeedback ? currentFeedback.score : '--'}</strong>
            <small>/ 100</small>
          </div>
          <div className="score-copy">
            <h3>综合评价</h3>
            <p>{currentFeedback?.feedback ?? '提交回答后，Ava 会给出本轮综合评价、覆盖要点和改进建议。'}</p>
            <p className="muted-copy">{scoreLabel}</p>
          </div>
        </section>

        {currentFeedback?.scoringReason ? (
          <section className="feedback-copy">
            <List
              title="评分依据"
              tone="neutral"
              items={[currentFeedback.scoringReason]}
            />
          </section>
        ) : null}

        <section className="points-grid">
          <List
            title={`已覆盖要点 ${coveredPoints.length ? `(${coveredPoints.length})` : ''}`}
            tone="ok"
            items={coveredPoints}
            empty="等待候选人回答后生成。"
          />
          <List
            title={`缺失要点 ${missingPoints.length ? `(${missingPoints.length})` : ''}`}
            tone="danger"
            items={missingPoints}
            empty="暂无明显缺失。"
          />
        </section>

        <section className="feedback-copy">
          <List
            title="改进建议"
            tone="idea"
            items={tips}
            empty="Ava 会提示如何优化回答结构、细节和结果表达。"
          />
        </section>

        <section className="report-summary">
          <div className="report-heading">
            <div>
              <h3>最终报告</h3>
              <p>{report ? 'Report Ready' : 'Pending until interview ends'}</p>
            </div>
            <span className={report ? 'report-state ready' : 'report-state'}>{report ? 'Ready' : 'Pending'}</span>
          </div>

          {report ? (
            <>
              <div className="overall-score">
                <span>综合评分</span>
                <strong>{report.overallScore}</strong>
              </div>
              <List title="强项" tone="ok" items={report.strengths} />
              <List title="薄弱项" tone="danger" items={report.weaknesses} />
              <List title="推荐练习方向" tone="idea" items={report.suggestions} />
              {report.bankReport ? (
                <>
                  <List title="优势知识点" tone="ok" items={report.bankReport.strongTopics} />
                  <List title="薄弱知识点" tone="danger" items={report.bankReport.weakTopics} />
                  <List title="遗漏知识点" tone="danger" items={report.bankReport.missedKnowledgePoints} />
                  <List title="推荐练习主题" tone="idea" items={report.bankReport.recommendedPracticeTopics} />
                </>
              ) : null}
            </>
          ) : (
            <p className="muted-copy">点击 End Interview 后，这里会生成结构化报告，不会改变页面整体布局。</p>
          )}
        </section>
      </div>

      <div className="report-actions">
        <button className="secondary" disabled title="Coming Soon" type="button">
          下载报告 PDF (Coming Soon)
        </button>
        <button className="secondary" disabled title="Coming Soon" type="button">
          分享报告 (Coming Soon)
        </button>
      </div>
    </aside>
  )
}

function List({
  empty = '暂无内容。',
  items,
  title,
  tone = 'neutral',
}: {
  empty?: string
  items: string[]
  title: string
  tone?: 'ok' | 'danger' | 'idea' | 'neutral'
}) {
  return (
    <div className={`report-list report-list-${tone}`}>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">{empty}</p>
      )}
    </div>
  )
}

function getScoreLabel(score?: number): string {
  if (typeof score !== 'number') {
    return '等待提交回答后生成评分。'
  }

  if (score <= 39) {
    return '需要补充基础'
  }

  if (score <= 59) {
    return '基础较弱'
  }

  if (score <= 74) {
    return '基本合格'
  }

  if (score <= 89) {
    return '表现良好'
  }

  return '表现优秀'
}

export default FeedbackPanel
