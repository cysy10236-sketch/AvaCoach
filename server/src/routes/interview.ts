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

const internalReplyTerms = [
  "你的回答提到了一些关键方向",
  "这个思路是可以继续展开的",
  "我继续追问一个相关问题",
  "知识点检查",
  "LLM 基础分",
  "覆盖度校准分",
  "综合得分",
  "加权",
  "校准",
  "expectedPoints",
  "coveredPoints",
  "missingPoints",
  "scoringReason",
  "score=",
  "/100",
];

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
      replyText: buildNaturalBankStartReply(question.topic, question.question),
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
    replyText: sanitizeInterviewerReply(response.replyText, response.question),
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
  const feedbackSummary = sanitizeFeedbackSummary(
    llmResponse.feedbackSummary || llmResponse.feedbackText || llmResponse.feedback,
  );
  const nextQuestion = nextAllowed
    ? pickOneQuestion(llmResponse.nextQuestion) || createRedirectQuestion(answer, candidateRounds)
    : "";
  const rawInterviewerReply = llmResponse.interviewerReply
    || composeInterviewerReply(createNaturalInterviewerFeedback(answer, undefined, llmResponse.score), nextQuestion, reachedMaxRounds);
  const interviewerReply = sanitizeInterviewerReply(rawInterviewerReply, nextQuestion);

  return {
    ...llmResponse,
    interviewerReply,
    feedbackSummary,
    feedbackText: feedbackSummary,
    replyText: interviewerReply,
    feedback: feedbackSummary,
    suggestion: sanitizeFeedbackSummary(
      llmResponse.suggestion || llmResponse.improvementTips?.[0] || "建议补充更具体的背景、行动和结果。",
    ),
    nextQuestion,
    scoringReason: sanitizeScoringReason(llmResponse.scoringReason, llmResponse.score),
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
}: {
  answer: string;
  history: Message[];
  llmResponse: NextInterviewResponse;
  nextAllowed: boolean;
  questionMeta: QuestionMeta;
  reachedMaxRounds: boolean;
}): NextInterviewResponse {
  const knowledgeFeedback = evaluateAnswerAgainstQuestion(answer, questionMeta);
  const adjustedScore = calculateCoverageAdjustedScore({
    answer,
    knowledgeFeedback,
    llmScore: llmResponse.score,
    questionMeta,
  });
  const feedbackSummary = createCandidateFeedbackSummary({
    answer,
    knowledgeFeedback,
    llmSummary: llmResponse.feedbackSummary || llmResponse.feedbackText || llmResponse.feedback,
    questionMeta,
    score: adjustedScore.score,
  });
  const nextQuestion = nextAllowed
    ? pickBankNextQuestion({
        answer,
        fallbackQuestion: llmResponse.nextQuestion,
        history,
        questionMeta,
      })
    : "";
  const interviewerFeedback = createNaturalInterviewerFeedback(answer, knowledgeFeedback, adjustedScore.score);
  const interviewerReply = sanitizeInterviewerReply(
    composeInterviewerReply(interviewerFeedback, nextQuestion, reachedMaxRounds),
    nextQuestion,
  );

  return {
    ...llmResponse,
    source: "bank",
    questionMeta,
    knowledgeFeedback,
    coveredPoints: knowledgeFeedback.coveredPoints,
    missingPoints: knowledgeFeedback.missingPoints,
    improvementTips: knowledgeFeedback.improvementTips,
    interviewerReply,
    feedbackSummary,
    feedbackText: feedbackSummary,
    nextQuestion,
    replyText: interviewerReply,
    score: adjustedScore.score,
    feedback: feedbackSummary,
    suggestion: knowledgeFeedback.improvementTips[0] ?? llmResponse.suggestion,
    scoringReason: sanitizeScoringReason(adjustedScore.scoringReason, adjustedScore.score),
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
}): string {
  if (isCompensationQuestion(answer)) {
    return "请你结合一个项目，说说你在这个知识点上的实际处理方式。";
  }

  if (isQuestionChangeRequest(answer)) {
    return createBasicQuestionForTopic(questionMeta.topic, "可以，我们换一道相关但更基础的问题。");
  }

  if (isShortUnknownAnswer(answer)) {
    return createBasicQuestionForTopic(questionMeta.topic, "没关系，我们从更基础的角度来。");
  }

  const candidateRounds = history.filter((message) => message.speaker === "candidate").length;
  const bankFollowUp = questionMeta.followUps?.[
    Math.max(0, candidateRounds - 1) % (questionMeta.followUps.length || 1)
  ];

  return pickOneQuestion(fallbackQuestion) || bankFollowUp || "请你结合一个真实项目，补充这个方案的取舍、验证方式和最终结果。";
}

