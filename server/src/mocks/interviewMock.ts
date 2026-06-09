import type {
  InterviewRole,
  Message,
  NextInterviewResponse,
  ReportInterviewResponse,
  StartInterviewResponse,
} from "../types/interview.js";

const roleProfiles: Record<
  InterviewRole,
  {
    label: string;
    opening: string;
    firstQuestion: string;
    followUps: string[];
    keywords: string[];
  }
> = {
  frontend: {
    label: "前端工程师",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会围绕前端工程能力、项目经验和技术表达做一轮模拟面试。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合前端工程师这个岗位。",
    followUps: [
      "你能结合一个实际项目，说明你如何定位并优化前端性能问题吗？",
      "如果一个复杂页面出现交互卡顿，你会如何拆解和排查？",
      "你在组件化或工程化方面做过哪些改进，最后带来了什么结果？",
    ],
    keywords: ["react", "typescript", "性能", "组件", "工程化", "优化", "用户体验"],
  },
  backend: {
    label: "后端工程师",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会重点看后端工程、接口设计、数据一致性和系统可靠性。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合后端工程师这个岗位。",
    followUps: [
      "你能结合一个项目，说明你如何设计稳定的 API 边界吗？",
      "如果线上接口突然变慢，你会如何定位瓶颈并降低影响？",
      "请分享一次你优化数据库、缓存或服务可靠性的经历。",
    ],
    keywords: ["node", "api", "database", "cache", "redis", "reliability", "system", "error"],
  },
  product: {
    label: "产品经理",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会关注产品判断、需求分析和跨团队推进能力。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合产品经理这个岗位。",
    followUps: [
      "你能举例说明你如何判断一个需求是否值得做吗？",
      "当业务目标和用户体验发生冲突时，你通常如何取舍？",
      "请分享一次你通过数据或用户反馈推动产品迭代的经历。",
    ],
    keywords: ["用户", "需求", "数据", "指标", "优先级", "增长", "体验"],
  },
  ai: {
    label: "AI 工程师",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会围绕 AI 工程、模型应用和系统落地展开。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合 AI 工程师这个岗位。",
    followUps: [
      "你能结合一个 AI 项目，说明你如何评估模型效果吗？",
      "如果线上模型回答不稳定，你会如何定位并改进？",
      "请分享一次你把模型能力集成到真实产品流程中的经历。",
    ],
    keywords: ["模型", "prompt", "评估", "数据", "向量", "rag", "部署", "推理"],
  },
  behavioral: {
    label: "通用行为面试",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会做一轮通用行为面试，重点关注经历表达和复盘能力。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你最近最有代表性的一段经历。",
    followUps: [
      "请用一个具体例子说明你如何面对压力或不确定性。",
      "当团队出现分歧时，你通常如何推动达成一致？",
      "请分享一次失败或结果不理想的经历，以及你后续学到了什么。",
    ],
    keywords: ["团队", "沟通", "冲突", "复盘", "目标", "结果", "协作"],
  },
};

export function createStartResponse(role: InterviewRole, topic?: string): StartInterviewResponse {
  const profile = roleProfiles[role] ?? roleProfiles.behavioral;
  const topicQuestion = createTopicStartQuestion(topic);
  const firstQuestion = topicQuestion || profile.firstQuestion;

  return {
    replyText: `${profile.opening} ${firstQuestion}`,
    question: firstQuestion,
    stage: "asking",
    source: "mock",
    provider: "mock",
    status: "in_progress",
    nextAllowed: true,
    reportReady: false,
  };
}

