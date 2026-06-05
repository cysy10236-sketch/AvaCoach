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
    label: "Frontend Engineer",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会围绕前端工程能力、项目经验和沟通表达做一轮模拟面试。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合前端工程师这个岗位。",
    followUps: [
      "你的回答提到了前端项目经验。请进一步说明你如何处理性能优化问题？",
      "如果一个复杂页面出现交互卡顿，你会如何定位并拆解问题？",
      "请分享一次你推动组件化、工程化或跨端体验改进的经历。",
    ],
    keywords: ["react", "typescript", "性能", "组件", "工程化", "优化", "用户体验"],
  },
  product: {
    label: "Product Manager",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会关注产品判断、需求分析和跨团队推进能力。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合产品经理这个岗位。",
    followUps: [
      "你的回答提到了产品经历。请说明你如何判断一个需求是否值得做？",
      "当业务目标和用户体验发生冲突时，你会如何做取舍？",
      "请分享一次你通过数据或用户反馈推动产品迭代的经历。",
    ],
    keywords: ["用户", "需求", "数据", "指标", "优先级", "增长", "体验"],
  },
  ai: {
    label: "AI Engineer",
    opening:
      "你好，我是 AvaCoach 的数字人面试官。今天我们会围绕 AI 工程、模型应用和系统落地展开。",
    firstQuestion:
      "请你先做一个简短的自我介绍，并说明你为什么适合 AI 工程师这个岗位。",
    followUps: [
      "你的回答提到了 AI 项目经验。请进一步说明你如何评估模型效果？",
      "如果线上模型回答不稳定，你会如何定位并改进？",
      "请分享一次你把模型能力集成到真实产品流程中的经历。",
    ],
    keywords: ["模型", "prompt", "评估", "数据", "向量", "rag", "部署", "推理"],
  },
  behavioral: {
    label: "General Behavioral",
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

export function createStartResponse(role: InterviewRole): StartInterviewResponse {
  const profile = roleProfiles[role] ?? roleProfiles.behavioral;

  return {
    replyText: `${profile.opening} ${profile.firstQuestion}`,
    question: profile.firstQuestion,
    stage: "asking",
  };
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
  const nextQuestion = shouldEnd
    ? "这一轮问题已经完成。你可以点击 End Interview 查看完整 mock 评估报告。"
    : profile.followUps[roundIndex % profile.followUps.length];

  return {
    replyText: nextQuestion,
    score,
    feedback: createFeedback(score, answer),
    suggestion: createSuggestion(score, answer),
    shouldEnd,
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
    : 6;
  const overallScore = Math.min(95, Math.max(55, average * 10 + answers.length * 2));

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
  };
}

function scoreAnswer(answer: string, keywords: string[]): number {
  const normalized = answer.toLowerCase();
  const lengthScore = answer.trim().length >= 180 ? 3 : answer.trim().length >= 80 ? 2 : 1;
  const keywordScore = keywords.reduce(
    (count, keyword) => count + (normalized.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
  const structureScore = ["背景", "行动", "结果", "star", "指标", "复盘"].some((keyword) =>
    normalized.includes(keyword),
  )
    ? 1
    : 0;

  return Math.min(10, Math.max(4, 4 + lengthScore + keywordScore + structureScore));
}

function createFeedback(score: number, answer: string): string {
  if (score >= 8) {
    return "回答比较清晰，能体现岗位相关经验，并且有一定结构感。";
  }

  if (answer.trim().length < 80) {
    return "回答方向是成立的，但信息量偏少，面试官还无法判断你的真实贡献。";
  }

  return "回答比较完整，但缺少更具体的项目细节、行动过程和结果证明。";
}

function createSuggestion(score: number, answer: string): string {
  if (score >= 8) {
    return "建议进一步补充量化结果，让优势更有说服力。";
  }

  if (answer.trim().length < 80) {
    return "建议至少补充一个具体案例，并说明背景、你的行动和结果。";
  }

  return "建议使用 STAR 结构补充背景、行动和结果，并突出你个人负责的部分。";
}