function buildNaturalBankStartReply(topic: string, question: string): string {
  const normalizedTopic = topic.trim();
  const topicLead =
    normalizedTopic && normalizedTopic.toLowerCase() !== "general"
      ? `我们先从 ${normalizedTopic} 相关的问题开始。`
      : "我们先从一个基础技术问题开始。";

  return sanitizeInterviewerReply(`${topicLead}${question}`, question);
}

function createCandidateFeedbackSummary({
  answer,
  knowledgeFeedback,
  llmSummary,
  questionMeta,
  score,
}: {
  answer: string;
  knowledgeFeedback: KnowledgeFeedback;
  llmSummary?: string;
  questionMeta: QuestionMeta;
  score: number;
}): string {
  if (isShortUnknownAnswer(answer)) {
    return `这轮回答还没有展开 ${questionMeta.topic} 的核心内容。可以先从它解决什么问题、常见使用场景和一个简单例子开始补充。`;
  }

  const safeLlmSummary = sanitizeFeedbackSummary(llmSummary);
  if (safeLlmSummary && !containsInternalText(safeLlmSummary)) {
    return safeLlmSummary;
  }

  if (knowledgeFeedback.coveredPoints.length === 0) {
    return `你的回答还比较简略，目前没有充分展开 ${questionMeta.topic} 中的关键环节。建议从核心概念、处理步骤和实际场景三个角度补充。`;
  }

  if (score >= 85) {
    return createSpecificFeedbackSummary(answer, "这轮回答比较完整，既讲到了技术手段，也体现出你有实际处理问题的经验。后续如果能补充优化前后的指标对比，会更像一次真实项目复盘。");
  }

  if (score >= 70) {
    return createSpecificFeedbackSummary(answer, "这轮回答能围绕问题本身展开，整体思路是成立的。建议继续补充具体场景、关键步骤和结果验证，让面试官更容易判断你的实际贡献。");
  }

  return "这轮回答已经有起点，但还缺少足够的技术细节和项目语境。建议把概念解释、实际处理过程和最终结果说得更完整。";
}

function createNaturalInterviewerFeedback(
  answer: string,
  knowledgeFeedback: KnowledgeFeedback | undefined,
  score: number,
): string {
  if (isQuestionChangeRequest(answer)) {
    return "可以，我们换一个更基础、但仍然相关的问题。";
  }

  if (isShortUnknownAnswer(answer)) {
    return "没关系，我们先从更基础的角度来。";
  }

  if (isCompensationQuestion(answer)) {
    return "薪资和流程通常会在后续 HR 环节详细沟通，我们先把这轮技术面试推进完整。";
  }

  const specificFeedback = createSpecificInterviewerFeedback(answer);
  if (specificFeedback) {
    return specificFeedback;
  }

  if (knowledgeFeedback && knowledgeFeedback.coveredPoints.length > 0) {
    const coveredPoint = knowledgeFeedback.coveredPoints[0];
    return `你刚才提到的「${coveredPoint}」是这个问题里比较重要的一点。接下来我们把它放到真实项目场景里看。`;
  }

  if (score >= 80) {
    return "这个回答比较完整，既讲到了处理思路，也能看出你有一定实践经验。";
  }

  return "我了解你的思路了。接下来我们换个更具体的场景继续看这个问题。";
}

function createSpecificInterviewerFeedback(answer: string): string {
  const signals = collectAnswerSignals(answer);

  if (signals.performance.length >= 3) {
    return `你提到了 ${signals.performance.slice(0, 4).join("、")}，能看出你会从加载体积和运行时表现两侧排查性能问题。`;
  }

  if (signals.responsive.length >= 2) {
    return `你能把 ${signals.responsive.slice(0, 3).join("、")} 结合起来说明，说明你对响应式布局有基本实战理解。`;
  }

  if (signals.react.length >= 2) {
    return `你提到的 ${signals.react.slice(0, 3).join("、")} 都和 React 组件渲染质量有关，这个切入点比较贴近实际开发。`;
  }

  if (signals.network.length >= 2) {
    return `你把 ${signals.network.slice(0, 3).join("、")} 这些链路环节放在一起考虑，说明你不是只看单个接口结果。`;
  }

  if (signals.project.length >= 1) {
    return "你能结合项目场景来回答，这一点比较好。接下来可以再把当时的判断依据和结果说得更具体。";
  }

  return "";
}

