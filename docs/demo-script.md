# AvaCoach Demo Script (2–3 分钟)

## Demo Order

1. **开场** — 介绍 AvaCoach 是一个 AI 数字人模拟面试训练系统，不是普通 chatbot
2. **展示 UI 布局** — 三栏 SaaS 工作台：左侧配置，中间数字人 + 对话，右侧反馈
3. **Connect Avatar** — 点击后等待状态变为 "Avatar 已连接"
4. **选择配置** — 岗位（如 Frontend Engineer）、题目来源（IT Question Bank）、难度（Medium）、Topic（如 React）
5. **Start Interview** — 数字人面试官用 TTS + 口型同步提问第一题
6. **语音回答** — 等数字人说完后，点击"开始语音回答"，说 5 秒中文
7. **ASR 识别** — 停止录音后，观察 transcript 实时显示在回答框中
8. **Submit Answer** — 右侧展示本轮评分、反馈、coveredPoints / missingPoints / improvementTips
9. **重复 1–2 轮** — 观察 LLM 追问和知识点覆盖追踪
10. **End Interview** — 展示最终报告：综合评分、强项、薄弱项、知识点分析
11. **Reset Demo** — 验证一键重置，状态完全清空

## Live Startup

```bash
npm run dev
```

- 前端: `http://localhost:5173`
- 后端: `http://localhost:3001`

## 关键讲解话术

### 讲解 Spatius AvatarKit

> Spatius 是数字人渲染和驱动层。Connect Avatar 时会从后端获取短期 Session Token，初始化 AvatarKit，加载 Avatar，连接 Motion Server。如果任何步骤失败，placeholder 保持活跃，面试流程仍完全可用。

### 讲解 Volcano TTS

> TTS 层是 provider-based 架构。当前使用火山引擎 V3 HTTP Chunked TTS，输出 16kHz mono PCM16 音频。这个音频会直接送入 AvatarKit `controller.send()` 驱动数字人口型同步。如果 TTS 不可用，自动降级到浏览器语音或静音文本模式。

### 讲解 Volcano Streaming ASR

> 语音识别使用火山引擎流式 ASR。浏览器麦克风采集 PCM16 / 16kHz / mono 音频，通过 WebSocket 代理实时发送到火山 bigmodel_async 服务。partial transcript 会实时显示在回答框，停止录音后收到 final result。如果 ASR 不可用，降级到浏览器 SpeechRecognition 或手动输入。

### 讲解 LLM Provider

> 面试逻辑使用 provider-based LLM 架构，支持 DeepSeek、OpenAI 和 Mock。每轮回答后生成追问、评分和建议。题库模式下还会把 expectedPoints 传给 LLM 做上下文对齐。LLM 失败时自动降级到 Mock。

### 讲解 IT Question Bank

> 题库包含 110 道中文 IT 面试题，每道题有 role、topic、difficulty、expectedPoints、followUps 和 tags。每轮回答后会对比期望要点，展示已覆盖和遗漏的知识点。题库是 demo seed data，后续可替换为企业题库或 JD 生成题目。

### 讲解 Fallback 设计

> 每一层外部依赖都有独立的降级路径。不是容错逻辑，而是 Demo 稳定性设计。确保在任何配置下都能完整演示面试流程。

## Likely Interviewer Questions

**Q: 为什么 API Key 不放前端？**

A: 前端环境变量会打包进浏览器。AvaCoach 把所有 API Key 放在 Express 后端，前端只接收短期 Session Token 和公开 ID。

**Q: 为什么花精力做 fallback？**

A: Fallback 保护 Demo 不受 provider 配置、网络、配额、SDK 初始化等问题影响。同时证明产品架构是松耦合的，每一层都可以独立替换。

**Q: Spatius 在这个系统里负责什么？**

A: Spatius 负责数字人渲染和口型同步驱动。它不生成问题、不合成为语音、不做面试逻辑。LLM + TTS + ASR + 题库都在 AvaCoach 后端。

**Q: 火山 TTS 音频怎么驱动口型的？**

A: 后端调用火山 TTS 获取 16kHz mono PCM16 音频，前端拿到后通过 AvatarKit `controller.send(pcm, true)` 发送。Spatius AvatarKit 从 PCM 音频生成口型动画。

**Q: 流式 ASR 是怎么工作的？**

A: 浏览器麦克风采集 PCM16 / 16kHz / mono → WebSocket 发送到后端 `/api/asr/stream` → 后端通过火山二进制协议转发到 bigmodel_async → 接收 partial/final transcript 返回前端 → 填入回答框。用户仍可编辑后再提交。
