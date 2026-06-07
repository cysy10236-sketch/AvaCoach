# AvaCoach

AI 数字人模拟面试训练系统

## 1. Project Overview

AvaCoach 是一个中文 IT 数字人模拟面试训练系统。它通过 AI 数字人扮演面试官，结合 LLM 追问、实时语音识别、语音合成驱动数字人口型同步、结构化 IT 题库，为用户提供接近真实面试的训练体验。

与普通文本 chatbot 不同，AvaCoach 强调"被面试"的临场感：用户可以看到数字人面试官说话并对口型、用语音回答问题、获得结构化反馈和最终报告。

当前 Demo 是一个完整可运行的原型，所有外部依赖（Avatar、TTS、ASR、LLM）均有 fallback 降级路径，确保在任何配置下都能完整演示面试流程。

## 2. Demo Highlights

- **AI Digital Human Interviewer** — 真实 Spatius AvatarKit 数字人渲染，支持 Direct Mode 连接
- **Avatar Lip-sync** — Volcano TTS 输出 16kHz mono PCM16，通过 AvatarKit `controller.send()` 驱动口型同步
- **Real-time Voice Answer** — 浏览器麦克风采集 PCM16 / 16kHz / mono，经 WebSocket 代理到火山引擎流式 ASR，实时返回 partial / final transcript
- **Chinese Structured IT Question Bank** — 110 道中文面试题，覆盖 Frontend / Backend / AI / Behavioral，含 expectedPoints 评分体系
- **LLM Follow-up & Feedback** — DeepSeek / OpenAI / Mock 三选一，每轮生成追问 + 评分 + 改进建议
- **Final Interview Report** — 综合评分 + 强项/薄弱项 + 知识点分析 + 推荐练习方向
- **Robust Fallback Strategy** — Avatar / TTS / ASR / LLM 四层独立降级，任何一层失败不影响面试流程

## 3. Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │AvatarPanel│ │Interview │ │Feedback  │ │ControlPanel│  │
│  │ AvatarKit │ │  Panel   │ │  Panel   │ │ Voice/Text │  │
│  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│        │            │            │              │         │
│  ┌─────┴────────────┴────────────┴──────────────┴──────┐  │
│  │              Service Layer (client/src/services/)    │  │
│  │  avatarKitClient  │  streamingAsrClient  │  ttsApi   │  │
│  │  audioRecorder    │  speechPlayer        │  interviewApi │
│  └───────────────────┴──────────────────────┴───────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP + WebSocket
┌──────────────────────────┴──────────────────────────────┐
│                 Backend (Express + TypeScript)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ /interview│ │  /api/tts │ │ /api/asr │ │/api/spatius│  │
│  │   LLM    │ │  Volcano │ │  Volcano │ │  Session   │  │
│  │ Provider │ │   TTS    │ │Stream ASR│ │   Token    │  │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│        │           │            │              │         │
│  ┌─────┴───────────┴────────────┴──────────────┴──────┐  │
│  │  Provider Architecture (env-switchable)             │  │
│  │  LLM: DeepSeek / OpenAI / Mock                      │  │
│  │  TTS: Volcano V3 / OpenAI / Mock                    │  │
│  │  ASR: Volcano Streaming / Browser / Mock             │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                  External Services                        │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ DeepSeek │ │Volcano TTS V3│ │Volcano Streaming ASR │  │
│  │ / OpenAI │ │  (HTTP Chunk)│ │  (WebSocket Binary)  │  │
│  └──────────┘ └──────────────┘ └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         Spatius AvatarKit (Direct Mode)              │ │
│  │  Session Token → SDK Init → Avatar Load → Render    │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

```text
Repository:
  client/   React + Vite + TypeScript 前端
  server/   Node.js + Express + TypeScript 后端
  docs/     交付文档、集成笔记、演示脚本
  scripts/  测试脚本（ASR stream 验证等）
```

**安全边界**：
- API Key 仅存放于 `server/.env`，前端不可访问
- 前端仅接收短期 Session Token 和公开 ID
- `.env` 文件被 `.gitignore` 排除

## 4. Core User Flow