function createTopicStartQuestion(topic?: string): string {
  const normalized = topic?.trim();
  if (!normalized) {
    return "";
  }

  if (/vector|向量/i.test(normalized)) {
    return "我们先从 Vector Database 相关的问题开始。向量数据库相比普通数据库存数组，多解决了哪些问题？";
  }

  if (/http|network|cors/i.test(normalized)) {
    return "我们先从 HTTP / Network 相关的问题开始。请解释 CORS 的作用、预检请求触发条件，以及常见排查思路。";
  }

  if (/react/i.test(normalized)) {
    return "我们先从 React 相关的问题开始。请说明一次组件渲染变慢时，你会如何定位原因并做优化？";
  }

  if (/rag/i.test(normalized)) {
    return "我们先从 RAG 相关的问题开始。请说明你会如何设计一个可上线的知识库问答链路。";
  }

  return `我们先从 ${normalized} 相关的问题开始。请结合项目经验，说明你对这个方向的核心理解和处理思路。`;
}

export function createNextResponse(
  role: InterviewRole,
  answer: string,
  history: Message[],
): NextInterviewResponse {
  const profile = roleProfiles[role] ?? roleProfiles.behavioral;
  const candidateRounds = history.filter((item) => item.speaker === "candidate").length;
  const roundIndex = Math.max(0, candidateRounds - 1);
  const score = scoreAnswer(answer, profile.keywords);
  const shouldEnd = candidateRounds >= 3;
  const nextQuestion = createNextQuestion(answer, profile.followUps[roundIndex % profile.followUps.length]);
  const feedbackText = createFeedback(score, answer);
  const suggestion = createSuggestion(score, answer);

  return {
    replyText: shouldEnd
      ? `${feedbackText} 当前练习轮次已经完成，请点击 End Interview 查看完整报告。`
      : `${feedbackText} ${nextQuestion}`,
    score,
    feedback: feedbackText,
    suggestion,
    shouldEnd,
    source: "mock",
    provider: "mock",
    feedbackText,
    nextQuestion: shouldEnd ? "" : nextQuestion,
    scoringReason: createScoringReason(score, answer),
    status: shouldEnd ? "ended" : "in_progress",
    nextAllowed: !shouldEnd,
    reportReady: shouldEnd,
  };
}

export function createReportResponse(
  role: InterviewRole,
  history: Message[],
): ReportInterviewResponse {
  const profile = roleProfiles[role] ?? roleProfiles.behavioral;
  const answers = history
    .filter((item) => item.speaker === "candidate")
    .map((item) => item.text);
  const average = answers.length
    ? Math.round(
        answers.reduce((sum, answer) => sum + scoreAnswer(answer, profile.keywords), 0) /
          answers.length,
      )
    : 60;
  const overallScore = Math.min(96, Math.max(55, average + answers.length * 2));

  return {
    overallScore,
    strengths: [
      "表达比较完整",
      `能结合 ${profile.label} 的岗位方向回答`,
    ],
    weaknesses: [
      "例子还可以更具体",
      "结果量化和业务影响描述不足",
    ],
    suggestions: [
      "使用 STAR 结构组织回答",
      "多补充项目数据、决策依据和最终结果",
      "回答结尾主动总结和岗位能力的匹配点",
    ],
    source: "mock",
    provider: "mock",
    status: "ended",
    nextAllowed: false,
    reportReady: true,
  };
}

function createNextQuestion(answer: string, defaultQuestion: string): string {
  if (isCompensationQuestion(answer)) {
    return "薪资和流程通常会在后续 HR 环节详细沟通。我们先回到技术部分，请你结合一个项目，说明你在核心问题上的具体处理过程。";
  }

  if (isQuestionChangeRequest(answer)) {
    return "可以，我们换一个相关但更基础的问题。请你从最近做过的项目里选一个模块，说明你负责的技术决策和最终结果。";
  }

  if (isShortUnknownAnswer(answer)) {
    return "没关系，我们换一个更基础的角度。你可以先说说这个知识点在实际项目里通常解决什么问题。";
  }

  return `那我们沿着这个方向再看一个具体场景：${defaultQuestion}`;
}

