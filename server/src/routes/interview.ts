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
  InterviewRole,
  KnowledgeFeedback,
  NextInterviewRequest,
  QuestionMeta,
  ReportInterviewRequest,
  StartInterviewRequest,
} from "../types/interview.js";

const interviewRouter = Router();

const validRoles: InterviewRole[] = ["frontend", "backend", "product", "ai", "behavioral"];

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
    });
    return;
  }

  res.json(await generateOpeningAndFirstQuestion(role));
});

interviewRouter.post("/next", async (req, res) => {
  const body = req.body as Partial<NextInterviewRequest>;
  const role = normalizeRole(body.role);
  const answer = String(body.answer ?? "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const questionMeta = normalizeQuestionMeta(body.questionMeta);

  if (!answer) {
    res.status(400).json({ error: "answer is required" });
    return;
  }

  const llmResponse = await generateFollowUp(role, answer, history, {
    questionMeta,
  });

  if (!questionMeta) {
    res.json(llmResponse);
    return;
  }

  const knowledgeFeedback = evaluateAnswerAgainstQuestion(answer, questionMeta);
  const candidateRounds = history.filter((message) => message.speaker === "candidate").length;
  const preferredFollowUp = questionMeta.followUps?.[
    Math.max(0, candidateRounds - 1) % (questionMeta.followUps.length || 1)
  ];

  res.json({
    ...llmResponse,
    questionMeta,
    knowledgeFeedback,
    feedback: mergeFeedback(llmResponse.feedback, knowledgeFeedback),
    suggestion: mergeSuggestion(llmResponse.suggestion, knowledgeFeedback),
    replyText: preferredFollowUp
      ? `${llmResponse.replyText} ${preferredFollowUp}`
      : llmResponse.replyText,
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

  if (questionMetas.length === 0) {
    res.json(report);
    return;
  }

  const candidateAnswers = history.filter((message) => message.speaker === "candidate");
  const feedbackItems = questionMetas.map((questionMeta, index) =>
    evaluateAnswerAgainstQuestion(candidateAnswers[index]?.text ?? "", questionMeta),
  );

  res.json({
    ...report,
    bankReport: createBankReportSummary(questionMetas, feedbackItems),
  });
});

function normalizeRole(role: unknown): InterviewRole {
  return validRoles.includes(role as InterviewRole) ? (role as InterviewRole) : "behavioral";
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

export default interviewRouter;