1. **Connect Avatar** — 点击后后端获取短期 Session Token，AvatarKit 初始化、加载 Avatar、连接 Motion Server
2. **Choose Role / Question Source / Difficulty / Topic** — 选择目标岗位、题目来源（AI 生成 或 IT 题库）、难度、知识点
3. **Start Interview** — 数字人面试官用 TTS + 口型同步提出第一个问题
4. **Answer by Voice or Text** — 点击"开始语音回答"使用麦克风输入，或直接打字
5. **ASR Transcript** — 实时 partial/final transcript 填入回答框
6. **Submit Answer** — LLM 生成反馈、评分、追问（题库模式下结合 expectedPoints）
7. **Repeat** — 最多 3 轮面试，每轮后展示 coveredPoints / missingPoints / improvementTips
8. **End Interview** — 生成最终报告（综合评分 + 强项 + 薄弱项 + 知识点分析）
9. **Reset Demo** — 一键清空所有状态，重新开始

## 5. Tech Stack

**Frontend:**
- React + TypeScript + Vite
- Spatius AvatarKit Web SDK (Direct Mode)
- Web Audio API (AudioContext, ScriptProcessor, OfflineAudioContext)
- WebSocket (流式 ASR)

**Backend:**
- Node.js + Express + TypeScript
- ws (WebSocket Server)
- Provider-based 架构

**AI / Voice / Avatar:**
- LLM: DeepSeek / OpenAI / Mock
- TTS: Volcano V3 HTTP Chunked / OpenAI / Mock
- ASR: Volcano Streaming WebSocket (bigmodel_async) / Browser SpeechRecognition / Mock
- Avatar: Spatius AvatarKit (Direct Mode, PCM16 16kHz mono lip-sync)

## 6. Environment Variables

### server/.env

```bash
PORT=3001
CLIENT_ORIGIN=http://localhost:5173

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash

# TTS
TTS_PROVIDER=openai
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=alloy

# Volcano TTS (16kHz mono PCM16 → AvatarKit lip-sync)
VOLCANO_TTS_ENABLED=false
VOLCANO_TTS_PROVIDER=volcano_bidirection
VOLCANO_TTS_API_KEY=
VOLCANO_TTS_RESOURCE_ID=seed-tts-2.0
VOLCANO_TTS_VOICE_TYPE=zh_female_vv_uranus_bigtts
VOLCANO_TTS_ENDPOINT=https://openspeech.bytedance.com/api/v3/tts/unidirectional
VOLCANO_TTS_FORMAT=pcm
VOLCANO_TTS_SAMPLE_RATE=16000
VOLCANO_ACCESS_KEY_ID=
VOLCANO_SECRET_ACCESS_KEY=
VOLCANO_APP_ID=

# ASR
ASR_PROVIDER=volcano_stream
VOLCANO_ASR_ENABLED=false
VOLCANO_ASR_API_KEY=
VOLCANO_ASR_RESOURCE_ID=volc.seedasr.sauc.duration
VOLCANO_ASR_ENDPOINT=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async
VOLCANO_ASR_LANGUAGE=zh-CN
VOLCANO_ASR_AUDIO_FORMAT=pcm
VOLCANO_ASR_SAMPLE_RATE=16000
VOLCANO_ASR_BITS=16
VOLCANO_ASR_CHANNEL=1
ASR_STREAM_DEBUG=false

# Spatius AvatarKit
SPATIUS_API_KEY=
SPATIUS_APP_ID=
SPATIUS_REGION=us-west
SPATIUS_TOKEN_EXPIRE_MINUTES=30
SPATIUS_INCLUDE_APP_ID_IN_TOKEN_REQUEST=false
```

### client/.env

```bash
VITE_SPATIUS_APP_ID=
VITE_SPATIUS_AVATAR_ID=
```

**安全规则**：
- API Key **只放** `server/.env`，绝对不要放到 `client/.env`
- 不要把真实 key 写入文档或提交到 git
- `.env` 文件已在 `.gitignore` 中排除
- 缺少 Key 不会导致崩溃，系统自动 fallback

## 7. Local Setup

```bash
# 安装依赖
npm install

# 启动开发环境（前端 5173 + 后端 3001）
npm run dev

# 生产构建
npm run build
```

- 前端: `http://localhost:5173`
- 后端: `http://localhost:3001`
- 健康检查: `http://localhost:3001/health`

## 8. Demo Script (2–3 分钟)

