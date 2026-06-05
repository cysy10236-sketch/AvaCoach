import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import AvatarPanel from './components/AvatarPanel'
import ControlPanel from './components/ControlPanel'
import FeedbackPanel from './components/FeedbackPanel'
import Header from './components/Header'
import InterviewPanel from './components/InterviewPanel'
import SystemNotice from './components/SystemNotice'
import { stopSpeech, type VoiceMode } from './services/speechPlayer'
import { speakTextWithAvatar } from './services/avatarSpeechPlayer'
import { fetchQuestionBankTopics } from './services/questionBankApi'
import {
  createInterviewReport,
  nextInterview,
  startInterview,
} from './services/interviewApi'
import type {
  AvatarStatus,
  Feedback,
  InterviewRole,
  InterviewStage,
  LlmProvider,
  Message,
  QuestionDifficulty,
  QuestionMeta,
  QuestionSource,
  Report,
  ResponseSource,
} from './types/interview'
import type { SpatiusRuntimeStatus } from './types/spatius'
import type { AvatarSpeechSender } from './types/spatius'

function App() {
  const [role, setRole] = useState<InterviewRole>('frontend')
  const [questionSource, setQuestionSource] = useState<QuestionSource>('llm')
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium')
  const [topic, setTopic] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [stage, setStage] = useState<InterviewStage>('idle')
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [shouldEnd, setShouldEnd] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [responseSource, setResponseSource] = useState<ResponseSource>('mock')
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('mock')
  const [spatiusStatus, setSpatiusStatus] = useState<SpatiusRuntimeStatus>({
    avatarMode: 'placeholder',
    connectionState: 'placeholder',
    message: 'Avatar placeholder is ready.',
    tokenState: 'not-checked',
  })
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('silent')
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const [activeQuestionMeta, setActiveQuestionMeta] = useState<QuestionMeta | null>(null)
  const [answeredQuestionMetas, setAnsweredQuestionMetas] = useState<QuestionMeta[]>([])
  const speechRunRef = useRef(0)
  const avatarSpeechSenderRef = useRef<AvatarSpeechSender | null>(null)
  const avatarInterruptRef = useRef<(() => void) | null>(null)
  const avatarSpeechAbortRef = useRef<AbortController | null>(null)

  const round = useMemo(
    () => messages.filter((message) => message.speaker === 'candidate').length,
    [messages],
  )

  useEffect(() => {
    let cancelled = false

    if (questionSource !== 'bank') {
      setTopics([])
      setTopic('')
      return () => {
        cancelled = true
      }
    }

    fetchQuestionBankTopics(role)
      .then((nextTopics) => {
        if (cancelled) {
          return
        }

        setTopics(nextTopics)
        setTopic((currentTopic) =>
          currentTopic && nextTopics.includes(currentTopic) ? currentTopic : '',
        )
      })
      .catch(() => {
        if (!cancelled) {
          setTopics([])
          setTopic('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [questionSource, role])

  const playInterviewerReply = useCallback(
    (text: string) => {
      const speechRun = speechRunRef.current + 1
      speechRunRef.current = speechRun
      avatarSpeechAbortRef.current?.abort()
      const abortController = new AbortController()
      avatarSpeechAbortRef.current = abortController
      setMessages((current) => [...current, createMessage('interviewer', text)])
      void speakTextWithAvatar(text, {
        signal: abortController.signal,
        avatarSpeechSender: avatarSpeechSenderRef.current,
        onEvaluating: () => {
          if (speechRunRef.current === speechRun) {
            setAvatarStatus('evaluating')
          }
        },
        onStart: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            setVoiceNotice(
              mode === 'avatar-tts'
                ? null
                : mode === 'browser'
                  ? '浏览器语音不会驱动数字人口型。'
                  : '语音 fallback 已启用，文字面试仍可继续。',
            )
            setAvatarStatus('speaking')
          }
        },
        onEnd: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            setVoiceNotice(
              mode === 'avatar-tts'
                ? null
                : mode === 'browser'
                  ? '浏览器语音不会驱动数字人口型。'
                  : '语音 fallback 已启用，文字面试仍可继续。',
            )
            setAvatarStatus('listening')
            setStage((current) => (current === 'finished' ? current : 'answering'))
          }
        },
        onNotice: (message) => {
          if (speechRunRef.current === speechRun) {
            setVoiceNotice(message)
          }
        },
      }).then((mode) => {
        if (speechRunRef.current === speechRun) {
          setVoiceMode(mode)
        }
      })
    },
    [],
  )

  const stopCurrentSpeech = useCallback(() => {
    speechRunRef.current += 1
    avatarSpeechAbortRef.current?.abort()
    avatarSpeechAbortRef.current = null
    avatarInterruptRef.current?.()
    stopSpeech()
  }, [])

  const handleAvatarSpeechReady = useCallback(
    (sender: AvatarSpeechSender | null, interrupt: (() => void) | null) => {
      avatarSpeechSenderRef.current = sender
      avatarInterruptRef.current = interrupt
    },
    [],
  )

  const handleSampleVoiceMode = useCallback(() => {
    setVoiceMode('sample-pcm')
    setVoiceNotice(null)
  }, [])

  const speakReportReady = useCallback(() => {
    const speechRun = speechRunRef.current + 1
    speechRunRef.current = speechRun
    avatarSpeechAbortRef.current?.abort()
    const abortController = new AbortController()
    avatarSpeechAbortRef.current = abortController
    const text = '你的面试报告已经生成，请查看右侧反馈。'

    void speakTextWithAvatar(text, {
      signal: abortController.signal,
      avatarSpeechSender: avatarSpeechSenderRef.current,
      onEvaluating: () => {
        if (speechRunRef.current === speechRun) {
          setAvatarStatus('evaluating')
        }
      },
        onStart: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            setVoiceNotice(
              mode === 'avatar-tts'
                ? null
                : mode === 'browser'
                  ? '浏览器语音不会驱动数字人口型。'
                  : '语音 fallback 已启用，文字面试仍可继续。',
            )
            setAvatarStatus('speaking')
          }
        },
      onEnd: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            setVoiceNotice(
              mode === 'avatar-tts'
                ? null
                : mode === 'browser'
                  ? '浏览器语音不会驱动数字人口型。'
                  : '语音 fallback 已启用，文字面试仍可继续。',
            )
            setAvatarStatus('idle')
        }
      },
      onNotice: (message) => {
        if (speechRunRef.current === speechRun) {
          setVoiceNotice(message)
        }
      },
    }).then((mode) => {
      if (speechRunRef.current === speechRun) {
        setVoiceMode(mode)
      }
    })
  }, [])

  useEffect(
    () => () => {
      avatarSpeechAbortRef.current?.abort()
      avatarInterruptRef.current?.()
      stopSpeech()
    },
    [],
  )

  async function handleStart() {
    stopCurrentSpeech()
    setIsBusy(true)
    setError(null)
    setFeedback(null)
    setReport(null)
    setShouldEnd(false)
    setMessages([])
    setActiveQuestionMeta(null)
    setAnsweredQuestionMetas([])
    setStage('opening')
    setAvatarStatus('evaluating')

    try {
      const response = await startInterview(role, {
        questionSource,
        difficulty,
        topic: topic || undefined,
      })
      setResponseSource(response.source ?? 'mock')
      setLlmProvider(response.provider ?? 'mock')
      setActiveQuestionMeta(response.questionMeta ?? null)
      setStage(response.stage)
      playInterviewerReply(response.replyText)
    } catch {
      setStage('idle')
      setAvatarStatus('idle')
      setError('Interview service unavailable. Please check the backend server.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSubmit() {
    const trimmedAnswer = answer.trim()

    if (!trimmedAnswer) {
      return
    }

    stopCurrentSpeech()
    setIsBusy(true)
    setError(null)
    setStage('evaluating')
    setAvatarStatus('evaluating')
    setAnswer('')

    const candidateMessage = createMessage('candidate', trimmedAnswer)
    const nextHistory = [...messages, candidateMessage]
    setMessages(nextHistory)

    try {
      const response = await nextInterview(role, trimmedAnswer, nextHistory, activeQuestionMeta)
      setFeedback({
        score: response.score,
        feedback: response.feedback,
        suggestion: response.suggestion,
        knowledgeFeedback: response.knowledgeFeedback,
      })
      setResponseSource(response.source ?? 'mock')
      setLlmProvider(response.provider ?? 'mock')
      setShouldEnd(response.shouldEnd)
      if (activeQuestionMeta) {
        setAnsweredQuestionMetas((current) => [...current, activeQuestionMeta])
      }
      setActiveQuestionMeta(response.questionMeta ?? activeQuestionMeta)
      playInterviewerReply(response.replyText)
    } catch {
      setStage('answering')
      setAvatarStatus('listening')
      setError('Failed to evaluate the answer. Please submit again.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleEnd() {
    stopCurrentSpeech()
    setIsBusy(true)
    setError(null)
    setStage('evaluating')
    setAvatarStatus('evaluating')

    try {
      const response = await createInterviewReport(role, messages, answeredQuestionMetas)
      setResponseSource(response.source ?? 'mock')
      setLlmProvider(response.provider ?? 'mock')
      setReport(response)
      setStage('finished')
      setShouldEnd(true)
      speakReportReady()
    } catch {
      setStage(messages.length > 0 ? 'answering' : 'idle')
      setAvatarStatus(messages.length > 0 ? 'listening' : 'idle')
      setError('Failed to generate the final report. Please try again.')
    } finally {
      setIsBusy(false)
    }
  }

  function handleReset() {
    stopCurrentSpeech()
    setRole('frontend')
    setQuestionSource('llm')
    setDifficulty('medium')
    setTopic('')
    setTopics([])
    setStage('idle')
    setAvatarStatus('idle')
    setMessages([])
    setAnswer('')
    setFeedback(null)
    setReport(null)
    setShouldEnd(false)
    setError(null)
    setResponseSource('mock')
    setLlmProvider('mock')
    setVoiceMode('silent')
    setVoiceNotice(null)
    setActiveQuestionMeta(null)
    setAnsweredQuestionMetas([])
    setIsBusy(false)
  }

  return (
    <main className="app-shell">
      <Header provider={llmProvider} source={responseSource} />
      <SystemNotice
        error={error ?? voiceNotice}
        spatiusStatus={spatiusStatus}
        voiceMode={voiceMode}
      />
      <div className="dashboard-grid">
        <AvatarPanel
          onAvatarSpeechReady={handleAvatarSpeechReady}
          onSampleVoiceMode={handleSampleVoiceMode}
          onSpatiusStatusChange={setSpatiusStatus}
          spatiusStatus={spatiusStatus}
          status={avatarStatus}
          voiceMode={voiceMode}
        />
        <InterviewPanel messages={messages} stage={stage} />
        <FeedbackPanel
          canEnd={shouldEnd}
          currentFeedback={feedback}
          report={report}
          round={round}
        />
      </div>
        <ControlPanel
          answer={answer}
          canEnd={shouldEnd}
          difficulty={difficulty}
          error={null}
          isBusy={isBusy}
          onAnswerChange={setAnswer}
          onDifficultyChange={setDifficulty}
          onEnd={handleEnd}
          onQuestionSourceChange={setQuestionSource}
          onReset={handleReset}
          onRoleChange={setRole}
          onStart={handleStart}
          onSubmit={handleSubmit}
          onTopicChange={setTopic}
          questionSource={questionSource}
          role={role}
          stage={stage}
          topic={topic}
          topics={topics}
        />
    </main>
  )
}

function createMessage(speaker: Message['speaker'], text: string): Message {
  return {
    id: crypto.randomUUID(),
    speaker,
    text,
    timestamp: new Date().toISOString(),
  }
}

export default App
