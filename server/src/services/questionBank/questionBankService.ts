import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import type {
  BankReportSummary,
  InterviewRole,
  KnowledgeFeedback,
  QuestionDifficulty,
  QuestionMeta,
} from "../../types/interview.js";
import type { InterviewQuestion, QuestionFilters } from "../../types/questionBank.js";

const compiledQuestionBankPath = fileURLToPath(
  new URL("../../data/interviewQuestionBank.json", import.meta.url),
);
const sourceQuestionBankPath = resolve(process.cwd(), "src/data/interviewQuestionBank.json");
const workspaceQuestionBankPath = resolve(
  process.cwd(),
  "server/src/data/interviewQuestionBank.json",
);
const questionBankPath = [
  compiledQuestionBankPath,
  sourceQuestionBankPath,
  workspaceQuestionBankPath,
].find((path) => existsSync(path));

const questions = JSON.parse(
  readFileSync(questionBankPath ?? compiledQuestionBankPath, "utf8"),
) as InterviewQuestion[];

const bankRoles = ["frontend", "backend", "ai", "behavioral"] as const;

export function getQuestionBankRoles(): InterviewQuestion["role"][] {
  return [...bankRoles];
}

export function getQuestionBankTopics(role: unknown): string[] {
  const normalizedRole = normalizeBankRole(role);

  return uniqueSorted(
    questions
      .filter((question) => question.role === normalizedRole)
      .map((question) => question.topic),
  );
}

export function getQuestionBankQuestions(filters: QuestionFilters): InterviewQuestion[] {
  const role = normalizeBankRole(filters.role);
  const normalizedTopic = normalizeTopic(filters.topic);
  const byRole = questions.filter((question) => question.role === role);
  const byTopic = normalizedTopic
    ? byRole.filter((question) => normalizeTopic(question.topic) === normalizedTopic)
    : byRole;
  const byDifficulty = filters.difficulty
    ? byTopic.filter((question) => question.difficulty === filters.difficulty)
    : byTopic;

  if (byDifficulty.length > 0) {
    return byDifficulty;
  }

  if (byTopic.length > 0) {
    return byTopic;
  }

  return byRole.length > 0 ? byRole : questions.filter((question) => question.role === "behavioral");
}

export function pickQuestion(filters: QuestionFilters): InterviewQuestion {
  const candidates = getQuestionBankQuestions(filters);
  const stableSeed = `${filters.role ?? "behavioral"}:${filters.difficulty ?? "any"}:${filters.topic ?? "any"}`;
  const index = stableHash(stableSeed) % candidates.length;

  return candidates[index] ?? questions.find((question) => question.role === "behavioral") ?? questions[0];
}

export function pickRandomQuestion(
  filters: QuestionFilters,
  excludeQuestionIds: string[] = [],
): InterviewQuestion {
  const candidates = getQuestionBankQuestions(filters);
  const excludedIds = new Set(excludeQuestionIds);
  const availableCandidates = candidates.filter((question) => !excludedIds.has(question.id));
  const pool = availableCandidates.length > 0 ? availableCandidates : candidates;
  const index = randomInt(Math.max(1, pool.length));

  return pool[index] ?? questions.find((question) => question.role === "behavioral") ?? questions[0];
}

export function toQuestionMeta(question: InterviewQuestion): QuestionMeta {
  return {
    id: question.id,
    role: question.role,
    difficulty: question.difficulty,
    topic: question.topic,
    expectedPoints: question.expectedPoints,
    followUps: question.followUps,
    tags: question.tags,
  };
}

export function evaluateAnswerAgainstQuestion(
  answer: string,
  questionMeta: QuestionMeta,
): KnowledgeFeedback {
  const normalizedAnswer = normalizeForMatching(answer);
  const directlyCoveredPoints = questionMeta.expectedPoints.filter((point) =>
    pointToKeywords(point).some((keyword) => normalizedAnswer.includes(keyword)),
  );
  const coveredPoints = directlyCoveredPoints.length > 0
    ? directlyCoveredPoints
    : estimateCoveredPointsByAnswerDepth(answer, questionMeta);
  const missingPoints = questionMeta.expectedPoints.filter(
    (point) => !coveredPoints.includes(point),
  );
  const improvementTips = createImprovementTips(missingPoints, questionMeta.topic);

  return {
    coveredPoints,
    missingPoints,
    improvementTips,
  };
}