function scoreAnswer(answer: string, keywords: string[]): number {
  const normalized = answer.toLowerCase();
  const lengthScore = answer.trim().length >= 180 ? 18 : answer.trim().length >= 80 ? 12 : 5;
  const keywordScore = keywords.reduce(
    (count, keyword) => count + (normalized.includes(keyword.toLowerCase()) ? 4 : 0),
    0,
  );
  const structureScore = ["背景", "行动", "结果", "star", "指标", "复盘"].some((keyword) =>
    normalized.includes(keyword),
  )
    ? 8
    : 0;
  const evidenceScore = /(\d+%?|\d+\s*(ms|秒|人|次|万)|上线|项目|数据|指标)/i.test(answer) ? 8 : 0;
  const unknownCap = isShortUnknownAnswer(answer) ? 55 : 95;

  return Math.min(unknownCap, Math.max(40, 50 + lengthScore + keywordScore + structureScore + evidenceScore));
}

function createFeedback(score: number, answer: string): string {
  if (isShortUnknownAnswer(answer)) {
    return "没关系，这类问题可以先从基础概念切入。";
  }

  if (isQuestionChangeRequest(answer)) {
    return "可以，面试里遇到不熟的点很正常，我们换个更容易展开的角度。";
  }

  if (isCompensationQuestion(answer)) {
    return "薪资和流程通常会在后续 HR 环节详细沟通，我们先把技术部分完成。";
  }

  const specificFeedback = createSpecificFeedback(answer);
  if (specificFeedback) {
    return specificFeedback;
  }

  if (score >= 82) {
    return "这轮回答比较清晰，能体现岗位相关经验，并且有一定结构感。";
  }

  if (answer.trim().length < 80) {
    return "这轮回答还比较简短，面试官暂时很难判断你的真实处理经验。";
  }

  return "回答比较完整，但还缺少更具体的项目细节、行动过程和结果证明。";
}

function createSpecificFeedback(answer: string): string {
  const normalized = answer.toLowerCase();

  if (
    /devtools|lighthouse|bundle|analyzer|懒加载|按需|图片|cdn|首屏|长任务|重排|重绘|内存/i.test(answer)
  ) {
    return "你把性能优化拆到了定位工具、资源体积和运行时表现几个层面，这个排查路径比较贴近真实项目。";
  }

  if (/flex|grid|媒体查询|响应式|rem|vw|vh|多语言|按钮/i.test(answer)) {
    return "你能把布局方案和适配场景联系起来说明，说明你对响应式问题有基本的工程判断。";
  }

  if (/react|usememo|usecallback|memo|state|props|渲染/i.test(normalized)) {
    return "你提到的 React 渲染相关点比较实用，后续可以再结合一次真实排查过程说明取舍。";
  }

  if (/http|dns|tcp|tls|请求|响应|状态码|缓存/i.test(answer)) {
    return "你能从请求链路和响应结果两侧理解问题，这比只看接口返回更完整。";
  }

  return "";
}

function createSuggestion(score: number, answer: string): string {
  if (score >= 82) {
    return "建议进一步补充量化结果，让优势更有说服力。";
  }

  if (answer.trim().length < 80) {
    return "建议至少补充一个具体案例，并说明背景、你的行动和结果。";
  }

  return "建议使用 STAR 结构补充背景、行动和结果，并突出你个人负责的部分。";
}

function createScoringReason(score: number, answer: string): string {
  if (isShortUnknownAnswer(answer)) {
    return "本轮得分较低，主要是因为回答没有提供有效内容，暂时无法判断对核心知识点的掌握情况。";
  }

  if (score >= 85) {
    return "本轮回答结构比较清晰，能结合岗位方向和实际经验，因此得分较高。";
  }

  if (score >= 70) {
    return "本轮回答方向基本正确，但还可以补充更具体的项目场景、行动过程和结果证明。";
  }

  return "本轮回答还有较多可展开空间，建议先补充核心概念，再结合具体案例说明。";
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
