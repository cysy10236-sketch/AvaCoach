import { Router } from "express";
import {
  generateFinalReport,
  generateFollowUp,
  generateOpeningAndFirstQuestion,
} from "../services/llm/llmService.js";
import {
  calculateCoverageAdjustedScore,
  createBankReportSummary,
  evaluateAnswerAgainstQuestion,
  normalizeDifficulty,
  pickQuestion,
  toQuestionMeta,
} from "../services/questionBank/questionBankService.js";
import type {
  InterviewFlowStatus,
  InterviewRole,
  KnowledgeFeedback,
  Message,
  NextInterviewRequest,
  NextInterviewResponse,
  QuestionMeta,
  ReportInterviewRequest,
  StartInterviewRequest,
} from "../types/interview.js";

const interviewRouter = Router();

const validRoles: InterviewRole[] = ["frontend", "backend", "product", "ai", "behavioral"];
const DEFAULT_SESSION_ID = "default-demo-session";
const MAX_ROUNDS = 3;

interface InterviewSessionState {
  status: InterviewFlowStatus;
  round: number;
  maxRounds: number;
  reportReady: boolean;
  currentQuestionMeta?: QuestionMeta;
}

const sessions = new Map<string, InterviewSessionState>();

interviewRouter.post("/start", async (req, res) => {
  const body = req.body as Partial<StartInterviewRequest>;
  const role = normalizeRole(body.role);
  const sessionId = normalizeSessionId(body.sessionId);

  if (body.questionSource === "bank") {
    const question = pickQuestion({
      role: role === "product" ? "behavioral" : role,
      difficulty: normalizeDifficulty(body.difficulty),
      topic: typeof body.topic === "string" ? body.topic : undefined,
    });
    const questionMeta = toQuestionMeta(question);
    resetSession(sessionId, questionMeta);

    debugInterviewFlow("start_response", {
      sessionId,
      nextStatus: "in_progress",
      round: 0,
      nextAllowed: true,
      reportReady: false,
      reason: "bank-mode",
    });

    res.json({
      replyText: `接下来我们使用 AvaCoach IT 题库中的一道 ${question.topic} 题。${question.question}`,
      question: question.question,
      stage: "asking",
      source: "bank",
      provider: "mock",
      questionMeta,
      sessionId,
      status: "in_progress",
      nextAllowed: true,
      reportReady: false,
    });
    return;
  }

  resetSession(sessionId);
  const response = await generateOpeningAndFirstQuestion(role);
  debugInterviewFlow("start_response", {
    sessionId,
    nextStatus: "in_progress",
    round: 0,
    nextAllowed: true,
    reportReady: false,
    reason: "llm-mode",
  });

  res.json({
    ...response,
    sessionId,
    status: "in_progress",
    nextAllowed: true,
    reportReady: false,
  });
});