export function calculateCoverageAdjustedScore({
  answer,
  knowledgeFeedback,
  llmScore,
  questionMeta,
}: {
  answer: string;
  knowledgeFeedback: KnowledgeFeedback;
  llmScore: number;
  questionMeta: QuestionMeta;
}): { score: number; scoringReason: string } {
  const expectedCount = Math.max(1, questionMeta.expectedPoints.length);
  const coverageRatio = knowledgeFeedback.coveredPoints.length / expectedCount;
  const normalizedLlmScore = normalizeScoreToHundred(llmScore);
  const answerLength = answer.trim().length;
  const concreteBonus = hasConcreteEvidence(answer) ? 6 : 0;
  const shortPenalty = answerLength < 40 ? 10 : answerLength < 80 ? 4 : 0;
  const unknownCap = isUnknownAnswer(answer) ? 55 : 100;

  const coverageScore =
    coverageRatio >= 0.8 ? 88 :
      coverageRatio >= 0.5 ? 76 :
        coverageRatio >= 0.25 ? 62 :
          45;
  const rawScore = Math.round(
    normalizedLlmScore * 0.45 + coverageScore * 0.55 + concreteBonus - shortPenalty,
  );
  const score = clamp(rawScore, 35, unknownCap);
  const scoringReason = createUserFriendlyScoringReason({
    answer,
    coverageRatio,
    hasConcreteEvidence: concreteBonus > 0,
    isShort: shortPenalty > 0,
    isUnknown: isUnknownAnswer(answer),
  });

  return {
    score,
    scoringReason,
  };
}

export function createBankReportSummary(
  questionMetas: QuestionMeta[],
  feedbackItems: KnowledgeFeedback[],
): BankReportSummary {
  const topicStats = new Map<string, { covered: number; missing: number }>();
  const missedKnowledgePoints = uniqueSorted(
    feedbackItems.flatMap((feedback) => feedback.missingPoints),
  ).slice(0, 8);

  questionMetas.forEach((meta, index) => {
    const feedback = feedbackItems[index];
    const current = topicStats.get(meta.topic) ?? { covered: 0, missing: 0 };
    current.covered += feedback?.coveredPoints.length ?? 0;
    current.missing += feedback?.missingPoints.length ?? 0;
    topicStats.set(meta.topic, current);
  });

  const sortedTopics = Array.from(topicStats.entries()).sort(
    ([, left], [, right]) => right.covered - right.missing - (left.covered - left.missing),
  );
  const strongTopics = sortedTopics
    .filter(([, stat]) => stat.covered >= stat.missing)
    .map(([topic]) => topic)
    .slice(0, 4);
  const weakTopics = sortedTopics
    .filter(([, stat]) => stat.missing > stat.covered)
    .map(([topic]) => topic)
    .slice(0, 4);

  return {
    strongTopics,
    weakTopics,
    missedKnowledgePoints,
    recommendedPracticeTopics: uniqueSorted([
      ...weakTopics,
      ...questionMetas.map((meta) => meta.topic),
    ]).slice(0, 6),
  };
}

export function normalizeBankRole(role: unknown): InterviewQuestion["role"] {
  return bankRoles.includes(role as InterviewQuestion["role"])
    ? (role as InterviewQuestion["role"])
    : "behavioral";
}

export function normalizeDifficulty(difficulty: unknown): QuestionDifficulty | undefined {
  return difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
    ? difficulty
    : undefined;
}

function createImprovementTips(missingPoints: string[], topic: string): string[] {
  if (missingPoints.length === 0) {
    return [`你的回答已经覆盖 ${topic} 的核心要点，建议再补充一个真实项目例子，让表达更有说服力。`];
  }

  return [
    `建议补充 ${topic} 中遗漏的要点：${missingPoints[0]}。`,
    "可以用一个具体项目案例说明你的取舍、行动和结果。",
    "回答结尾可以补一句你会如何在生产环境中应用这个知识点。",
  ];
}

