import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import AvatarPanel from './components/AvatarPanel'
import ControlPanel from './components/ControlPanel'
import FeedbackPanel from './components/FeedbackPanel'
import Header from './components/Header'
import InterviewPanel from './components/InterviewPanel'
import SystemNotice from './components/SystemNotice'
import {
  startBrowserAsr,
  type BrowserAsrSession,
} from './services/browserAsr'
import {
  createStreamingAudioRecorder,
  isAudioRecordingSupported,
  type StreamingAudioRecorderSession,
} from './services/audioRecorder'
import {
  recordAsrDebugChunk,
  startAsrDebugSession,
  stopAsrDebugSession,
} from './services/asrDebug'
import { speakTextWithAvatar } from './services/avatarSpeechPlayer'
import { fetchQuestionBankTopics } from './services/questionBankApi'
import {
  createStreamingAsrClient,
  type StreamingAsrClient,
} from './services/streamingAsrClient'
import { stopSpeech, type VoiceMode } from './services/speechPlayer'
import {
  createInterviewReport,
  nextInterview,
  startInterview,
} from './services/interviewApi'
import type {
  AvatarStatus,
  Feedback,
  InterviewFlowStatus,
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
import type {
  AvatarSpeechSender,
  SpatiusRuntimeStatus,
} from './types/spatius'

type AsrMode = 'stream' | 'browser' | 'mock' | 'unavailable'

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
  const [asrSupported, setAsrSupported] = useState(false)
  const [asrMode, setAsrMode] = useState<AsrMode>('unavailable')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [asrError, setAsrError] = useState<string | null>(null)
  const [interviewStatus, setInterviewStatus] = useState<InterviewFlowStatus>('in_progress')

  const activeActionRef = useRef<'start' | 'submit' | 'end' | null>(null)
  const speechRunRef = useRef(0)
  const avatarSpeechSenderRef = useRef<AvatarSpeechSender | null>(null)
  const avatarInterruptRef = useRef<(() => void) | null>(null)
  const avatarSpeechAbortRef = useRef<AbortController | null>(null)
  const audioRecorderRef = useRef<StreamingAudioRecorderSession | null>(null)
  const streamingAsrRef = useRef<StreamingAsrClient | null>(null)
  const browserAsrRef = useRef<BrowserAsrSession | null>(null)
  const asrAttemptRef = useRef(0)
  const asrAudioBytesRef = useRef(0)
  const asrChunkCountRef = useRef(0)
  const latestPartialRef = useRef('')
  const asrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isWaitingForFinalRef = useRef(false)

  const round = useMemo(
    () => messages.filter((message) => message.speaker === 'candidate').length,
    [messages],
  )
  const disableVoiceInput = avatarStatus === 'speaking' || interviewStatus === 'ended'

  useEffect(() => {
    const supported = isAudioRecordingSupported()
    setAsrSupported(supported)
    setAsrMode(supported ? 'browser' : 'unavailable')
  }, [])

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

  const setVoiceFallbackNotice = useCallback((mode: VoiceMode) => {
    setVoiceNotice(
      mode === 'avatar-tts'
        ? null
        : mode === 'browser'
          ? '浏览器语音不会驱动数字人口型。'
          : '语音 fallback 已启用，文字面试仍可继续。',
    )
  }, [])

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
            setVoiceNotice('正在生成语音...')
          }
        },
        onStart: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            if (mode === 'avatar-tts') {
              setVoiceNotice('数字人正在播报...')
            } else {
              setVoiceFallbackNotice(mode)
            }
            setAvatarStatus('speaking')
          }
        },
        onEnd: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            setVoiceFallbackNotice(mode)
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
    [setVoiceFallbackNotice],
  )

  const stopCurrentSpeech = useCallback(() => {
    speechRunRef.current += 1
    avatarSpeechAbortRef.current?.abort()
    avatarSpeechAbortRef.current = null
    avatarInterruptRef.current?.()
    stopSpeech()
  }, [])

  const stopCurrentAsr = useCallback(() => {
    isWaitingForFinalRef.current = false
    if (asrTimeoutRef.current) {
      clearTimeout(asrTimeoutRef.current)
      asrTimeoutRef.current = null
    }
    audioRecorderRef.current?.cancel()
    audioRecorderRef.current = null
    streamingAsrRef.current?.close()
    streamingAsrRef.current = null
    browserAsrRef.current?.abort()
    browserAsrRef.current = null
    setIsRecording(false)
    setIsTranscribing(false)
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
            setVoiceNotice('正在生成语音...')
          }
        },
        onStart: (mode) => {
          if (speechRunRef.current === speechRun) {
            setVoiceMode(mode)
            if (mode === 'avatar-tts') {
              setVoiceNotice('数字人正在播报...')
            } else {
              setVoiceFallbackNotice(mode)
            }
            setAvatarStatus('speaking')
          }
        },
      onEnd: (mode) => {
        if (speechRunRef.current === speechRun) {
          setVoiceMode(mode)
          setVoiceFallbackNotice(mode)
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
  }, [setVoiceFallbackNotice])

  useEffect(
    () => () => {
      avatarSpeechAbortRef.current?.abort()
      avatarInterruptRef.current?.()
      stopCurrentAsr()
      stopSpeech()
    },
    [stopCurrentAsr],
  )

  async function handleStart() {
    if (activeActionRef.current || interviewStatus === 'ended') {
      return
    }
    activeActionRef.current = 'start'
    stopCurrentSpeech()
    stopCurrentAsr()
    setIsBusy(true)
    setInterviewStatus('in_progress')
    setError(null)
    setAsrError(null)
    setFeedback(null)
    setReport(null)
    setShouldEnd(false)
    setMessages([])
    setActiveQuestionMeta(null)
    setAnsweredQuestionMetas([])
    setTranscript('')
    setStage('opening')
    setAvatarStatus('evaluating')
    setVoiceNotice('面试官生成问题中...')

    try {
      const response = await startInterview(role, {
        questionSource,
        difficulty,
        topic: topic || undefined,
      })
      setResponseSource(response.source ?? 'mock')
      setLlmProvider(response.provider ?? 'mock')
      setActiveQuestionMeta(response.questionMeta ?? null)
      setInterviewStatus(response.status ?? 'in_progress')
      setStage(response.stage)
      playInterviewerReply(response.replyText)
    } catch {
      setStage('idle')
      setAvatarStatus('idle')
      setError('Interview service unavailable. Please check the backend server.')
    } finally {
      setIsBusy(false)
      activeActionRef.current = null
    }
  }

  async function handleSubmit() {
    const trimmedAnswer = answer.trim()

    if (
      !trimmedAnswer ||
      isRecording ||
      isTranscribing ||
      interviewStatus === 'ended' ||
      activeActionRef.current
    ) {
      if (interviewStatus === 'ended') {
        setError('面试已结束，请查看最终报告或点击 Reset Demo 重新开始。')
      }
      return
    }

    activeActionRef.current = 'submit'
    stopCurrentSpeech()
    setIsBusy(true)
    setError(null)
    setAsrError(null)
    setStage('evaluating')
    setAvatarStatus('evaluating')
    setVoiceNotice('正在评估回答...')
    setAnswer('')
    setTranscript('')

    const candidateMessage = createMessage('candidate', trimmedAnswer)
    const nextHistory = [...messages, candidateMessage]
    setMessages(nextHistory)

    try {
      const response = await nextInterview(
        role,
        trimmedAnswer,
        nextHistory,
        activeQuestionMeta,
        interviewStatus,
      )
      if (response.status === 'ended' && !response.replyText) {
        setInterviewStatus('ended')
        setStage('finished')
        setShouldEnd(true)
        setError(response.message ?? '面试已结束，请查看最终报告或点击 Reset Demo 重新开始。')
        return
      }
      setFeedback({
        score: response.score,
        feedback: response.feedback,
        suggestion: response.suggestion,
        knowledgeFeedback: response.knowledgeFeedback,
      })
      setResponseSource(response.source ?? 'mock')
      setLlmProvider(response.provider ?? 'mock')
      setShouldEnd(response.shouldEnd)
      setInterviewStatus(response.status ?? (response.shouldEnd ? 'ended' : 'in_progress'))
      if (activeQuestionMeta) {
        setAnsweredQuestionMetas((current) => [...current, activeQuestionMeta])
      }
      setActiveQuestionMeta(response.questionMeta ?? activeQuestionMeta)
      if (response.replyText) {
        playInterviewerReply(response.replyText)
      }
      if (response.status === 'ended') {
        setStage('finished')
        setAvatarStatus('listening')
      }
    } catch {
      setStage('answering')
      setAvatarStatus('listening')
      setError('Failed to evaluate the answer. Please submit again.')
    } finally {
      setIsBusy(false)
      activeActionRef.current = null
    }
  }

  async function handleEnd() {
    if (activeActionRef.current || interviewStatus === 'ended') {
      return
    }
    activeActionRef.current = 'end'
    stopCurrentSpeech()
    stopCurrentAsr()
    setIsBusy(true)
    setError(null)
    setAsrError(null)
    setStage('evaluating')
    setAvatarStatus('evaluating')
    setVoiceNotice('正在生成最终报告...')

    try {
      const response = await createInterviewReport(role, messages, answeredQuestionMetas)
      setResponseSource(response.source ?? 'mock')
      setLlmProvider(response.provider ?? 'mock')
      setReport(response)
      setStage('finished')
      setShouldEnd(true)
      setInterviewStatus(response.status ?? 'ended')
      speakReportReady()
    } catch {
      setStage(messages.length > 0 ? 'answering' : 'idle')
      setAvatarStatus(messages.length > 0 ? 'listening' : 'idle')
      setError('Failed to generate the final report. Please try again.')
    } finally {
      setIsBusy(false)
      activeActionRef.current = null
    }
  }

  function handleReset() {
    stopCurrentSpeech()
    stopCurrentAsr()
    setRole('frontend')
    setQuestionSource('llm')
    setDifficulty('medium')
    setTopic('')
    setTopics([])
    setStage('idle')
    setAvatarStatus('idle')
    setMessages([])
    setAnswer('')
    setTranscript('')
    setAsrError(null)
    setFeedback(null)
    setReport(null)
    setShouldEnd(false)
    setInterviewStatus('in_progress')
    setError(null)
    setResponseSource('mock')
    setLlmProvider('mock')
    setVoiceMode('silent')
    setVoiceNotice(null)
    setActiveQuestionMeta(null)
    setAnsweredQuestionMetas([])
    setIsBusy(false)
    activeActionRef.current = null
    latestPartialRef.current = ''
  }

  async function handleStartRecording() {
    if (!asrSupported) {
      setAsrMode('unavailable')
      setAsrError('浏览器不支持麦克风录音，请使用文字输入。')
      startBrowserFallbackRecognition()
      return
    }

    if (disableVoiceInput) {
      setAsrError('数字人正在说话，请等问题播完后再开始录音。')
      return
    }

    const attemptId = asrAttemptRef.current + 1
    asrAttemptRef.current = attemptId
    asrAudioBytesRef.current = 0
    asrChunkCountRef.current = 0
    latestPartialRef.current = ''

    try {
      setAsrError(null)
      setTranscript('')
      setIsRecording(true)
      setIsTranscribing(false)
      setAsrMode('stream')

      // 开发模式：启动音频调试会话
      startAsrDebugSession()

      const streamingClient = createStreamingAsrClient({
        onDebug: (message, details) => {
          debugAsrStream(message, {
            attemptId,
            micPermissionGranted: true,
            recorderStarted: true,
            ...details,
          })
        },
        onError: (message, debug) => {
          // 根据后端返回的 safeErrorCode 提供更具体的用户提示
          const safeCode = debug?.safeErrorCode as string | undefined
          const userMessage = mapAsrErrorToUserMessage(message, safeCode)
          setAsrError(userMessage)
          setAsrMode('mock')
          setIsTranscribing(false)
          isWaitingForFinalRef.current = false
          if (asrTimeoutRef.current) {
            clearTimeout(asrTimeoutRef.current)
            asrTimeoutRef.current = null
          }
          debugAsrStream('fallback', {
            attemptId,
            audioBytes: asrAudioBytesRef.current,
            audioChunkCount: asrChunkCountRef.current,
            fallbackReason: userMessage,
            safeErrorCode: safeCode,
            ...debug,
          })
          startBrowserFallbackRecognition()
        },
        onFinal: (text, debug) => {
          const finalText = text.trim()
          if (finalText) {
            setTranscript(finalText)
            setAnswer(finalText)
          } else if (latestPartialRef.current) {
            // 火山返回空 final 但之前有 partial — 保留 partial 作为最终结果
            debugAsrStream('final empty, using last partial', {
              attemptId,
              partialTextLength: latestPartialRef.current.length,
              ...debug,
            })
          } else {
            setAsrError('火山 ASR 未识别到语音内容，请重试或手动输入。')
          }
          setIsTranscribing(false)
          isWaitingForFinalRef.current = false
          if (asrTimeoutRef.current) {
            clearTimeout(asrTimeoutRef.current)
            asrTimeoutRef.current = null
          }
          debugAsrStream('final transcript', {
            attemptId,
            audioBytes: asrAudioBytesRef.current,
            audioChunkCount: asrChunkCountRef.current,
            finalTranscriptLength: finalText.length,
            ...debug,
          })
        },
        onOpen: (debug) => {
          setAsrMode('stream')
          debugAsrStream('connected', {
            attemptId,
            wsConnected: true,
            ...debug,
          })
        },
        onPartial: (text, debug) => {
          latestPartialRef.current = text
          setTranscript(text)
          setAnswer(text)
          debugAsrStream('partial transcript', {
            attemptId,
            partialTranscriptLength: text.length,
            ...debug,
          })
        },
      })
      streamingAsrRef.current = streamingClient

      const recorder = await createStreamingAudioRecorder((chunk) => {
        asrChunkCountRef.current += 1
        asrAudioBytesRef.current += chunk.byteLength
        recordAsrDebugChunk(chunk)
        streamingClient.sendAudio(chunk)
      })
      audioRecorderRef.current = recorder
    } catch (recordingError) {
      setIsRecording(false)
      setIsTranscribing(false)
      const message =
        recordingError instanceof Error
          ? recordingError.message
          : '录音启动失败，请手动输入回答。'
      setAsrError(message)
      setAsrMode('mock')
      debugAsrStream('recording start failed', {
        attemptId,
        micPermissionGranted: false,
        fallbackReason: message,
      })
      startBrowserFallbackRecognition()
    }
  }

  async function handleStopRecording() {
    if (!audioRecorderRef.current) {
      return
    }

    const attemptId = asrAttemptRef.current
    setIsRecording(false)
    setIsTranscribing(true)
    setAsrError(null)

    try {
      await audioRecorderRef.current.stop()
      audioRecorderRef.current = null

      // 开发模式：输出音频诊断统计
      const debugStats = stopAsrDebugSession()
      streamingAsrRef.current?.stop()
      debugAsrStream('recording stopped', {
        attemptId,
        audioBytes: asrAudioBytesRef.current,
        audioChunkCount: asrChunkCountRef.current,
        ...(debugStats ?? {}),
      })

      // 超时保护：15 秒后若仍未收到 final，自动 fallback
      isWaitingForFinalRef.current = true
      asrTimeoutRef.current = setTimeout(() => {
        if (asrAttemptRef.current === attemptId && isWaitingForFinalRef.current) {
          debugAsrStream('asr timeout — no final received', {
            attemptId,
            partialTextLength: latestPartialRef.current.length,
          })
          isWaitingForFinalRef.current = false
          if (latestPartialRef.current) {
            // 有 partial 结果，保留作为最终答案
            setIsTranscribing(false)
          } else {
            setAsrError('语音识别超时，请重试或手动输入。')
            setAsrMode('browser')
            setIsTranscribing(false)
            startBrowserFallbackRecognition()
          }
        }
      }, 15000)
    } catch (recordingError) {
      const fallbackReason =
        recordingError instanceof Error
          ? recordingError.message
          : 'ASR 识别失败，请手动输入。'
      setAsrError(fallbackReason)
      setAsrMode('mock')
      setIsTranscribing(false)
      isWaitingForFinalRef.current = false
      debugAsrStream('stop fallback', {
        attemptId,
        fallbackReason,
      })
    }
  }

  function startBrowserFallbackRecognition() {
    // 如果已有 streaming partial 结果，不启动浏览器 ASR 覆盖
    if (latestPartialRef.current) {
      debugAsrStream('skip browser fallback — already have partial', {
        partialTextLength: latestPartialRef.current.length,
      })
      return
    }

    try {
      const session = startBrowserAsr('zh-CN')
      browserAsrRef.current = session
      session.promise
        .then((result) => {
          // 只在没有现有结果时才覆盖
          if (!latestPartialRef.current && result.transcript) {
            setTranscript(result.transcript)
            setAnswer(result.transcript)
            setAsrError(null)
          }
        })
        .catch((fallbackError) => {
          setAsrError(
            fallbackError instanceof Error
              ? fallbackError.message
              : '浏览器识别不可用，请手动输入。',
          )
        })
    } catch {
      setAsrMode('unavailable')
    }
  }

  function handleUseTranscript() {
    if (transcript) {
      setAnswer(transcript)
    }
  }

  function handleClearTranscript() {
    setTranscript('')
    setAsrError(null)
  }

  return (
    <main className="app-shell">
      <Header
        asrMode={asrMode}
        provider={llmProvider}
        role={role}
        source={responseSource}
        spatiusStatus={spatiusStatus}
        voiceMode={voiceMode}
      />
      <SystemNotice
        asrError={asrError}
        asrMode={asrMode}
        interviewError={error}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        spatiusStatus={spatiusStatus}
        voiceMode={voiceMode}
        voiceNotice={voiceNotice}
      />
      <div className="dashboard-grid">
        <ControlPanel
          answer={answer}
          asrError={asrError}
          asrMode={asrMode}
          asrSupported={asrSupported}
          canEnd={shouldEnd}
          difficulty={difficulty}
          disableVoiceInput={disableVoiceInput}
          error={null}
          isBusy={isBusy}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          interviewStatus={interviewStatus}
          onAnswerChange={setAnswer}
          onClearTranscript={handleClearTranscript}
          onDifficultyChange={setDifficulty}
          onEnd={handleEnd}
          onQuestionSourceChange={setQuestionSource}
          onReset={handleReset}
          onRoleChange={setRole}
          onStart={handleStart}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onSubmit={handleSubmit}
          onTopicChange={setTopic}
          onUseTranscript={handleUseTranscript}
          questionSource={questionSource}
          role={role}
          stage={stage}
          topic={topic}
          topics={topics}
          transcript={transcript}
        />
        <section className="center-workspace" aria-label="数字人面试工作区">
          <AvatarPanel
            onAvatarSpeechReady={handleAvatarSpeechReady}
            onSampleVoiceMode={handleSampleVoiceMode}
            onSpatiusStatusChange={setSpatiusStatus}
            spatiusStatus={spatiusStatus}
            status={avatarStatus}
            voiceMode={voiceMode}
          />
          <InterviewPanel messages={messages} stage={stage} />
        </section>
        <FeedbackPanel
          canEnd={shouldEnd}
          currentFeedback={feedback}
          report={report}
          round={round}
        />
      </div>
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

function debugAsrStream(message: string, details: Record<string, unknown>) {
  // 安全：截断过长 transcript
  const safe = { ...details }
  if (typeof safe.transcript === 'string' && safe.transcript.length > 80) {
    safe.transcript = safe.transcript.slice(0, 80) + '…'
  }
  console.info('[AvaCoach ASR Stream]', message, safe)
}

function mapAsrErrorToUserMessage(
  serverMessage: string,
  safeErrorCode?: string,
): string {
  switch (safeErrorCode) {
    case 'not_configured':
      return '火山 ASR 未配置，已切换到浏览器识别或手动输入。'
    case 'socket_error':
      return '火山 ASR 连接失败，请检查 API Key 和 Resource ID。'
    case 'parse_error':
      return '火山 ASR 响应异常，已切换到浏览器识别或手动输入。'
    default:
      break
  }

  // 兜底：基于消息关键词
  if (serverMessage.includes('未配置')) {
    return '火山 ASR 未配置，已切换到浏览器识别或手动输入。'
  }
  if (serverMessage.includes('连接失败') || serverMessage.includes('WebSocket')) {
    return '火山 ASR 连接失败，请确认后端已启动且端口 3001 可访问。'
  }
  if (serverMessage.includes('协议解析')) {
    return '火山 ASR 响应异常，已切换到浏览器识别或手动输入。'
  }

  return serverMessage || '流式 ASR 不可用，已切换到浏览器识别或手动输入。'
}

export default App
