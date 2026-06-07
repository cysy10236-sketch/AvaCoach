# Provider Architecture

## Why Provider-Based

AvaCoach 将 LLM、TTS、ASR 三层都设计为 provider-based 架构，使得每一层可以独立切换供应商而不影响其他层和前端 UI。

好处：
- 不同 Demo 场景可使用不同 API Key
- 成本、速度、质量可按需调整
- Provider 宕机不影响面试流程（自动 fallback）
- 同一业务逻辑适配多个供应商

## LLM Provider

```
LLM_PROVIDER=openai | deepseek | mock
```

每个 provider 实现相同接口：
- `generateOpeningAndFirstQuestion(role)` — 开场 + 第一题
- `generateFollowUp(role, answer, history, context?)` — 追问 + 评分
- `generateFinalReport(role, history)` — 最终报告

所有 provider 返回统一的 JSON 契约，前端不关心后端使用了哪个 LLM。

| Provider | 模型 | 说明 |
|----------|------|------|
| OpenAI | `gpt-4o-mini` | 通用高质量 |
| DeepSeek | `deepseek-v4-flash` / `deepseek-v4-pro` | 推荐，快速低成本 |
| Mock | N/A | 无外部依赖，始终可用 |

Mock fallback 在 LLM 调用失败时自动启用。

## TTS Provider

```
TTS_PROVIDER=openai | volcano | mock
```

| Provider | 输出格式 | 说明 |
|----------|---------|------|
| Volcano | `audio/pcm; rate=16000; channels=1` | V3 HTTP Chunked，直接驱动 AvatarKit 口型 |
| OpenAI | MP3 | 需前端解码 → resample → PCM16 |
| Mock | N/A | 强制 Browser Speech / Silent Text fallback |

**TTS → AvatarKit 链路**：
1. 后端 `/api/tts` 获取音频
2. Volcano 直接返回 16kHz mono PCM16 → 透传
3. 其他格式 → 前端 decodeAudioData → mix to mono → resample 16kHz → PCM16
4. `avatarView.controller.send(pcm, true)` → Spatius 生成口型动画

## ASR Provider

```
ASR_PROVIDER=volcano_stream | browser | mock
```

| Provider | 架构 | 说明 |
|----------|------|------|
| **Volcano Streaming** | WebSocket Binary Proxy | 浏览器 PCM16 → WS `/api/asr/stream` → 火山 bigmodel_async |
| Browser | `window.SpeechRecognition` | 纯前端，zh-CN |
| Mock | 后端 fallback | 无外部依赖 |

**Streaming ASR 链路**：
```
浏览器麦克风 (PCM16/16kHz/mono)
→ ScriptProcessorNode 采集
→ WebSocket (ArrayBuffer 二进制)
→ 后端 /api/asr/stream
→ 火山 bigmodel_async (自定义二进制协议 + gzip)
→ partial transcript (实时)
→ final transcript (停止后)
→ 前端回填 answer textarea
```

## 题库 Provider

AvaCoach 本地题库作为 demo seed data：
- 110 道中文 IT 面试题
- 覆盖 Frontend / Backend / AI / Behavioral
- 每题含 role、topic、difficulty、expectedPoints、followUps、tags

题库模式下：
1. 第一题来自题库
2. LLM 生成追问时接收 expectedPoints 做上下文
3. 后端做知识点覆盖检查（coveredPoints / missingPoints / improvementTips）

## Fallback 策略

```
LLM 失败       → mock provider (内置面试逻辑)
TTS 失败       → Browser SpeechSynthesis → Silent Text
ASR 失败       → Browser SpeechRecognition → Manual Input
题库 mismatch  → same-role / behavioral fallback
Token 失败     → placeholder avatar, interview still works
Avatar 失败    → placeholder, interview still works
```

每一层的 fallback 是独立、自动的，不影响其他层。

## Avatar Runtime 生命周期

AvatarKit 是状态ful 的。当前前端将 runtime 保存在 ref 中。Start Interview、Submit Answer、语音模式切换、speech interruption 都不会销毁 runtime。仅真正的组件卸载或显式 Reset/Destroy 才清理。

## 未来扩展

同一接口可支持：Claude、Gemini、Qwen、本地模型、企业私有模型端点。只需新增 provider adapter，保持 JSON 契约不变。
