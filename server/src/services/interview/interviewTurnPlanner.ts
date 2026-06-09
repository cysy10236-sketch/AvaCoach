import type {
  KnowledgeFeedback,
  Message,
  QuestionMeta,
} from "../../types/interview.js";

export type AnswerType = "complete" | "partial" | "unknown" | "change_topic" | "off_topic";
export type TurnAction = "deep_dive" | "shift_topic" | "lower_difficulty" | "summarize";

export interface PlannedInterviewTurn {
  answerType: AnswerType;
  action: TurnAction;
  interviewerFeedback: string;
  nextQuestion: string;
}

export function planInterviewTurn({
  answer,
  history,
  knowledgeFeedback,
  llmNextQuestion,
  questionMeta,
  reachedMaxRounds,
}: {
  answer: string;
  history: Message[];
  knowledgeFeedback?: KnowledgeFeedback;
  llmNextQuestion?: string;
  questionMeta?: QuestionMeta;
  reachedMaxRounds: boolean;
}): PlannedInterviewTurn {
  const answerType = classifyAnswer(answer, knowledgeFeedback);

  if (reachedMaxRounds) {
    return {
      answerType,
      action: "summarize",
      interviewerFeedback: createClosingFeedback(answer, questionMeta),
      nextQuestion: "",
    };
  }

  if (answerType === "unknown") {
    return {
      answerType,
      action: "lower_difficulty",
      interviewerFeedback: "没关系，我们先从更基础的角度来。",
      nextQuestion: createBasicQuestion(questionMeta?.topic),
    };
  }

  if (answerType === "change_topic") {
    return {
      answerType,
      action: "shift_topic",
      interviewerFeedback: "可以，面试里遇到不熟的点很正常，我们换一道相关但更容易展开的问题。",
      nextQuestion: createBasicQuestion(questionMeta?.topic),
    };
  }

  if (answerType === "off_topic") {
    return {
      answerType,
      action: "shift_topic",
      interviewerFeedback: "薪资和流程通常会在后续 HR 环节详细沟通，我们先把技术部分完成。",
      nextQuestion: pickDynamicQuestion({ history, llmNextQuestion, questionMeta, answerType }),
    };
  }

  return {
    answerType,
    action: answerType === "complete" ? "deep_dive" : "shift_topic",
    interviewerFeedback: createContextualFeedback(answer, knowledgeFeedback),
    nextQuestion: pickDynamicQuestion({ history, llmNextQuestion, questionMeta, answerType }),
  };
}

function classifyAnswer(answer: string, knowledgeFeedback?: KnowledgeFeedback): AnswerType {
  if (isQuestionChangeRequest(answer)) {
    return "change_topic";
  }

  if (isUnknownAnswer(answer)) {
    return "unknown";
  }

  if (isCompensationQuestion(answer)) {
    return "off_topic";
  }

  const coverageCount = knowledgeFeedback?.coveredPoints.length ?? 0;
  const concreteSignals = countConcreteSignals(answer);

  if (answer.trim().length >= 120 || coverageCount >= 3 || concreteSignals >= 3) {
    return "complete";
  }

  return "partial";
}

function pickDynamicQuestion({
  answerType,
  history,
  llmNextQuestion,
  questionMeta,
}: {
  answerType: AnswerType;
  history: Message[];
  llmNextQuestion?: string;
  questionMeta?: QuestionMeta;
}): string {
  const llmQuestion = pickOneQuestion(llmNextQuestion);

  if (llmQuestion && !isRepeatedQuestion(llmQuestion, history) && isTopicAligned(llmQuestion, questionMeta?.topic)) {
    return llmQuestion;
  }

  return createProgressionQuestion(questionMeta?.topic, history, answerType);
}

function createContextualFeedback(answer: string, knowledgeFeedback?: KnowledgeFeedback): string {
  const vectorFeedback = createVectorDatabaseFeedback(answer);
  if (vectorFeedback) {
    return vectorFeedback;
  }

  const httpFeedback = createHttpNetworkFeedback(answer);
  if (httpFeedback) {
    return httpFeedback;
  }

  const coveredPoint = knowledgeFeedback?.coveredPoints[0];
  if (coveredPoint) {
    return `你刚才提到的「${coveredPoint}」是这个问题里比较重要的一点。`;
  }

  if (answer.trim().length >= 120) {
    return "这个回答比较完整，既讲到了处理思路，也能看出你有一定实践经验。";
  }

  return "我抓到你的核心意思了，不过这个回答还可以再落到一个更具体的场景里。";
}

