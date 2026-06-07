import type {
  InterviewRole,
  InterviewStage,
  InterviewFlowStatus,
  QuestionDifficulty,
  QuestionSource,
} from '../types/interview'

type AsrMode = 'stream' | 'browser' | 'mock' | 'unavailable'

interface ControlPanelProps {
  answer: string
  asrError: string | null
  asrMode: AsrMode
  asrSupported: boolean
  disableVoiceInput: boolean
  error: string | null
  isBusy: boolean
  isRecording: boolean
  isTranscribing: boolean
  interviewStatus: InterviewFlowStatus
  role: InterviewRole
  stage: InterviewStage
  canEnd: boolean
  difficulty: QuestionDifficulty
  questionSource: QuestionSource
  topic: string
  topics: string[]
  transcript: string
  onAnswerChange: (value: string) => void
  onClearTranscript: () => void
  onDifficultyChange: (difficulty: QuestionDifficulty) => void
  onEnd: () => void
  onQuestionSourceChange: (source: QuestionSource) => void
  onReset: () => void
  onRoleChange: (role: InterviewRole) => void
  onStart: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onSubmit: () => void
  onTopicChange: (topic: string) => void
  onUseTranscript: () => void
}

const roles: { value: InterviewRole; label: string }[] = [
  { value: 'frontend', label: '前端工程师' },
  { value: 'backend', label: '后端工程师' },
  { value: 'product', label: '产品经理' },
  { value: 'ai', label: 'AI 工程师' },
  { value: 'behavioral', label: '通用行为面试' },
]

const difficulties: { value: QuestionDifficulty; label: string }[] = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

