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
    <section className="panel interview-panel" aria-label="Interview conversation">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live Interview</p>
          <h2>Conversation</h2>
        </div>
        <span className="stage-pill">{stage}</span>
      </div>

      <div className="message-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Ready when you are.</h3>
            <p>
              Choose a role and start the interview. Ava will open the session,
              ask the first question, and give feedback after each answer.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={`message-bubble message-${message.speaker}`}
              key={message.id}
            >
              <span>
                {message.speaker === 'interviewer' ? 'Ava' : 'Candidate'} ·{' '}
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default InterviewPanel