function pointToKeywords(point: string): string[] {
  const normalized = normalizeForMatching(point);
  const wordKeywords = normalized
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 6);
  const chineseKeywords = (point.match(/[\u4e00-\u9fa5]{2,}/g) ?? [])
    .flatMap((phrase) => {
      const chunks: string[] = [];
      for (let index = 0; index < phrase.length - 1; index += 2) {
        chunks.push(phrase.slice(index, index + 2));
      }
      return chunks;
    })
    .filter((chunk) => !["能够", "说明", "结合", "考虑", "问题"].includes(chunk))
    .slice(0, 8);

  return [...wordKeywords, ...chineseKeywords];
}

function estimateCoveredPointsByAnswerDepth(
  answer: string,
  questionMeta: QuestionMeta,
): string[] {
  const trimmedLength = answer.trim().length;
  const topicMentioned = normalizeForMatching(answer).includes(
    normalizeForMatching(questionMeta.topic),
  );
  const count =
    trimmedLength >= 220 ? 3 :
      trimmedLength >= 120 ? 2 :
        trimmedLength >= 50 || topicMentioned ? 1 :
          0;

  return questionMeta.expectedPoints.slice(0, count);
}

function normalizeForMatching(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ").trim();
}

function normalizeTopic(topic: unknown): string {
  return String(topic ?? "").trim().toLowerCase();
}

function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function stableHash(value: string): number {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 7);
}

function normalizeScoreToHundred(score: number): number {
  if (!Number.isFinite(score)) {
    return 60;
  }

  return clamp(score <= 10 ? score * 10 : score, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hasConcreteEvidence(answer: string): boolean {
  return /(\d+%?|\d+\s*(ms|s|秒|分钟|人|次|万|千)|项目|上线|指标|结果|数据|复盘|STAR|背景|行动)/i.test(answer);
}

function isUnknownAnswer(answer: string): boolean {
  const normalized = answer.trim().replace(/[。！？!?，,\s]/g, "");
  return /^(我|这个|这题|这道题)?(不会|不太会|不知道|不清楚|没做过|不了解|忘记了|没思路)$/.test(normalized);
}

function createUserFriendlyScoringReason({
  answer,
  coverageRatio,
  hasConcreteEvidence,
  isShort,
  isUnknown,
}: {
  answer: string;
  coverageRatio: number;
  hasConcreteEvidence: boolean;
  isShort: boolean;
  isUnknown: boolean;
}): string {
  if (!answer.trim() || isUnknown) {
    return "本轮得分较低，主要因为回答没有展开核心知识点，也缺少具体场景或解决思路。";
  }

  if (coverageRatio >= 0.8 && hasConcreteEvidence) {
    return "本轮得分较高，因为回答覆盖了主要解决方案，并结合了具体项目场景，能够体现实际工程经验。";
  }

  if (hasConcreteEvidence && answer.trim().length >= 100) {
    return "本轮回答结合了实际项目场景和结果数据，整体表现较好；如果再补充核心技术细节，会更完整。";
  }

  if (coverageRatio >= 0.5) {
    return hasConcreteEvidence
      ? "本轮回答能说明主要处理思路，也提到了实际场景；如果再补充关键细节和量化结果，表现会更完整。"
      : "本轮回答有一定方向，但缺少更明确的技术细节和项目结果，因此分数处于中等水平。";
  }

  if (coverageRatio > 0 || !isShort) {
    return "本轮回答有一定方向，但展开还不够充分，建议补充核心概念解释、具体场景和排查思路。";
  }

  return "本轮得分较低，主要因为回答较简短，没有展开核心知识点，也缺少具体场景或解决思路。";
}

export function isBankRole(role: InterviewRole): role is InterviewQuestion["role"] {
  return bankRoles.includes(role as InterviewQuestion["role"]);
}