function ControlPanel({
  answer,
  asrError,
  asrMode,
  asrSupported,
  disableVoiceInput,
  error,
  isBusy,
  isRecording,
  isTranscribing,
  interviewStatus,
  role,
  stage,
  canEnd,
  difficulty,
  questionSource,
  topic,
  topics,
  transcript,
  onAnswerChange,
  onClearTranscript,
  onDifficultyChange,
  onEnd,
  onQuestionSourceChange,
  onReset,
  onRoleChange,
  onStart,
  onStartRecording,
  onStopRecording,
  onSubmit,
  onTopicChange,
  onUseTranscript,
}: ControlPanelProps) {
  const canStart = interviewStatus !== 'ended' && (stage === 'idle' || stage === 'finished')
  const canSubmit =
    interviewStatus !== 'ended' &&
    stage === 'answering' &&
    answer.trim().length > 0 &&
    !isBusy &&
    !isRecording &&
    !isTranscribing
  const canUseEnd = (canEnd || stage === 'answering' || stage === 'asking') && !isBusy
  const canStartRecording =
    interviewStatus !== 'ended' &&
    stage === 'answering' &&
    asrSupported &&
    !disableVoiceInput &&
    !isBusy &&
    !isRecording &&
    !isTranscribing
  const asrStatus = getAsrStatus({
    asrMode,
    disableVoiceInput,
    isRecording,
    isTranscribing,
    transcript,
  })

  return (
    <>
      <aside className="panel control-panel" aria-label="面试配置与操作">
        <section className="side-card config-card">
          <div className="section-title">
            <span className="section-icon">▣</span>
            <h2>面试配置</h2>
          </div>

          <label className="field">
            <span>岗位选择</span>
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

          <div className="field">
            <span>问题来源</span>
            <div className="segmented-control">
              <button
                className={questionSource === 'llm' ? 'selected' : ''}
                disabled={!canStart || isBusy}
                onClick={() => onQuestionSourceChange('llm')}
                type="button"
              >
                AI 生成
              </button>
              <button
                className={questionSource === 'bank' ? 'selected' : ''}
                disabled={!canStart || isBusy}
                onClick={() => onQuestionSourceChange('bank')}
                type="button"
              >
                IT 题库
              </button>
            </div>
          </div>

          <label className="field">
            <span>难度选择</span>
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

          {questionSource === 'bank' ? (
            <label className="field">
              <span>知识点 / Topic</span>
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
              <div className="topic-tags">
                {(topic ? [topic] : topics.slice(0, 8)).map((item) => (
                  <span className="topic-pill" key={item}>
                    {item}
                  </span>
                ))}
                {topics.length === 0 ? <span className="topic-pill muted">等待题库</span> : null}
              </div>
            </label>
          ) : null}
        </section>

        <section className="side-card action-card">
          <div className="section-title">
            <span className="section-icon">⚡</span>
            <h2>面试操作</h2>
          </div>
          <div className="button-row">
            <button
              className="primary-action"
              disabled={!canStart || isBusy}
              onClick={onStart}
              type="button"
            >
              {isBusy && stage === 'opening' ? '生成问题中...' : 'Start Interview'}
            </button>
            <button
              className={answer.trim() ? 'submit-action submit-action-hot' : 'submit-action'}
              disabled={!canSubmit}
              onClick={onSubmit}
              type="button"
            >
              {isBusy && stage === 'evaluating' ? '提交中...' : 'Submit Answer'}
            </button>
            <button
              className="end-action"
              disabled={!canUseEnd}
              onClick={onEnd}
              type="button"
            >
              End Interview
            </button>
            <button className="reset-action" disabled={isBusy} onClick={onReset} type="button">
              Reset Demo
            </button>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </aside>

      <section className="panel answer-panel" aria-label="回答输入与语音控制">
        <div className="answer-input-card">
          <div className="answer-card-header">
            <div>
              <span className="micro-label">候选人回答</span>
              <strong>输入或编辑回答</strong>
            </div>
            <span className={answer.trim() ? 'answer-ready-badge ready' : 'answer-ready-badge'}>
              {answer.trim() ? 'Ready to submit' : 'Waiting for answer'}
            </span>
          </div>
          <textarea
            disabled={stage !== 'answering' || isBusy || isRecording}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="在此补充或修改你的回答，也可以先使用语音识别自动填入。"
            value={answer}
          />
        </div>

        <div className="voice-answer-tools" aria-label="候选人语音回答">
          <div className="voice-meter">
            <span className={isRecording ? 'record-dot active' : 'record-dot'} />
            <div className="voice-state-copy">
              <strong>{asrStatus}</strong>
              <p>Volcano Streaming ASR · PCM16 / 16kHz / mono</p>
            </div>
            <div className={isRecording ? 'waveform waveform-active' : 'waveform'} aria-hidden="true">
              {Array.from({ length: 26 }).map((_, index) => (
                <span key={index} style={{ height: `${18 + ((index * 7) % 30)}px` }} />
              ))}
            </div>
          </div>

          <div className="voice-actions">
            <button
              className="voice-primary"
              disabled={!canStartRecording}
              onClick={onStartRecording}
              type="button"
            >
              开始语音回答
            </button>
            <button
              className="voice-stop"
              disabled={!isRecording}
              onClick={onStopRecording}
              type="button"
            >
              停止录音
            </button>
            <button
              className="secondary"
              disabled={!transcript || isRecording || isTranscribing}
              onClick={onUseTranscript}
              type="button"
            >
              使用识别文本
            </button>
            <button
              className="secondary"
              disabled={!transcript || isRecording || isTranscribing}
              onClick={onClearTranscript}
              type="button"
            >
              清空识别文本
            </button>
          </div>
        </div>

        <div className="transcript-card">
          <div className="transcript-heading">
            <div>
              <strong>实时识别文本</strong>
              <span>{transcript ? 'Final / Partial Ready' : '等待语音输入'}</span>
            </div>
            <span className={transcript ? 'transcript-state ready' : 'transcript-state'}>
              {transcript ? '已识别' : '空'}
            </span>
          </div>
          <p>{transcript || '开始语音回答后，识别文本会实时显示在这里，并同步填入回答框。'}</p>
          {asrError ? <p className="asr-error">{asrError}</p> : null}
        </div>

        <div className="answer-submit-dock">
          <button
            className={answer.trim() ? 'submit-action main-submit ready' : 'submit-action main-submit'}
            disabled={!canSubmit}
            onClick={onSubmit}
            type="button"
          >
            {isBusy && stage === 'evaluating' ? '提交中...' : 'Submit Answer'}
          </button>
          <p>确认回答后再提交，系统会生成追问、评分与知识点反馈。</p>
        </div>
      </section>
    </>
  )
}

function getAsrStatus({
  asrMode,
  disableVoiceInput,
  isRecording,
  isTranscribing,
  transcript,
}: {
  asrMode: AsrMode
  disableVoiceInput: boolean
  isRecording: boolean
  isTranscribing: boolean
  transcript: string
}): string {
  if (isRecording) {
    return transcript ? 'Partial Transcript' : 'Recording'
  }

  if (isTranscribing) {
    return 'Recognizing'
  }

  if (disableVoiceInput) {
    return '请等数字人说完后再录音'
  }

  if (asrMode === 'stream') {
    return transcript ? 'Final Transcript Ready' : 'Streaming ASR Ready'
  }

  if (asrMode === 'browser') {
    return transcript ? 'Browser ASR Ready' : 'Browser Speech Ready'
  }

  if (asrMode === 'mock') {
    return 'ASR Fallback'
  }

  return 'Manual Input'
}

export default ControlPanel