interviewRouter.post("/next", async (req, res) => {
  const body = req.body as Partial<NextInterviewRequest>;
  const role = normalizeRole(body.role);
  const answer = String(body.answer ?? "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const sessionId = normalizeSessionId(body.sessionId);
  const session = getOrCreateSession(sessionId, normalizeQuestionMeta(body.questionMeta));

  if (session.status === "ended") {
    debugInterviewFlow("next_blocked", {
      sessionId,
      previousStatus: session.status,
      nextStatus: "ended",
      round: session.round,
      nextAllowed: false,
      reportReady: true,
      reason: "server-session-ended",
    });
    res.json(createEndedNextResponse(sessionId));
    return;
  }

  if (!answer) {
    res.status(400).json({ error: "answer is required" });
    return;
  }

  const questionMeta = normalizeQuestionMeta(body.questionMeta) ?? session.currentQuestionMeta;
  const candidateRounds = history.filter((message) => message.speaker === "candidate").length;
  const nextRound = Math.max(session.round + 1, candidateRounds);
  const reachedMaxRounds = nextRound >= session.maxRounds;
  const nextStatus: InterviewFlowStatus = reachedMaxRounds ? "ended" : "in_progress";
  const nextAllowed = !reachedMaxRounds;
  const reportReady = reachedMaxRounds;

  const llmResponse = await generateFollowUp(role, answer, history, {
    questionMeta,
  });
  const normalizedLlmResponse = normalizeNextResponse(llmResponse);

  const response = questionMeta
    ? buildBankNextResponse({
        answer,
        history,
        llmResponse: normalizedLlmResponse,
        nextAllowed,
        questionMeta,
        reachedMaxRounds,
        role,
      })
    : buildLlmNextResponse({
        answer,
        candidateRounds: nextRound,
        llmResponse: normalizedLlmResponse,
        nextAllowed,
        reachedMaxRounds,
      });

  session.round = nextRound;
  session.status = nextStatus;
  session.reportReady = reportReady;
  session.currentQuestionMeta = response.questionMeta ?? questionMeta;

  debugInterviewFlow("next_response", {
    sessionId,
    previousStatus: "in_progress",
    nextStatus,
    round: nextRound,
    nextAllowed,
    reportReady,
    reason: questionMeta ? "bank-mode" : "llm-mode",
  });

  res.json({
    ...response,
    sessionId,
    shouldEnd: reachedMaxRounds,
    status: nextStatus,
    nextAllowed,
    reportReady,
  });
});

interviewRouter.post("/report", async (req, res) => {
  const body = req.body as Partial<ReportInterviewRequest>;
  const role = normalizeRole(body.role);
  const history = Array.isArray(body.history) ? body.history : [];
  const sessionId = normalizeSessionId(body.sessionId);
  const session = getOrCreateSession(sessionId);
  const questionMetas = Array.isArray(body.questionMetas)
    ? body.questionMetas.map(normalizeQuestionMeta).filter((item): item is QuestionMeta => Boolean(item))
    : [];

  const report = await generateFinalReport(role, history);
  session.status = "ended";
  session.reportReady = true;
  session.round = Math.max(session.round, history.filter((message) => message.speaker === "candidate").length);

  debugInterviewFlow("report_response", {
    sessionId,
    previousStatus: "in_progress",
    nextStatus: "ended",
    round: session.round,
    nextAllowed: false,
    reportReady: true,
    reason: "report-generated",
  });

  if (questionMetas.length === 0) {
    res.json({
      ...report,
      sessionId,
      status: "ended",
      nextAllowed: false,
      reportReady: true,
    });
    return;
  }

  const candidateAnswers = history.filter((message) => message.speaker === "candidate");
  const feedbackItems = questionMetas.map((questionMeta, index) =>
    evaluateAnswerAgainstQuestion(candidateAnswers[index]?.text ?? "", questionMeta),
  );

  res.json({
    ...report,
    bankReport: createBankReportSummary(questionMetas, feedbackItems),
    sessionId,
    status: "ended",
    nextAllowed: false,
    reportReady: true,
  });
});

function buildLlmNextResponse({
  answer,
  candidateRounds,
  llmResponse,
  nextAllowed,
  reachedMaxRounds,
}: {
  answer: string;
  candidateRounds: number;
  llmResponse: NextInterviewResponse;
  nextAllowed: boolean;
  reachedMaxRounds: boolean;
}): NextInterviewResponse {
  const feedbackText = pickFeedbackText(llmResponse);
  const nextQuestion = nextAllowed
    ? pickOneQuestion(llmResponse.nextQuestion) || createRedirectQuestion(answer, candidateRounds)
    : "";

  return {
    ...llmResponse,
    replyText: composeInterviewerReply(feedbackText, nextQuestion, reachedMaxRounds),
    feedback: feedbackText,
    suggestion: llmResponse.suggestion || llmResponse.improvementTips?.[0] || "建议补充更具体的背景、行动和结果。",
    nextQuestion,
    feedbackText,
    shouldEnd: reachedMaxRounds,
  };
}

function buildBankNextResponse({
  answer,
  history,
  llmResponse,
  nextAllowed,
  questionMeta,
  reachedMaxRounds,
  role,
}: {
  answer: string;
  history: Message[];
  llmResponse: NextInterviewResponse;
  nextAllowed: boolean;
  questionMeta: QuestionMeta;
  reachedMaxRounds: boolean;
  role: InterviewRole;
}): NextInterviewResponse {
  const knowledgeFeedback = evaluateAnswerAgainstQuestion(answer, questionMeta);
  const adjustedScore = calculateCoverageAdjustedScore({
    answer,
    knowledgeFeedback,
    llmScore: llmResponse.score,
    questionMeta,
  });
  const feedbackText = buildKnowledgeFeedbackText(llmResponse, knowledgeFeedback, adjustedScore.scoringReason);
  const nextQuestion = nextAllowed
    ? pickBankNextQuestion({
        answer,
        fallbackQuestion: llmResponse.nextQuestion,
        history,
        questionMeta,
        role,
      })
    : "";

  return {
    ...llmResponse,
    source: "bank",
    questionMeta,
    knowledgeFeedback,
    coveredPoints: knowledgeFeedback.coveredPoints,
    missingPoints: knowledgeFeedback.missingPoints,
    improvementTips: knowledgeFeedback.improvementTips,
    feedbackText,
    nextQuestion,
    replyText: composeInterviewerReply(feedbackText, nextQuestion, reachedMaxRounds),
    score: adjustedScore.score,
    feedback: feedbackText,
    suggestion: knowledgeFeedback.improvementTips[0] ?? llmResponse.suggestion,
    scoringReason: adjustedScore.scoringReason,
    shouldEnd: reachedMaxRounds,
  };
}

function pickBankNextQuestion({
  answer,
  fallbackQuestion,
  history,
  questionMeta,
}: {
  answer: string;
  fallbackQuestion?: string;
  history: Message[];
  questionMeta: QuestionMeta;
  role: InterviewRole;
}): string {
  if (isCompensationQuestion(answer)) {
    return "薪资和福利通常会在 HR 或后续流程中沟通。我们先回到当前技术面试：请你结合一个项目，说明你在这个知识点上的实际处理方式。";
  }

  if (isQuestionChangeRequest(answer)) {
    return "可以，我们换一个更基础的角度。请你先说明这个知识点通常解决什么问题，以及你会在什么场景下使用它。";
  }

  if (isShortUnknownAnswer(answer)) {
    return "没关系，我们从基础开始。你可以先说说自己对这个知识点的第一印象，或者它在项目中可能解决的问题。";
  }

  const candidateRounds = history.filter((message) => message.speaker === "candidate").length;
  const bankFollowUp = questionMeta.followUps?.[
    Math.max(0, candidateRounds - 1) % (questionMeta.followUps.length || 1)
  ];

  return pickOneQuestion(fallbackQuestion) || bankFollowUp || "请你结合一个真实项目，补充这个方案的取舍、验证方式和最终结果。";
}

function buildKnowledgeFeedbackText(
  llmResponse: NextInterviewResponse,
  knowledgeFeedback: KnowledgeFeedback,
  scoringReason: string,
): string {
  const baseFeedback = pickFeedbackText(llmResponse);
  const covered = knowledgeFeedback.coveredPoints.length;
  const missing = knowledgeFeedback.missingPoints.length;

  return `${baseFeedback} 知识点检查：已覆盖 ${covered} 个期望要点，缺失 ${missing} 个要点。${scoringReason}`;
}

function composeInterviewerReply(
  feedbackText: string,
  nextQuestion: string,
  reachedMaxRounds: boolean,
): string {
  const feedback = stripEndInterviewPhrases(feedbackText).trim();

  if (reachedMaxRounds) {
    return `${feedback || "这轮回答我已经记录。"} 当前练习轮次已经完成，请点击 End Interview 查看完整报告。`;
  }

  const question = pickOneQuestion(nextQuestion);
  return question
    ? `${feedback || "这轮回答我已经记录。"} ${question}`
    : feedback || "这轮回答我已经记录。请继续补充一个具体项目案例。";
}

function pickFeedbackText(response: NextInterviewResponse): string {
  return stripEndInterviewPhrases(
    response.feedbackText ||
      response.feedback ||
      "这轮回答已经记录，建议继续补充更具体的背景、行动和结果。",
  );
}

function pickOneQuestion(value?: string): string {
  const text = stripEndInterviewPhrases(String(value ?? "")).trim();
  if (!text) {
    return "";
  }

  const match = text.match(/[^。！？!?]*[？?]/);
  if (match?.[0]) {
    return match[0].trim();
  }

  return text.length > 120 ? `${text.slice(0, 120)}？` : text;
}

function normalizeNextResponse(response: NextInterviewResponse): NextInterviewResponse {
  return {
    ...response,
    score: normalizeScore(response.score),
    feedbackText: response.feedbackText ? stripEndInterviewPhrases(response.feedbackText) : undefined,
    nextQuestion: response.nextQuestion ? pickOneQuestion(response.nextQuestion) : undefined,
    replyText: stripEndInterviewPhrases(response.replyText),
    shouldEnd: false,
  };
}

function normalizeRole(role: unknown): InterviewRole {
  return validRoles.includes(role as InterviewRole) ? (role as InterviewRole) : "behavioral";
}

function normalizeSessionId(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate ? candidate.slice(0, 80) : DEFAULT_SESSION_ID;
}

function getOrCreateSession(sessionId: string, questionMeta?: QuestionMeta): InterviewSessionState {
  const session = sessions.get(sessionId);
  if (session) {
    if (questionMeta) {
      session.currentQuestionMeta = questionMeta;
    }
    return session;
  }

  const nextSession: InterviewSessionState = {
    status: "in_progress",
    round: 0,
    maxRounds: MAX_ROUNDS,
    reportReady: false,
    currentQuestionMeta: questionMeta,
  };
  sessions.set(sessionId, nextSession);
  return nextSession;
}

function resetSession(sessionId: string, questionMeta?: QuestionMeta) {
  sessions.set(sessionId, {
    status: "in_progress",
    round: 0,
    maxRounds: MAX_ROUNDS,
    reportReady: false,
    currentQuestionMeta: questionMeta,
  });
}

function normalizeQuestionMeta(value: unknown): QuestionMeta | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<QuestionMeta>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.role !== "string" ||
    typeof candidate.difficulty !== "string" ||
    typeof candidate.topic !== "string" ||
    !Array.isArray(candidate.expectedPoints) ||
    !Array.isArray(candidate.tags)
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    role: normalizeRole(candidate.role),
    difficulty: normalizeDifficulty(candidate.difficulty) ?? "medium",
    topic: candidate.topic,
    expectedPoints: candidate.expectedPoints.filter((item): item is string => typeof item === "string"),
    followUps: Array.isArray(candidate.followUps)
      ? candidate.followUps.filter((item): item is string => typeof item === "string")
      : [],
    tags: candidate.tags.filter((item): item is string => typeof item === "string"),
  };
}