function createSpecificFeedbackSummary(answer: string, fallback: string): string {
  const signals = collectAnswerSignals(answer);

  if (signals.performance.length >= 3) {
    return `这轮回答能围绕性能优化的排查路径展开，提到了 ${signals.performance.slice(0, 5).join("、")}，整体方向比较清晰。后续如果能补充优化前后的指标对比，会更像真实项目复盘。`;
  }

  if (signals.responsive.length >= 2) {
    return `这轮回答能围绕布局适配展开，提到了 ${signals.responsive.slice(0, 4).join("、")}，说明你理解响应式方案不是单一属性就能解决的。后续可以补充复杂文案、多语言或极端屏幕下的处理方式。`;
  }

  if (signals.react.length >= 2) {
    return `这轮回答能结合 ${signals.react.slice(0, 4).join("、")} 说明 React 相关问题，方向比较贴近工程实践。后续可以补充一次真实排查过程和最终收益。`;
  }

  if (signals.network.length >= 2) {
    return `这轮回答能从 ${signals.network.slice(0, 4).join("、")} 等环节理解网络请求，基础链路比较清楚。后续可以补充异常场景和排查工具。`;
  }

  return fallback;
}

interface AnswerSignals {
  performance: string[];
  responsive: string[];
  react: string[];
  network: string[];
  project: string[];
}

function collectAnswerSignals(answer: string): AnswerSignals {
  const specs: Record<keyof AnswerSignals, Array<[string, RegExp]>> = {
    performance: [
      ["DevTools", /devtools/i],
      ["Lighthouse", /lighthouse/i],
      ["bundle 分析", /bundle|analyzer/i],
      ["路由懒加载", /懒加载|lazy/i],
      ["按需引入", /按需/],
      ["图片压缩", /图片|webp|压缩/],
      ["CDN 缓存", /cdn|缓存/i],
      ["首屏体积", /首屏|体积/],
      ["长任务", /长任务|long task/i],
      ["重排重绘", /重排|重绘|layout|paint/i],
      ["内存占用", /内存|memory/i],
    ],
    responsive: [
      ["Flex", /flex/i],
      ["Grid", /grid/i],
      ["媒体查询", /媒体查询|media query/i],
      ["相对单位", /相对单位|rem|em|vw|vh|%/i],
      ["多语言文案", /多语言|文案|按钮/],
    ],
    react: [
      ["React", /react/i],
      ["useMemo", /usememo/i],
      ["useCallback", /usecallback/i],
      ["memo", /\bmemo\b/i],
      ["state", /\bstate\b|状态/],
      ["props", /\bprops\b/i],
      ["渲染优化", /渲染|render/i],
    ],
    network: [
      ["HTTP", /http/i],
      ["DNS", /dns/i],
      ["TCP", /tcp/i],
      ["TLS", /tls|https/i],
      ["请求响应", /请求|响应/],
      ["状态码", /状态码|status/i],
      ["缓存", /缓存|cache/i],
    ],
    project: [
      ["项目", /项目|上线|生产|业务|指标|数据|复盘|\d+%|\d+\s*ms/i],
    ],
  };

  const collect = (groupSpecs: Array<[string, RegExp]>) =>
    groupSpecs
      .filter(([, pattern]) => pattern.test(answer))
      .map(([label]) => label);

  return {
    performance: collect(specs.performance),
    responsive: collect(specs.responsive),
    react: collect(specs.react),
    network: collect(specs.network),
    project: collect(specs.project),
  };
}

function composeInterviewerReply(
  feedbackText: string,
  nextQuestion: string,
  reachedMaxRounds: boolean,
): string {
  const feedback = sanitizeInterviewerReply(stripEndInterviewPhrases(feedbackText).trim());

  if (reachedMaxRounds) {
    return sanitizeInterviewerReply(`${feedback || "这轮回答我已经记录。"} 当前练习轮次已经完成，可以点击 End Interview 查看完整报告。`);
  }

  const question = pickOneQuestion(nextQuestion);
  return sanitizeInterviewerReply(
    question
      ? `${feedback || "这轮回答我已经记录。"} ${question}`
      : feedback || "这轮回答我已经记录。请继续补充一个具体项目案例。",
    question,
  );
}

