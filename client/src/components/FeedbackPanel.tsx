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
          <h2>面试反馈</h2>
        </div>
      </div>

      <div className="score-card">
        <span>当前评分</span>
        <strong>{currentFeedback ? currentFeedback.score : '--'}</strong>
        <p>{currentFeedback ? '最近一轮回答评分' : '提交回答后显示评分'}</p>
      </div>

      <div className="meta-grid">
        <div>
          <span>轮次</span>
          <strong>{round}/3</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{canEnd ? '可结束' : '进行中'}</strong>
        </div>
      </div>

      <div className="feedback-copy">
        <h3>最近反馈</h3>
        <p>{currentFeedback?.feedback ?? '提交回答后，Ava 会给出面试反馈。'}</p>
        <h3>改进建议</h3>
        <p>{currentFeedback?.suggestion ?? 'Ava 会提示你如何优化回答结构和内容。'}</p>
        {currentFeedback?.knowledgeFeedback ? (
          <div className="knowledge-feedback">
            <List title="已覆盖要点" items={currentFeedback.knowledgeFeedback.coveredPoints} />
            <List title="缺失要点" items={currentFeedback.knowledgeFeedback.missingPoints} />
            <List title="改进建议" items={currentFeedback.knowledgeFeedback.improvementTips} />
          </div>
        ) : null}
      </div>

      <div className="report-summary">
        <h3>最终报告</h3>
        {report ? (
          <>
            <div className="overall-score">
              <span>综合评分</span>
              <strong>{report.overallScore}</strong>
            </div>
            <List title="优势" items={report.strengths} />
            <List title="不足" items={report.weaknesses} />
            <List title="建议" items={report.suggestions} />
            {report.bankReport ? (
              <>
                <List title="优势知识点" items={report.bankReport.strongTopics} />
                <List title="薄弱知识点" items={report.bankReport.weakTopics} />
                <List
                  title="遗漏知识点"
                  items={report.bankReport.missedKnowledgePoints}
                />
                <List
                  title="推荐练习方向"
                  items={report.bankReport.recommendedPracticeTopics}
                />
              </>
            ) : null}
          </>
        ) : (
          <p>结束面试后会生成最终报告。</p>
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
