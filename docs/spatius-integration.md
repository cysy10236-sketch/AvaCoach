# Spatius SDK Integration Notes

## 1. Integration Goal

Spatius 在 AvaCoach 中是**数字人渲染和驱动层**。它不负责面试逻辑、LLM 或 TTS 生成。它负责将数字人面试官渲染到浏览器，并用 TTS 音频驱动口型同步。

## 2. Current Integration Status — ✅ 已接入

### ✅ 已完成
- **Backend Session Token**: `GET /api/spatius/session-token` — Direct Mode Token 安全获取
- **AvatarKit SDK**: `@spatius/avatarkit` 安装、初始化、Avatar 加载、AvatarView 渲染
- **Direct Mode 连接**: SDK Init → Session Token → Load Avatar → Controller Start → Motion Server Connect
- **Sample PCM 验证**: 官方 quickstart_voice.pcm 验证 AvatarKit 渲染和口型
- **TTS Lip-sync**: Volcano TTS 16kHz PCM16 → `controller.send(pcm, true)` → 口型驱动
- **Runtime 生命周期**: Start Interview / Submit Answer 不会销毁 AvatarKit runtime
- **Fallback**: placeholder 在所有失败路径中保持可用
- **安全**: API Key 仅 backend，前端只收短期 Token + 公开 ID

### 🔮 后续
- Token 过期前自动刷新
- Production-grade 错误处理和遥测
- 多 Avatar 选择

## 3. Session Token Flow

```
1. 用户点击 Connect Avatar
2. 前端 → GET /api/spatius/session-token
3. 后端 → POST Spatius Console API (X-Api-Key header)
4. 后端 → 返回短期 Session Token
5. 前端 → AvatarSDK.setSessionToken(...)
6. AvatarKit → 使用 Token 连接 Motion Server
```

## 4. Architecture Integration

```
interviewer replyText → /api/tts (Volcano) → PCM16 16kHz mono
                                              ↓
                              controller.send(pcm, true)
                                              ↓
                              Spatius AvatarKit 口型同步
```

Spatius 仅消费最终语音层，不介入面试逻辑。

## 5. Credential Security

- `SPATIUS_API_KEY` → `server/.env` only
- `VITE_SPATIUS_APP_ID` / `VITE_SPATIUS_AVATAR_ID` → `client/.env`
- Session Token → 后端动态生成，短期有效
- `.env` → `.gitignore` 排除

## 6. State Mapping

```
token_loading        → 请求 Session Token
sdk_loading          → 初始化 AvatarKit
avatar_loading       → 加载 Avatar 资源
render_ready         → onFirstRendering 触发
avatar_connected     → Motion Server 已连接
avatar_speech_sending → TTS PCM 正在发送
avatar_speaking      → 口型同步进行中
avatar_speech_finished → 说话结束，进入 listening
placeholder          → Fallback 占位符
```

## 7. Known Warnings

- **AvatarKit WASM file not found**: Vite build 时报告的 packaging/path warning，最终输出仍含 WASM chunk，不影响功能
- **Chunk size > 500kB**: AvatarKit WASM (~1.3MB) 导致的既有 warning
- `npm run build` 通过

## 8. Fallback

```
无 API Key      → Token Fallback
无 Avatar ID    → Placeholder
SDK 初始化失败   → Placeholder
Token 过期      → Placeholder, interview still works
```
