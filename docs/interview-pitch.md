# Interview Pitch

## One-liner

AvaCoach 是一个中文 AI 数字人模拟面试训练系统：候选人可以和真实数字人面试官进行语音问答，系统会实时转写回答、动态追问、给出自然反馈和评分依据，并生成最终报告。

## Why It Is More Than a Chatbot

AvaCoach 覆盖完整面试训练闭环：

- Spatius AvatarKit 数字人渲染和口型同步。
- Volcano TTS 中文语音合成。
- Volcano Streaming ASR 实时语音识别。
- DeepSeek / OpenAI / Mock LLM provider。
- Topic-guided dynamic interview。
- 中文 IT 题库资产。
- Server-side interview state machine。
- Final report。
- Provider fallback。

## Current Interview Strategy

主流程采用 AI 动态面试。用户选择岗位和 Topic，LLM 生成第一题，并根据候选人回答决定下一步：深入追问、换角度、降低难度或结束。

题库没有下线为废弃功能，而是保留为结构化知识资产。它包含约 110 道中文 IT 题和 expectedPoints，可以支撑后续 evaluator、企业题库、离线测试和训练计划。当前 demo 不直接展示 covered/missing 点，是为了让面试体验更自然、更像真人面试官。

## Technical Highlights

### Spatius AvatarKit Direct Mode

- Backend mints short-lived Session Token.
- Frontend initializes AvatarKit with public app/avatar IDs.
- AvatarKit receives PCM16 audio and drives lip-sync.

### Volcano TTS + Lip-sync

- Volcano TTS V3 HTTP Chunked returns PCM16.
- Frontend sends PCM to AvatarKit `controller.send()`.
- Browser speech is fallback only and does not pretend to drive lip-sync.

### Volcano Streaming ASR

- Browser microphone captures PCM16 / 16kHz / mono.
- Backend WebSocket proxy connects to Volcano Streaming ASR.
- Partial and final transcript refill the answer box.
- User can edit before Submit Answer.

### LLM Dynamic Interviewer

- LLM generates Topic-guided first questions.
- LLM produces natural follow-ups from the real answer.
- Feedback avoids exposing internal scoring mechanics.
- Final report summarizes strengths, weaknesses, and suggestions.

## Product Value

- For candidates: practice technical explanation, project review, and interview rhythm.
- For demo reviewers: see a complete digital human AI workflow, not just a chat UI.
- For engineering evaluation: see provider boundaries, backend key isolation, fallback design, and state control.

## Best Talking Points

- “Spatius 负责 Avatar rendering 和 lip-sync；LLM/TTS/ASR 是独立 provider。”
- “所有 API Key 只在后端，前端不暴露密钥。”
- “题库被保留为结构化知识资产，但主演示路径改为 LLM 动态面试。”
- “Fallback 是稳定演示设计，不是功能缺失。”
- “当前 demo 已经跑通问题生成、TTS、Avatar 播放、ASR、LLM 评估和报告。”