function createEndedNextResponse(sessionId: string): NextInterviewResponse {
  return {
    replyText: "",
    score: 0,
    feedback: "面试已经结束，请查看最终报告或重置后开始新的面试。",
    suggestion: "如需继续练习，请点击 Reset Demo 后重新开始。",
    shouldEnd: true,
    sessionId,
    status: "ended",
    nextAllowed: false,
    reportReady: true,
    message: "Interview has ended. Please reset to start a new session.",
  };
}

function stripEndInterviewPhrases(text: string): string {
  const endPhrases = [
    "本次面试到此结束",
    "面试结束",
    "今天的面试到这里",
    "今天就到这里",
    "后续我们会通知",
    "后续会通知",
    "请点击 End Interview",
    "查看完整报告",
  ];
  return endPhrases.reduce((current, phrase) => current.replaceAll(phrase, ""), text).trim();
}

function createRedirectQuestion(answer: string, candidateRounds: number): string {
  if (isCompensationQuestion(answer)) {
    return "薪资和福利通常会在 HR 或后续流程中沟通。我们先回到当前面试：请你结合一个项目，说明你在核心问题上的具体处理过程。";
  }

  if (isQuestionChangeRequest(answer)) {
    return "可以，我们换一个相关但更基础的问题。请你从最近做过的项目里选一个模块，说明你负责的技术决策和最终结果。";
  }

  if (isShortUnknownAnswer(answer)) {
    return "没关系，我们换一个更基础的角度。请你先说说这个知识点在实际项目里通常解决什么问题。";
  }

  return candidateRounds <= 1
    ? "请结合一个真实项目，补充你当时的背景、具体行动和最终结果。"
    : "请继续说明一个关键技术取舍，以及你如何验证这个方案有效。";
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 60;
  }

  return Math.min(100, Math.max(0, Math.round(score <= 10 ? score * 10 : score)));
}

function isCompensationQuestion(answer: string): boolean {
  return /薪资|工资|待遇|福利|加班|offer|hr/i.test(answer);
}

function isQuestionChangeRequest(answer: string): boolean {
  return /换.*题|换.*问题|换一个|不太熟|不会|没做过/i.test(answer) && answer.length > 8;
}

function isShortUnknownAnswer(answer: string): boolean {
  return /^(不会|不太会|不知道|不清楚|没做过|不了解|不会。|不知道。|不清楚。)$/i.test(answer.trim());
}

function debugInterviewFlow(action: string, details: Record<string, unknown>) {
  console.info("[AvaCoach Interview Flow]", {
    action,
    ...details,
  });
}

export default interviewRouter;
