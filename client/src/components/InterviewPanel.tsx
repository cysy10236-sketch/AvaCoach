import { useEffect, useRef } from 'react'
import type { InterviewStage, Message } from '../types/interview'

interface InterviewPanelProps {
  messages: Message[]
  stage: InterviewStage
}

function InterviewPanel({ messages, stage }: InterviewPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  return (
    <section className="panel interview-panel" aria-label="面试对话">
      <div className="panel-heading compact">
        <div className="section-title">
          <span className="section-icon">▦</span>
          <h2>面试对话</h2>
        </div>
        <span className="stage-pill">{formatStage(stage)}</span>
      </div>

      <div className="message-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>准备开始面试</h3>
            <p>选择岗位与题目来源后，Ava 会开始提问，并在每轮回答后生成追问与反馈。</p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={`message-bubble message-${message.speaker}`}
              key={message.id}
            >
              <span>
                {message.speaker === 'interviewer' ? '面试官 Ava' : '候选人'} ·{' '}
                {formatTime(message.timestamp)}
              </span>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function formatStage(stage: InterviewStage) {
  const labels: Record<InterviewStage, string> = {
    answering: '回答中',
    asking: '提问中',
    evaluating: '评估中',
    finished: '已完成',
    idle: '待开始',
    opening: '开场中',
  }

  return labels[stage]
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default InterviewPanel
