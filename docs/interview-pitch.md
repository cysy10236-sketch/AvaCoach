# 3-Minute Interview Pitch

## 1. 产品介绍

AvaCoach 是一个 AI 数字人模拟面试训练系统。用户选择目标岗位后，数字人面试官会提出专业问题，用户可以通过语音或文字回答，系统会进行追问、评分，最后生成面试报告。

我做这个项目时，重点不是做一个普通 chatbot，而是做一个接近真实面试场景的练习产品。所以它集成了数字人渲染、口型同步、实时语音识别、LLM 追问和结构化题库评分。

## 2. 为什么选择这个场景

面试练习特别适合数字人，因为面试不只看回答内容对不对，还涉及表达、节奏、压力感和临场感。

纯文本 chatbot 更像在写答案。而数字人面试官让用户产生"被面试"的感觉，更适合练习自我介绍、项目表达、STAR 结构和追问应对。

AvaCoach 的核心价值：**让用户在一个更接近真实面试的环境里反复练习，并且得到结构化反馈。**

## 3. 技术架构

```text
用户回答 → Interview API → LLM（DeepSeek/OpenAI/Mock）
     ↑                              ↓
火山流式 ASR ← 浏览器麦克风      TTS（Volcano/OpenAI/Mock）
     ↑                              ↓
实时 transcript 填入回答框     Spatius AvatarKit 口型同步
                                     ↓
                              数字人面试官 UI
```

- **前端**: React + Vite + TypeScript + Spatius AvatarKit Web SDK
- **后端**: Node.js + Express + TypeScript
- **LLM**: DeepSeek / OpenAI / Mock（provider-based，可切换）
- **TTS**: 火山引擎 V3 HTTP Chunked → 16kHz PCM16 → AvatarKit 口型驱动
- **ASR**: 火山引擎 Streaming WebSocket（bigmodel_async）→ partial/final transcript
- **题库**: 110 道中文 IT 面试题，expectedPoints 评分体系

## 4. 已实现的核心能力

- **数字人渲染与口型同步** — Spatius AvatarKit Direct Mode，TTS PCM16 驱动唇形
- **实时语音识别** — 浏览器麦克风 → WebSocket → 火山流式 ASR → 实时回填
- **LLM 追问与评分** — 每轮生成追问 + 分数 + 反馈 + 改进建议
- **结构化题库** — Frontend / Backend / AI / Behavioral，知识点覆盖追踪
- **最终报告** — 综合评分 + 强弱项 + 知识点分析 + 推荐练习方向
- **Fallback 全覆盖** — Avatar / TTS / ASR / LLM 四层独立降级，Demo 永不崩溃

## 5. Spatius 接入理解

Spatius 在 AvaCoach 中的定位是**数字人渲染和驱动层**，不负责 LLM 或 TTS。

后端通过 `SPATIUS_API_KEY` 获取短期 Session Token，前端用 Token 初始化 AvatarKit、加载 Avatar、连接 Motion Server。TTS 输出的 PCM16 音频送入 `controller.send()` 驱动口型同步。

API Key 严格限制在 `server/.env`，前端永不接触。

## 6. 工程亮点

- **Provider 架构** — LLM/TTS/ASR 三层均可通过环境变量切换 provider
- **Fallback 设计** — 每一层外部依赖都有降级路径，不是容错逻辑，是 Demo 稳定性设计
- **安全边界** — 前端不接触任何 API Key，debug 日志不输出密钥/完整音频/token
- **状态保护** — 面试流程严格区分 start/next/report/ended，防止并发和重复提交

## 7. 后续规划

- Production 部署
- 报告导出真实 PDF
- 题库扩充（企业/JD 定向）
- 用户账号 / 历史记录
- 多 Avatar 选择
