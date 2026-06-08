import type {
  InterviewRole,
  LlmEvaluationContext,
  Message,
} from "../../types/interview.js";

export const roleLabels: Record<InterviewRole, string> = {
  frontend: "前端工程师",
  backend: "后端工程师",
  product: "产品经理",
  ai: "AI 工程师",
  behavioral: "通用行为面试",
};

const baseInterviewerInstruction = `
你是 AvaCoach，一位友好、专业、真实的中文 IT 面试官。你会围绕候选人选择的岗位进行模拟面试，问题、反馈和报告都以中文为主，React、Redis、RAG、LLM 等技术名词可以保留英文。

通用规则：
- 只返回严格 JSON，不要返回 markdown、代码块或 JSON 以外的解释。
- 每轮最多一个主问题，不要连续问多个问题。
- feedbackText 只能放反馈，不要包含新问题。
- nextQuestion 只能放一个问题，不能包含反馈铺垫。
- 语气自然、有面试感，不要机械重复“我继续追问一个相关问题”。
- 非 report/end 阶段禁止说“本次面试到此结束”“面试结束”“今天就到这里”“后续我们会通知”等结束话术。
- 候选人问薪资、福利、流程时，简短回应后拉回技术面试，不要结束。
- 候选人说不会、不知道、没做过时，温和降低难度或换角度问基础问题。
- 候选人要求换题时，换一个相关问题，不要结束。
`.trim();

export function buildStartPrompt(role: InterviewRole): string {
  return `
${baseInterviewerInstruction}

Task:
为 ${roleLabels[role]} 开始一轮模拟面试。请用自然中文开场，并提出第一道问题。

Return JSON:
{
  "replyText": "中文开场白加第一题",
  "question": "只包含第一题",
  "stage": "asking"
}
`.trim();
}

export function buildNextPrompt(
  role: InterviewRole,
  answer: string,
  history: Message[],
  context?: LlmEvaluationContext,
): string {
  const candidateRounds = history.filter((message) => message.speaker === "candidate").length;
  const maxRoundsReached = candidateRounds >= 3;

  return `
${baseInterviewerInstruction}

Role: ${roleLabels[role]}
Current phase: next
Candidate answer rounds so far: ${candidateRounds}
Max rounds reached: ${maxRoundsReached ? "yes" : "no"}
${formatQuestionContext(context)}

Conversation history:
${formatHistory(history)}

Latest candidate answer:
${answer}

Task:
评估候选人的最新回答，输出结构化结果。

如果 Max rounds reached = no：
- feedbackText：一句自然反馈 + 一个可补充方向，不要包含问号。
- nextQuestion：一个明确问题。
- shouldEnd 必须是 false。

如果 Max rounds reached = yes：
- feedbackText：只给最后一轮简短反馈。
- nextQuestion 必须是空字符串。
- shouldEnd 必须是 true。

评分要求：
- score 使用 0-100 分制。
- 如果你习惯 1-10 分，请先换算成 0-100。
- coveredPoints / missingPoints / improvementTips 要结合候选人真实回答。
- scoringReason 用一句话说明得分依据。

Return JSON:
{
  "feedbackText": "中文反馈，不包含问题",
  "nextQuestion": "一个中文问题，若已达到最大轮次则为空字符串",
  "replyText": "可留空或由 feedbackText + nextQuestion 组成",
  "score": 78,
  "feedback": "兼容字段，可与 feedbackText 相同",
  "suggestion": "中文改进建议",
  "shouldEnd": ${maxRoundsReached ? "true" : "false"},
  "coveredPoints": ["已覆盖要点"],
  "missingPoints": ["缺失要点"],
  "improvementTips": ["改进建议"],
  "scoringReason": "得分依据"
}
`.trim();
}

export function buildReportPrompt(role: InterviewRole, history: Message[]): string {
  return `
${baseInterviewerInstruction}

Current phase: report/end
Role: ${roleLabels[role]}

Conversation history:
${formatHistory(history)}

Task:
根据对话生成中文最终面试报告。报告阶段可以收尾，但不要再提出新问题。

Return JSON:
{
  "overallScore": 78,
  "strengths": ["具体优势"],
  "weaknesses": ["具体不足"],
  "suggestions": ["具体改进建议"]
}
`.trim();
}

function formatQuestionContext(context?: LlmEvaluationContext): string {
  if (!context?.questionMeta) {
    return "";
  }

  return `
结构化题库上下文：
- 题目 ID: ${context.questionMeta.id}
- 知识点方向: ${context.questionMeta.topic}
- 难度: ${context.questionMeta.difficulty}
- 期望覆盖要点:
${context.questionMeta.expectedPoints.map((point) => `  - ${point}`).join("\n")}
- 建议追问:
${(context.questionMeta.followUps ?? []).map((point) => `  - ${point}`).join("\n")}

题库模式要求：
- expectedPoints 用于判断覆盖和缺失，不要机械复述。
- followUps 只能作为 nextQuestion 参考，不要和另一个问题同时出现。
- 未达到最大轮次时，不允许随意结束面试。
`.trim();
}

function formatHistory(history: Message[]): string {
  if (history.length === 0) {
    return "No prior messages.";
  }

  return history
    .map((message) => `${message.speaker}: ${message.text}`)
    .join("\n")
    .slice(-6000);
}