function createVectorDatabaseFeedback(answer: string): string {
  const signals = collectVectorSignals(answer);

  if (signals.initial.length >= 4) {
    return `你把向量库的价值拆成 ${signals.initial.slice(0, 5).join("、")}，这个回答比较完整。`;
  }

  if (/ann/i.test(answer) && /rag/i.test(answer) && answer.trim().length >= 60) {
    return "你把向量库的价值拆成 ANN 检索、量化压缩、混合过滤、分布式扩展和 RAG 场景，这个回答比较完整。";
  }

  if (signals.multiTenant.length >= 3) {
    return `你提到了 ${signals.multiTenant.slice(0, 4).join("、")}，这已经很接近真实 SaaS 多租户 RAG 的隔离设计。`;
  }

  if (signals.migration.length >= 3) {
    return `这个迁移方案比较稳，${signals.migration.slice(0, 4).join("、")} 这几步把风险控制链路覆盖到了。`;
  }

  if (/embedding/i.test(answer) && answer.trim().length >= 20) {
    return "这个迁移方案比较稳，双写、回刷、灰度和回滚链路都覆盖到了。";
  }

  return "";
}

function createHttpNetworkFeedback(answer: string): string {
  const signals = collect(answer, [
    ["CORS 和同源策略", /cors|同源|跨域/i],
    ["OPTIONS 预检", /options|预检/i],
    ["非简单请求触发条件", /put|delete|application\/json|自定义|token|headers?/i],
    ["Origin 与响应头匹配", /origin|allow-origin/i],
    ["Credentials/Cookie 约束", /credentials|cookie|凭证/i],
    ["Allow-Headers 配置", /allow-headers|headers/i],
    ["网关或异常响应统一 CORS 头", /网关|异常|统一返回|拦截/i],
    ["Max-Age 预检缓存", /max-age|缓存/i],
  ]);

  if (signals.length >= 4) {
    return `你把 CORS 排查拆到了 ${signals.slice(0, 5).join("、")}，这个思路比较贴近真实浏览器问题排查。`;
  }

  if (signals.length >= 2) {
    return `你提到了 ${signals.slice(0, 3).join("、")}，说明你不是只看接口状态码，而是在看浏览器的跨域校验链路。`;
  }

  return "";
}

function createClosingFeedback(answer: string, questionMeta?: QuestionMeta): string {
  const vectorFeedback = createVectorDatabaseFeedback(answer);

  if (vectorFeedback) {
    return `${vectorFeedback}当前这一组 ${questionMeta?.topic ?? "技术"} 练习已经完成，可以点击 End Interview 查看报告。`;
  }

  return `这轮回答我已经记录。当前这一组 ${questionMeta?.topic ?? "技术"} 练习已经完成，可以点击 End Interview 查看报告。`;
}

function createProgressionQuestion(
  topic: string | undefined,
  history: Message[],
  answerType: AnswerType,
): string {
  const normalizedTopic = String(topic ?? "").toLowerCase();

  if (normalizedTopic.includes("vector")) {
    return pickFirstFreshQuestion(history, [
      "如何保证多租户 RAG 系统中向量数据的数据隔离？",
      "如果要升级 embedding 模型，新模型产生的向量维度或语义空间可能变化，你会怎么平滑迁移现有向量数据？",
      "在 RAG 场景里，你会怎么选择向量库的索引类型和召回参数？",
      "向量检索线上效果变差时，你会从召回、排序、切分和 embedding 哪些环节排查？",
    ]);
  }

  if (isHttpNetworkTopic(normalizedTopic)) {
    return pickFirstFreshQuestion(history, [
      "假设 OPTIONS 请求返回 204 或 200，但真实 GET 请求仍然报跨域错误，你会从哪些响应头和请求配置继续排查？",
      "如果跨域问题只在接口异常时出现，正常响应没有问题，你会重点检查服务端哪一层配置？",
      "当前端请求需要携带 Cookie 或 Authorization 头时，CORS 配置上有哪些容易踩坑的点？",
      "如果线上跨域问题只在部分环境出现，你会怎么区分是浏览器缓存、网关配置还是后端服务差异？",
    ]);
  }

  if (normalizedTopic.includes("react")) {
    return pickFirstFreshQuestion(history, [
      "如果一个 React 页面交互变慢，你会怎么定位是状态更新、组件渲染还是数据请求导致的？",
      "当性能优化会增加代码复杂度时，你通常怎么权衡？",
      "你能结合一次真实项目说明 React 渲染优化前后的指标变化吗？",
    ]);
  }

  if (answerType === "complete") {
    return "我们深入一点：如果这个方案会带来额外复杂度，你通常怎么做技术取舍？";
  }

  return "你能结合一个真实项目，补充当时的背景、你的具体行动和最终结果吗？";
}

