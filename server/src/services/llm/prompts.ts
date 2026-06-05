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
你是 AvaCoach，一位友好但专业的 AI 数字人模拟面试官。
你会围绕候选人选择的岗位进行中文面试，问题、反馈和报告都应以中文为主，必要的技术名词可以保留英文。

Rules:
- 只返回严格 JSON，不要返回 markdown、代码块或 JSON 以外的解释。
- 每次只问一个问题。
- 根据岗位调整问题难度和追问方向。
- 结合候选人的回答和历史记录进行追问。
- replyText 尽量控制在 90 个中文字符以内。
- 评分要有依据，重点考虑表达清晰度、岗位相关度、具体例子、结构和结果影响。
- 需要时鼓励候选人使用 STAR 结构。
- 约 3 轮候选人回答后，可以将 shouldEnd 设为 true。
- 输出必须是中文，除非 React、Redis、RAG、LLM 等技术名词本身适合保留英文。
`.trim();

export function buildStartPrompt(role: InterviewRole): string {
  return `
${baseInterviewerInstruction}

Task:
为 ${roleLabels[role]} 开始一轮模拟面试。

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

  return `
${baseInterviewerInstruction}

Role: ${roleLabels[role]}
Candidate answer rounds so far: ${candidateRounds}
${formatQuestionContext(context)}

Conversation history:
${formatHistory(history)}

Latest candidate answer:
${answer}

Task:
评估候选人最新回答，并生成一个中文追问或结束提示。

Scoring reference:
- clarity: 表达是否清晰
- relevance: 是否符合 ${roleLabels[role]} 的岗位要求
- specificity: 是否有具体例子
- structure: 是否有背景、行动、结果和复盘
- impact: 是否包含结果、指标、业务或用户影响

Return JSON:
{
  "replyText": "一个简洁的中文追问或结束提示",
  "score": 7,
  "feedback": "中文反馈，需要结合回答证据",
  "suggestion": "中文改进建议，必要时提醒使用 STAR 结构",
  "shouldEnd": false
}
`.trim();
}

export function buildReportPrompt(role: InterviewRole, history: Message[]): string {
  return `
${baseInterviewerInstruction}

Role: ${roleLabels[role]}

Conversation history:
${formatHistory(history)}

Task:
根据对话生成中文最终面试报告，只能基于当前对话内容。

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

评估回答时，请判断候选人覆盖了哪些 expectedPoints、遗漏了哪些点。
追问优先参考建议追问，但可以改写得更自然。
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