function sanitizeInterviewerReply(text: string, fallbackQuestion = ""): string {
  const original = stripEndInterviewPhrases(String(text ?? ""));
  const hasBlockedText = containsInternalText(original);
  const cleaned = stripInternalText(original)
    .replace(/^[。！？!?\s，,：:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || hasBlockedText || containsInternalText(cleaned)) {
    const question = pickOneQuestion(fallbackQuestion);
    return question
      ? `我了解你的思路了。我们换个更具体的角度继续看这个问题：${question}`
      : "我了解你的思路了。我们继续看一个更具体的场景。";
  }

  return cleaned;
}

function sanitizeFeedbackSummary(text?: string): string {
  const original = stripEndInterviewPhrases(String(text ?? ""));
  const hasBlockedText = containsInternalText(original);
  const cleaned = stripInternalText(original)
    .replace(/^[。！？!?\s，,：:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || hasBlockedText || containsInternalText(cleaned)) {
    return "这轮回答已经记录。建议围绕核心概念、具体场景、处理步骤和结果证明进一步补充，让回答更接近真实项目复盘。";
  }

  return cleaned;
}

function sanitizeScoringReason(text: string | undefined, score: number): string {
  const original = String(text ?? "");
  const hasBlockedText = containsInternalText(original);
  const cleaned = stripInternalText(original)
    .replace(/^[。！？!?\s，,：:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned && !hasBlockedText && !containsInternalText(cleaned)) {
    return cleaned;
  }

  if (score >= 90) {
    return "本轮得分较高，因为回答覆盖了主要解决方案，并结合了具体项目场景，能够体现实际工程经验。";
  }

  if (score >= 75) {
    return "本轮回答整体表现不错，能说明主要处理思路；如果再补充量化结果和更明确的技术细节，会更有说服力。";
  }

  if (score >= 60) {
    return "本轮回答有一定方向，但缺少更明确的技术细节和项目结果，因此分数处于中等水平。";
  }

  if (score >= 40) {
    return "本轮回答基础较弱，建议先补充核心概念，再结合一个具体场景说明处理思路。";
  }

  return "本轮得分较低，主要是因为回答没有充分展开核心内容，需要先补充基础知识点。";
}

function containsInternalText(text: string): boolean {
  return internalReplyTerms.some((term) => text.includes(term));
}

function stripInternalText(text: string): string {
  return internalReplyTerms.reduce((current, term) => current.replaceAll(term, ""), text)
    .replace(/题库覆盖度\s*\d+\s*\/\s*\d+[，,。]?/g, "")
    .replace(/已覆盖\s*\d+\s*个期望要点[，,、]\s*缺失\s*\d+\s*个要点[，,。]?/g, "")
    .replace(/LLM\s*基础分\s*\d+[，,。]?/gi, "")
    .replace(/覆盖度校准分\s*\d+[，,。]?/g, "")
    .replace(/综合得分\s*\d+[，,。]?/g, "")
    .replace(/score\s*=\s*\d+/gi, "")
    .replace(/\b\d+\s*\/\s*100\b/g, "");
}

function pickOneQuestion(value?: string): string {
  const text = stripInternalText(stripEndInterviewPhrases(String(value ?? ""))).trim();
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
  const feedbackSummary = sanitizeFeedbackSummary(
    response.feedbackSummary || response.feedbackText || response.feedback,
  );
  const nextQuestion = response.nextQuestion ? pickOneQuestion(response.nextQuestion) : "";
  const interviewerReply = response.interviewerReply || response.replyText;

  return {
    ...response,
    score: normalizeScore(response.score),
    interviewerReply: sanitizeInterviewerReply(interviewerReply, nextQuestion),
    feedbackSummary,
    feedbackText: feedbackSummary,
    feedback: feedbackSummary,
    nextQuestion,
    replyText: sanitizeInterviewerReply(interviewerReply, nextQuestion),
    scoringReason: sanitizeScoringReason(response.scoringReason, normalizeScore(response.score)),
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
    return "请你结合一个项目，说明你在核心问题上的具体处理过程。";
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

function createBasicQuestionForTopic(topic: string, prefix: string): string {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes("http") || normalizedTopic.includes("network")) {
    return `${prefix}你能简单说说浏览器发出一个 HTTP 请求到收到响应，大概会经历哪些步骤吗？`;
  }

  if (normalizedTopic.includes("react")) {
    return `${prefix}你能说说 React 组件重新渲染通常和哪些因素有关吗？`;
  }

  if (normalizedTopic.includes("performance") || normalizedTopic.includes("性能")) {
    return `${prefix}如果前端页面变慢，你第一步会观察哪些现象？`;
  }

  return `${prefix}你能先用自己的话解释一下这个知识点通常解决什么问题吗？`;
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
  return /换.*题|换.*问题|换一个|下一题|下一个|不太熟|不会|没做过/i.test(answer) && answer.length > 6;
}

function isShortUnknownAnswer(answer: string): boolean {
  const normalized = answer.trim().replace(/[。！？!?，,\s]/g, "");
  return /^(我|这个|这题|这道题)?(不会|不太会|不知道|不清楚|没做过|不了解|忘记了|没思路)$/.test(normalized);
}

function debugInterviewFlow(action: string, details: Record<string, unknown>) {
  console.info("[AvaCoach Interview Flow]", {
    action,
    ...details,
  });
}

export default interviewRouter;
