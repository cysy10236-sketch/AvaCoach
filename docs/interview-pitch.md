# Interview Pitch

## One-liner

AvaCoach 是一个中文 IT 数字人模拟面试训练系统：候选人可以和真实数字人面试官进行语音问答，系统会实时识别回答、生成追问、按题库 expectedPoints 评分，并输出最终报告。

## Why It Is More Than a Chatbot

AvaCoach 不是一个“把聊天框套上头像”的产品。它覆盖了完整面试训练闭环：

- 数字人渲染和口型同步。
- 中文 TTS 到 AvatarKit PCM 播放链路。
- 实时 ASR 语音回答输入。
- LLM 面试官追问和反馈。
- 中文 IT 结构化题库。
- expectedPoints-based scoring。
- Server-side interview state machine。
- 最终报告。
- 多 provider fallback。

## Technical Highlights

### Spatius AvatarKit Direct Mode

- 后端签发短期 Session Token。
- 前端加载真实 Avatar。
- AvatarKit 接收 16kHz / mono / PCM16 音频。
- 数字人口型与 TTS 音频同步。

### Volcano TTS + Lip-sync

- 使用 Volcano TTS V3 HTTP Chunked。
- 成功路径输出 PCM16。
- 前端将 PCM 送入 AvatarKit `controller.send()`。
- 普通 browser speech 只作为 fallback，不假装驱动口型。

### Volcano Streaming ASR

- 浏览器麦克风采集 PCM16 / 16kHz / mono。
- 后端 WebSocket proxy 对接火山 Streaming ASR。
- partial / final transcript 实时回填回答框。
- 用户仍可编辑文本，Submit Answer 由用户确认触发。

### LLM + Question Bank

- 支持 DeepSeek / OpenAI / Mock provider。
- 题库约 110 道中文 IT 面试题。
- 每道题包含 role、difficulty、topic、expectedPoints、followUps。
- 题库模式结合 expectedPoints 覆盖率评分。

### Server-side Interview State Machine

最新修复后，后端 session 是面试流程的权威状态：

- `/api/interview/start` 创建或刷新 session。
- `/api/interview/next` 根据后端 session 派生 status / nextAllowed / reportReady / shouldEnd。
- `/api/interview/report` 将 session 标记为 ended。
- ended 后再次提交不会继续生成追问。
- 三轮后引导 End Interview 和 Final Report。

这解决了“模型提示面试结束，但系统又继续问下一题”的逻辑冲突。

## Product Value

- 对候选人：用更接近真实面试的方式练习表达、技术解释和复盘能力。
- 对面试官：可快速看到候选人知识覆盖情况和表达弱点。
- 对工程展示：完整体现数字人 SDK、语音链路、LLM provider、题库评分和状态机设计。

## Demo Boundary

当前是 demo/prototype：

- 没有生产级账号系统。
- 没有持久化面试历史。
- 没有真实 PDF 导出。
- 没有生产部署和完整运维监控。

但它已经具备完整可演示闭环和清晰工程扩展点。

## Best Talking Points

- “Spatius 负责 avatar rendering 和 lip-sync；LLM/TTS/ASR 是独立 provider。”
- “所有 API Key 只在后端，前端不暴露密钥。”
- “题库评分不是纯主观打分，而是 expectedPoints 覆盖率 + LLM 反馈的组合。”
- “后端状态机保证 ended 后不再追问。”
- “Fallback 是 demo 稳定性的设计，不是功能残缺。”