function createBasicQuestion(topic: string | undefined): string {
  const normalizedTopic = String(topic ?? "").toLowerCase();

  if (normalizedTopic.includes("vector")) {
    return "我们换个基础角度：向量数据库相比普通数据库直接存数组，核心多解决了哪些问题？";
  }

  if (normalizedTopic.includes("http") || normalizedTopic.includes("network")) {
    return "你能简单说说浏览器发出一个 HTTP 请求到收到响应，大概会经历哪些步骤吗？";
  }

  if (normalizedTopic.includes("react")) {
    return "你能说说 React 组件重新渲染通常和哪些因素有关吗？";
  }

  return "你能先用自己的话解释一下这个知识点通常解决什么问题吗？";
}

function pickFirstFreshQuestion(history: Message[], candidates: string[]): string {
  return candidates.find((question) => !isRepeatedQuestion(question, history)) ?? candidates[candidates.length - 1];
}

function isRepeatedQuestion(question: string, history: Message[]): boolean {
  const normalizedQuestion = normalizeText(question);
  return history
    .filter((message) => message.speaker === "interviewer")
    .some((message) => {
      const normalizedMessage = normalizeText(message.text);
      return normalizedMessage.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedMessage);
    });
}

function isTopicAligned(question: string, topic: string | undefined): boolean {
  const normalizedTopic = String(topic ?? "").toLowerCase();

  if (!normalizedTopic.includes("vector")) {
    if (isHttpNetworkTopic(normalizedTopic)) {
      return isHttpNetworkQuestionAligned(question);
    }

    return true;
  }

  return /向量|embedding|rag|召回|索引|多租户|隔离|检索|语义/i.test(question);
}

function isHttpNetworkTopic(normalizedTopic: string): boolean {
  return normalizedTopic.includes("http") || normalizedTopic.includes("network");
}

function isHttpNetworkQuestionAligned(question: string): boolean {
  if (/重试|retry/i.test(question)) {
    return false;
  }

  return /cors|跨域|options|origin|credentials|cookie|authorization|headers?|methods?|http|network|请求|响应|状态码|网关|浏览器|缓存|安全|异常/i.test(question);
}

function pickOneQuestion(value?: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const match = text.match(/[^。！？!?]*[？?]/);
  if (match?.[0]) {
    return match[0].trim();
  }

  return text.length > 120 ? `${text.slice(0, 120)}？` : text;
}

function collectVectorSignals(answer: string): {
  initial: string[];
  multiTenant: string[];
  migration: string[];
} {
  return {
    initial: collect(answer, [
      ["ANN 检索", /ann|近似|索引|毫秒|召回/i],
      ["量化压缩", /量化|压缩|存储优化|冷热/i],
      ["混合过滤", /混合|元数据|过滤/i],
      ["分布式扩展", /分布式|分片|水平扩容/i],
      ["RAG 场景", /rag|多模态|ai/i],
    ]),
    multiTenant: collect(answer, [
      ["Namespace", /namespace/i],
      ["Partition", /partition/i],
      ["Collection", /collection/i],
      ["tenant_id 强制注入", /tenant|租户|token/i],
      ["配额隔离", /配额|资源争抢/i],
      ["审计日志", /审计|日志/i],
    ]),
    migration: collect(answer, [
      ["双字段共存", /双字段|新旧向量|双存储/i],
      ["增量双写", /双写|新数据/i],
      ["存量异步回刷", /异步|回刷|批量/i],
      ["灰度切换", /灰度|切流量/i],
      ["快速回滚", /回滚/i],
    ]),
  };
}

function collect(answer: string, specs: Array<[string, RegExp]>): string[] {
  return specs.filter(([, pattern]) => pattern.test(answer)).map(([label]) => label);
}

function countConcreteSignals(answer: string): number {
  return collect(answer, [
    ["project", /项目|上线|生产|业务|指标|数据|复盘|\d+%|\d+\s*ms/i],
    ["architecture", /架构|分层|链路|方案|灰度|回滚|隔离|扩展/i],
    ["tool", /devtools|lighthouse|namespace|partition|collection|rag|embedding/i],
  ]).length;
}

function isCompensationQuestion(answer: string): boolean {
  return /薪资|工资|待遇|福利|加班|offer|hr/i.test(answer);
}

function isQuestionChangeRequest(answer: string): boolean {
  return /换.*题|换.*问题|换一个|下一题|下一个|不太熟|不会|没做过/i.test(answer) && answer.length > 6;
}

function isUnknownAnswer(answer: string): boolean {
  const normalized = answer.trim().replace(/[。！？!?，,\s]/g, "");
  return /^(我|这个|这题|这道题)?(不会|不太会|不知道|不清楚|没做过|不了解|忘记了|没思路)$/.test(normalized);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}