1. 展示三栏 SaaS 工作台 UI 布局
2. **Connect Avatar** → 等待状态变为 "Avatar 已连接"
3. 选择岗位（如 Frontend Engineer）+ 题目来源（IT Question Bank）+ 难度 + Topic
4. **Start Interview** → 数字人用中文提问，观察口型同步
5. 等数字人说完 → 点击**开始语音回答**，说 5 秒中文回答
6. **停止录音** → 观察实时 partial transcript 显示，最终填入回答框
7. **Submit Answer** → 右侧展示评分、反馈、coveredPoints / missingPoints
8. 重复 1–2 轮问答，观察 LLM 追问和知识点覆盖
9. **End Interview** → 展示最终报告（综合评分 + 强弱项 + 知识点分析）
10. **Reset Demo** → 验证状态完全清空，可重新开始

## 9. Fallback Strategy

Fallback 是 Demo 稳定性的设计一部分，不是异常状态。

| 层级 | 降级路径 |
|------|---------|
| **AvatarKit** 失败 | → placeholder 占位符 + 文本面试模式 |
| **TTS** 失败 | → Browser SpeechSynthesis → Silent Text Mode |
| **ASR** 失败 | → Browser SpeechRecognition → 手动文字输入 |
| **LLM** 失败 | → Mock Provider（内置 mock 逻辑） |
| **Spatius Token** 失败 | → Token Fallback，Avatar placeholder 保持可用 |
| **题库 Topic** 不匹配 | → 同 role fallback 题目 |
| **题库 Role** 不匹配 | → behavioral fallback 题目 |

核心面试流程**不依赖**任何单一外部 provider，确保在任何配置下 Demo 完整可用。

## 10. Current Status

### ✅ 已完成

- React + Express monorepo
- Spatius AvatarKit Direct Mode 接入，真实 Avatar 渲染
- Spatius Session Token 后端安全获取
- Volcano TTS V3 HTTP Chunked 接入，输出 16kHz mono PCM16
- TTS PCM16 驱动 AvatarKit 口型同步
- Volcano Streaming ASR WebSocket proxy（bigmodel_async）
- 浏览器麦克风实时采集 PCM16 / 16kHz / mono
- ASR partial / final transcript 实时回填回答框
- DeepSeek / OpenAI / Mock LLM provider 架构
- 110 道中文 IT 面试题库（Frontend / Backend / AI / Behavioral）
- expectedPoints / coveredPoints / missingPoints / improvementTips 评分体系
- 中文反馈和最终报告
- 面试流程状态保护（start → next → report → ended）
- 3 轮面试引导结束
- 三栏 SaaS 工作台 UI
- 语音回答 + 文本回答双输入
- Fallback 全覆盖
- 安全日志（不输出 API Key / 完整音频 / token）

### 🔮 后续可优化

- Production 部署
- 报告导出真实 PDF
- 题库扩充（企业/JD 定向）
- 用户账号 / 历史记录
- 使用分析
- 多 Avatar 选择
- TTS 音频流式传输

## 11. Security Notes

- `.env` / `*.env` 被 `.gitignore` 排除，永不上传
- API Key 仅在 `server/.env`，前端永不接触
- 前端仅接收短期 Session Token 和公开 ID
- Debug 日志绝不输出 API Key / 完整音频 / 完整 token / raw hex
- `X-Api-Key` 仅在 backend 使用 `env` 读取，代码中无硬编码

## 12. Known Warnings

- **AvatarKit WASM file not found**: `@spatius/avatarkit` Vite 插件在 build 时报告此 warning，但最终输出仍包含 WASM 相关 chunk，不影响功能。属于 packaging/path 层面的既有提示
- **Chunk size > 500kB**: AvatarKit WASM (~1.3MB) 导致的既有 warning，不影响功能
- `npm run build` 通过，以上 warning 均为非阻塞

## 参考文档

- [Final Submission](docs/final-submission.md)
- [Demo Script](docs/demo-script.md)
- [Interview Pitch](docs/interview-pitch.md)
- [Spatius Integration](docs/spatius-integration.md)
- [Provider Architecture](docs/provider-architecture.md)
- [TTS Integration](docs/tts-integration.md)
- [ASR Plan](docs/asr-plan.md)
