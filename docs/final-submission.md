# AvaCoach Final Submission

## 1. Product Concept

AvaCoach 是一个 AI 数字人模拟面试训练系统。它通过 Spatius AvatarKit 数字人扮演面试官，结合 LLM 追问、实时语音识别、语音合成驱动口型同步、结构化题库和反馈评分，为用户提供接近真实面试的训练体验。

与普通文本 chatbot 不同，AvaCoach 强调"被面试"的临场感：用户可以看到数字人面试官说话并对口型、用语音回答问题、获得结构化评分反馈和最终报告。

## 2. Why This Product

面试练习特别适合数字人场景，因为面试不只是回答内容对不对，还涉及：

- **临场感** — 面对数字人面试官比看文本框更有真实压力
- **口头表达** — 练习 STAR 结构、语音回答、节奏控制
- **追问应对** — 训练被追问时的思维组织能力
- **结构化反馈** — 覆盖知识点、缺失要点、改进建议

AvaCoach 将数字人渲染、LLM 智能、语音交互、题库评分整合为一个完整 Demo，真实展示了 Spatius AvatarKit 在业务场景中的应用价值。

## 3. What I Built

### 数字人渲染与驱动
- Spatius AvatarKit Direct Mode 接入，真实 Avatar 渲染
- Spatius Session Token 后端安全获取
- Volcano TTS V3 HTTP Chunked 接入，输出 16kHz mono PCM16
- TTS 音频送入 AvatarKit `controller.send()` 驱动口型同步

### 语音识别
- Volcano Streaming ASR WebSocket proxy（bigmodel_async 二进制协议）
- 浏览器麦克风实时采集 PCM16 / 16kHz / mono
- WebSocket 代理转发音频 chunk，接收 partial / final transcript
- ASR result 实时填入回答框

### LLM 面试逻辑
- Provider-based LLM 架构：DeepSeek / OpenAI / Mock 三选一
- 开场 + 第一题、追问 + 评分、最终报告三个阶段
- 中文 prompt 工程，面试官人设稳定
- 熔断机制：薪资/换题/不会时自然引导，不结束面试

### 结构化题库
- 110 道中文 IT 面试题，覆盖 Frontend / Backend / AI / Behavioral
- 每题含 role、topic、difficulty、expectedPoints、followUps、tags
- 知识点评分：coveredPoints / missingPoints / improvementTips
- 题库与 LLM 结合：expectedPoints 传给 LLM 做上下文对齐

### 工程完整性
- React + Express monorepo
- 三栏 SaaS 工作台 UI（配置 + 面试区 + 反馈）
- 面试流程状态保护（start → next → report → ended，3 轮引导结束）
- Fallback 全覆盖（Avatar / TTS / ASR / LLM 四层独立降级）
- 安全日志（不输出 API Key / 完整音频 / token）
- Dev-only 音频诊断工具（`downloadLastAsrPcm()`）

## 4. Technical Architecture

```
Frontend React
→ Express Backend
→ LLM Provider (DeepSeek / OpenAI / Mock)
→ Volcano TTS V3 (HTTP Chunked, 16kHz PCM16)
→ Volcano Streaming ASR (WebSocket Binary, bigmodel_async)
→ Spatius AvatarKit (Direct Mode, PCM16 lip-sync)
→ Structured IT Question Bank (110 questions)
```

**Repository:**
- `client/`: React + Vite + TypeScript
- `server/`: Node.js + Express + TypeScript
- `docs/`: 交付文档、集成笔记、演示脚本
- `scripts/`: ASR stream 测试脚本

**Security boundary:**
- API Key 仅存放于 `server/.env`
- 前端永不接触 API Key
- `.env` 被 `.gitignore` 排除

## 5. Spatius Integration Status

### ✅ 已完成
- `GET /api/spatius/session-token` — Direct Mode Token 后端安全获取
- `@spatius/avatarkit` SDK 安装并初始化
- `AvatarStage` 组件 — Connect Avatar → SDK Init → Avatar Load → Render
- 官方 sample PCM 验证路径
- Volcano TTS 16kHz PCM16 直接驱动 AvatarKit 口型同步
- AvatarKit runtime 生命周期管理（不会因普通状态更新被销毁）
- Fallback placeholder

### 🔮 后续
- Token 过期前自动刷新
- Production-grade SDK 错误处理
- 多 Avatar 选择

## 6. Demo Stability Strategy

```text
AvatarKit 失败     → placeholder + text mode
TTS 失败           → browser SpeechSynthesis → silent text
ASR 失败           → browser SpeechRecognition → manual input
LLM 失败           → mock provider
Token 失败         → token fallback, placeholder active
题库 mismatch      → same-role / behavioral fallback
```

每一层降级都保证面试流程**完整可用**。前端不关心具体使用了哪个 provider，只接收统一的 JSON 契约。

## 7. Product Suggestions

基于 Spatius SDK 集成体验的建议：
- 提供端到端业务模板（AI 面试官、AI 老师、客服数字人）
- 改进音频格式文档（SDK 支持的格式、采样率、流式传输）
- 改善 Session Token 调试体验
- 提供 SDK 状态机到 UI 状态的映射示例
- 明确 Direct Mode quickstart 和错误排查指南

## 8. Future Work

- Production deployment
- 报告导出真实 PDF
- 题库扩充（企业/JD 定向）
- 用户账号和历史记录
- TTS 音频流式传输
- 更多 LLM provider（Claude, Gemini, Qwen）
