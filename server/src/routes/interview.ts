import { Router } from "express";
import {
  generateFinalReport,
  generateFollowUp,
  generateOpeningAndFirstQuestion,
} from "../services/llm/llmService.js";
import {
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
  NextInterviewRequest,
  NextInterviewResponse,
  QuestionMeta,
  ReportInterviewRequest,
  StartInterviewRequest,
} from "../types/interview.js";

const interviewRouter = Router();

const validRoles: InterviewRole[] = ["frontend", "backend", "product", "ai", "behavioral"];
const MAX_ROUNDS = 3;

interviewRouter.post("/start", async (req, res) => {
  const body = req.body as Partial<StartInterviewRequest>;
  const role = normalizeRole(body.role);

  if (body.questionSource === "bank") {
    const question = pickQuestion({
      role: role === "product" ? "behavioral" : role,
      difficulty: normalizeDifficulty(body.difficulty),
      topic: typeof body.topic === "string" ? body.topic : undefined,
    });
    const questionMeta = toQuestionMeta(question);

    res.json({
      replyText: `接下来我们使用 AvaCoach IT 题库中的一道 ${question.topic} 题。${question.question}`,
      question: question.question,
      stage: "asking",
      source: "bank",
      provider: "mock",
      questionMeta,
      status: "in_progress",
      nextAllowed: true,
      reportReady: false,
    });
    return;
  }

  const response = await generateOpeningAndFirstQuestion(role);
  res.json({
    ...response,
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
  const questionMeta = normalizeQuestionMeta(body.questionMeta);
  const requestStatus = normalizeStatus(body.status);
  const candidateRounds = history.filter((message) => message.speaker === "candidate").length;

  if (requestStatus === "ended") {
    debugInterviewFlow("next_blocked", {
      previousStatus: requestStatus,
      nextStatus: "ended",
      round: candidateRounds,
      nextAllowed: false,
      reportReady: true,
      reason: "request-status-ended",
    });
    res.json(createEndedNextResponse());
    return;
  }

  if (!answer) {
    res.status(400).json({ error: "answer is required" });
    return;
  }

  if (candidateRounds > MAX_ROUNDS) {
    debugInterviewFlow("next_blocked", {
      previousStatus: "in_progress",
      nextStatus: "ended",
      round: candidateRounds,
      nextAllowed: false,
      reportReady: true,
      reason: "max-rounds-exceeded",
    });
    res.json(createEndedNextResponse("当前轮次已经完成，请点击 End Interview 查看完整报告。"));
    return;
  }

  const reachedMaxRounds = candidateRounds >= MAX_ROUNDS;
  const llmResponse = await generateFollowUp(role, answer, history, {
    questionMeta,
  });
  const normalizedLlmResponse = normalizeNextResponseForFlow({
    response: llmResponse,
    answer,
    candidateRounds,
    reachedMaxRounds,
  });

  if (!questionMeta) {
    const status = reachedMaxRounds ? "ended" : "in_progress";
    debugInterviewFlow("next_response", {
      previousStatus: "in_progress",
      nextStatus: status,
      round: candidateRounds,
      nextAllowed: !reachedMaxRounds,
      reportReady: reachedMaxRounds,
      reason: "llm-mode",
    });
    res.json({
      ...normalizedLlmResponse,
      shouldEnd: reachedMaxRounds || normalizedLlmResponse.shouldEnd,
      status,
      nextAllowed: !reachedMaxRounds,
      reportReady: reachedMaxRounds,
    });
    return;
  }

  const knowledgeFeedback = evaluateAnswerAgainstQuestion(answer, questionMeta);
  const preferredFollowUp = questionMeta.followUps?.[
    Math.max(0, candidateRounds - 1) % (questionMeta.followUps.length || 1)
  ];
  const replyText = reachedMaxRounds
    ? buildMaxRoundReply(normalizedLlmResponse.replyText)
    : buildBankModeReply(normalizedLlmResponse.replyText, preferredFollowUp);

  debugInterviewFlow("next_response", {
    previousStatus: "in_progress",
    nextStatus: reachedMaxRounds ? "ended" : "in_progress",
    round: candidateRounds,
    nextAllowed: !reachedMaxRounds,
    reportReady: reachedMaxRounds,
    reason: containsEndInterviewPhrase(llmResponse.replyText) && !reachedMaxRounds
      ? "sanitized-premature-ending"
      : "bank-mode",
  });

  res.json({
    ...normalizedLlmResponse,
    questionMeta,
    knowledgeFeedback,
    feedback: mergeFeedback(normalizedLlmResponse.feedback, knowledgeFeedback),
    suggestion: mergeSuggestion(normalizedLlmResponse.suggestion, knowledgeFeedback),
    replyText,
    shouldEnd: reachedMaxRounds,
    status: reachedMaxRounds ? "ended" : "in_progress",
    nextAllowed: !reachedMaxRounds,
    reportReady: reachedMaxRounds,
  });
});

interviewRouter.post("/report", async (req, res) => {
  const body = req.body as Partial<ReportInterviewRequest>;
  const role = normalizeRole(body.role);
  const history = Array.isArray(body.history) ? body.history : [];
  const questionMetas = Array.isArray(body.questionMetas)
    ? body.questionMetas.map(normalizeQuestionMeta).filter((item): item is QuestionMeta => Boolean(item))
    : [];

  const report = await generateFinalReport(role, history);

  debugInterviewFlow("report_response", {
    previousStatus: "in_progress",
    nextStatus: "ended",
    round: history.filter((message) => message.speaker === "candidate").length,
    nextAllowed: false,
    reportReady: true,
    reason: "report-generated",
  });

  if (questionMetas.length === 0) {
    res.json({
      ...report,
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
    status: "ended",
    nextAllowed: false,
    reportReady: true,
  });
});

function normalizeRole(role: unknown): InterviewRole {
  return validRoles.includes(role as InterviewRole) ? (role as InterviewRole) : "behavioral";
}

function normalizeStatus(value: unknown): InterviewFlowStatus {
  return value === "ended" ? "ended" : "in_progress";
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

function mergeFeedback(
  baseFeedback: string,
  knowledgeFeedback: KnowledgeFeedback,
): string {
  const covered = knowledgeFeedback.coveredPoints.length;
  const missing = knowledgeFeedback.missingPoints.length;

  return `${baseFeedback} 知识点检查：已覆盖 ${covered} 个期望要点，遗漏 ${missing} 个。`;
}

function mergeSuggestion(
  baseSuggestion: string,
  knowledgeFeedback: KnowledgeFeedback,
): string {
  const firstTip = knowledgeFeedback.improvementTips[0];

  return firstTip ? `${baseSuggestion} ${firstTip}` : baseSuggestion;
}

function createEndedNextResponse(replyText = ""): NextInterviewResponse {
  return {
    replyText,
    score: 0,
    feedback: "面试已结束，请查看最终报告或重置后开始新的面试。",
    suggestion: "如需继续练习，请点击 Reset Demo 后重新开始。",
    shouldEnd: true,
    status: "ended",
    nextAllowed: false,
    reportReady: true,
    message: "Interview has ended. Please reset to start a new session.",
  };
}

function normalizeNextResponseForFlow({
  response,
  answer,
  candidateRounds,
  reachedMaxRounds,
}: {
  response: NextInterviewResponse;
  answer: string;
  candidateRounds: number;
  reachedMaxRounds: boolean;
}): NextInterviewResponse {
  if (reachedMaxRounds) {
    return {
      ...response,
      replyText: stripEndInterviewPhrases(response.replyText),
      shouldEnd: true,
    };
  }

  if (!containsEndInterviewPhrase(response.replyText) && !response.shouldEnd) {
    return {
      ...response,
      shouldEnd: false,
    };
  }

  return {
    ...response,
    replyText: createRedirectQuestion(answer, candidateRounds),
    shouldEnd: false,
  };
}

function containsEndInterviewPhrase(text: string): boolean {
  return [
    "本次面试到此结束",
    "面试结束",
    "今天的面试到这里",
    "今天就到这里",
    "后续我们会通知",
    "后续会通知",
  ].some((phrase) => text.includes(phrase));
}

function stripEndInterviewPhrases(text: string): string {
  const cleaned = [
    "本次面试到此结束",
    "面试结束",
    "今天的面试到这里",
    "今天就到这里",
    "后续我们会通知",
    "后续会通知",
  ].reduce((current, phrase) => current.replaceAll(phrase, ""), text).trim();

  return cleaned || "这一轮回答已经完成。";
}

function buildBankModeReply(replyText: string, followUp?: string): string {
  const cleaned = stripEndInterviewPhrases(replyText);

  if (!followUp || cleaned.includes(followUp)) {
    return cleaned;
  }

  return `${cleaned} 我继续追问一个相关问题：${followUp}`;
}

function buildMaxRoundReply(replyText: string): string {
  const cleaned = stripEndInterviewPhrases(replyText);
  return `${cleaned} 当前练习轮次已经完成，请点击 End Interview 查看完整报告。`;
}

function createRedirectQuestion(answer: string, candidateRounds: number): string {
  if (isCompensationQuestion(answer)) {
    return "薪资和福利通常会在 HR 或后续流程里详细沟通。我们先回到当前技术面试：请你结合一个项目，说说你在核心技术问题上的具体处理过程。";
  }

  if (isQuestionChangeRequest(answer)) {
    return "可以，我们换一个相关但更具体的问题。请你从最近做过的项目里选一个模块，说明你负责的技术决策和最终结果。";
  }

  if (isShortUnknownAnswer(answer)) {
    return "没关系，我们换一个更基础的角度。请你先说说这个知识点在实际项目里通常解决什么问题。";
  }

  return candidateRounds <= 1
    ? "你的回答方向可以继续展开。请结合一个真实项目，补充你当时的背景、具体行动和最终结果。"
    : "这个回答可以再具体一些。请你继续说明一个关键技术取舍，以及你如何验证这个方案有效。";
}

function isCompensationQuestion(answer: string): boolean {
  return /薪资|工资|待遇|福利|加班|offer|hr/i.test(answer);
}

function isQuestionChangeRequest(answer: string): boolean {
  return /换.*题|换.*问题|换一.*道|不太熟|不会|没做过/i.test(answer) && answer.length > 8;
}

function isShortUnknownAnswer(answer: string): boolean {
  return /^(不会|不知道|不清楚|没做过|不了解|不会。|不知道。|不清楚。)$/i.test(answer.trim());
}

function debugInterviewFlow(action: string, details: Record<string, unknown>) {
  console.info("[AvaCoach Interview Flow]", {
    action,
    ...details,
  });
}

export default interviewRouter;
