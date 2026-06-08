# Product

## Name

AvaCoach - 中文 IT 数字人模拟面试训练系统

## Product Purpose

AvaCoach 是一个面向面试训练场景的数字人 demo/prototype。它不是普通聊天机器人，而是一个完整的模拟面试闭环：数字人面试官提问、候选人语音或文字回答、ASR 回填、LLM 追问与反馈、题库 expectedPoints 评分、TTS 驱动数字人口型同步、最终生成结构化报告。

## Target Users

- 准备中文 IT 技术面试的候选人。
- 需要展示 AI Digital Human 产品能力的面试或路演场景。
- 想验证 Avatar / TTS / ASR / LLM / 题库评分链路的工程团队。

## Core Experience

1. 用户选择岗位、题库来源、难度和知识点。
2. 用户连接真实数字人 Avatar。
3. Ava 以中文提出面试问题并口型同步。
4. 用户用语音或文字回答。
5. ASR transcript 回填到回答框，用户可编辑。
6. Submit Answer 后，系统给出评分、覆盖要点、缺失要点、改进建议和自然追问。
7. 三轮后进入 ended 状态，用户生成最终报告。

## Current Capabilities

- Spatius AvatarKit Direct Mode。
- 后端安全签发 Session Token。
- Volcano TTS V3 HTTP Chunked，输出 16kHz / mono / PCM16。
- TTS PCM 驱动 AvatarKit lip-sync。
- Volcano Streaming ASR，支持 partial / final transcript。
- DeepSeek / OpenAI / Mock LLM providers。
- 约 110 道中文 IT 结构化题库。
- expectedPoints-based scoring。
- Server-side interview state machine。
- 最终报告。
- Avatar / TTS / ASR / LLM fallback。

## Latest Flow Fixes

- 服务端 session status 是权威状态。
- `/api/interview/next` 不再只相信前端 status。
- ended 后再次提交不会生成新追问。
- 题库模式不再机械拼接 LLM 回复和 bank followUp。
- 每轮最多一个主问题。
- 评分统一为 0-100。
- 题库评分结合 expectedPoints 覆盖率和 scoringReason。

## Design Principles

- 面试流程清晰可见。
- Start / Submit / End / Reset 行为一致。
- Fallback 是稳定演示模式，不制造错误感。
- 内容在面板内滚动，避免页面跳动。
- 中文为主，必要技术术语保留英文。
- 明确 demo/prototype 边界，不夸大为生产系统。

## Non-goals

- 不做生产级用户系统。
- 不保存真实候选人录音或敏感信息。
- 不在前端暴露 API Key。
- 不把 fallback 描述为失败，而是演示稳定性的保护层。
