# TTS Integration Notes

## Role In AvaCoach

TTS 将面试官文本转为语音。当前已接入 Volcano TTS V3 HTTP Chunked，输出 16kHz mono PCM16，直接驱动 Spatius AvatarKit 口型同步。

## Current Chain

```
interviewer replyText
→ POST /api/tts
→ Volcano V3 HTTP Chunked (或 OpenAI / Mock)
→ PCM16 16kHz mono (Volcano 直接输出)
→ AvatarKit controller.send(pcm, true)
→ 数字人口型同步 + 语音播放
```

## Provider Modes

```bash
TTS_PROVIDER=volcano  # 火山 V3 HTTP Chunked（推荐中文面试官）
TTS_PROVIDER=openai   # OpenAI TTS
TTS_PROVIDER=mock     # 强制 Browser Speech / Silent Text fallback
```

### Volcano V3 HTTP Chunked

- Endpoint: `https://openspeech.bytedance.com/api/v3/tts/unidirectional`
- Auth: `X-Api-Key` + `X-Api-Resource-Id` + `X-Api-Request-Id`（仅后端）
- Response: HTTP chunked JSON
- `code=0` chunks: base64 音频数据
- `code=20000000` + `message=ok`: 成功结束事件
- 后端解码所有 base64 chunk → 拼接为一个 `audio/pcm` buffer
- 输出: `audio/pcm; rate=16000; channels=1; encoding=signed-integer; bits=16`

### OpenAI TTS

- 模型: `gpt-4o-mini-tts`
- 返回 MP3 等压缩格式
- 前端需 decode → mix to mono → resample 16kHz → PCM16

## Environment Variables

```bash
TTS_PROVIDER=volcano
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=alloy

# Volcano TTS
VOLCANO_TTS_ENABLED=true
VOLCANO_TTS_PROVIDER=volcano_bidirection
VOLCANO_TTS_API_KEY=
VOLCANO_TTS_RESOURCE_ID=seed-tts-2.0
VOLCANO_TTS_VOICE_TYPE=zh_female_vv_uranus_bigtts
VOLCANO_TTS_FORMAT=pcm
VOLCANO_TTS_SAMPLE_RATE=16000
VOLCANO_TTS_SPEECH_RATE=0
VOLCANO_TTS_DISABLE_MARKDOWN_FILTER=true
VOLCANO_TTS_ENABLE_LANGUAGE_DETECTOR=false
VOLCANO_ACCESS_KEY_ID=
VOLCANO_SECRET_ACCESS_KEY=
VOLCANO_APP_ID=
VOLCANO_TTS_ENDPOINT=https://openspeech.bytedance.com/api/v3/tts/unidirectional
```

## AvatarKit Lip-Sync Path

```
Backend TTS → 16kHz mono PCM16 (Volcano) 或 压缩格式 (OpenAI)
              ↓
         压缩格式 → AudioContext.decodeAudioData
              → mix to mono
              → OfflineAudioContext resample 16kHz
              → Float32 → PCM16 LE ArrayBuffer
              ↓
         controller.send(pcm, true)
              ↓
         Spatius AvatarKit 口型动画
```

Volcano TTS 输出已匹配 AvatarKit 所需格式，可直接透传为 ArrayBuffer。

**重要**：只有通过 `controller.send()` 发送的 PCM 才能驱动口型。Browser SpeechSynthesis 和 `<audio>` 播放不会驱动 Avatar 嘴型。

## Fallback Strategy

```
Volcano TTS 成功 → PCM16 → AvatarKit lip-sync ✅
TTS 失败         → Browser SpeechSynthesis → 不驱动口型
Browser 不支持   → Silent Text Mode → 纯文本面试
```

## Current Limits

- 无音频缓存
- 无流式 TTS
- 无 viseme 数据
- 无用户语音选择 UI
- TTS 到 AvatarKit 是非流式（一次性发送整个 PCM buffer）
