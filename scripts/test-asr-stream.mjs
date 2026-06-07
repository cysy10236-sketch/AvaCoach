#!/usr/bin/env node

/**
 * AvaCoach — WebSocket 流式 ASR 本地测试脚本
 *
 * 用途:
 *   验证本地 ws://localhost:3001/api/asr/stream 代理是否正常运行，
 *   以及火山引擎流式 ASR 连接是否通畅。
 *
 * 运行方式:
 *   node scripts/test-asr-stream.mjs                          # 使用内置 440Hz 测试音
 *   node scripts/test-asr-stream.mjs ./test-audio.wav          # 使用 WAV 文件（PCM16/16kHz/mono）
 *   node scripts/test-asr-stream.mjs --duration 5              # 自定义测试音频时长（秒）
 *   node scripts/test-asr-stream.mjs --url ws://localhost:3001/api/asr/stream
 *
 * 前置条件:
 *   - 本地 AvaCoach server 已启动 (npm run dev / npm start)
 *   - 火山引擎 ASR 已配置 (server/.env 中 VOLCANO_ASR_ENABLED=true 等)
 *
 * 安全设计:
 *   - 不输出任何 API Key / Access Token
 *   - 不输出完整音频数据
 *   - 仅输出连接状态、chunk 计数、transcript 内容等可安全展示的信息
 */

import { createReadStream } from "node:fs";
import { WebSocket } from "ws"; // 需要: npm install ws  (项目已有依赖)

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const WS_URL = process.argv
  .find((a) => a.startsWith("--url="))
  ?.split("=")[1] ?? "ws://localhost:3001/api/asr/stream";

const CHUNK_DURATION_MS = 40; // 每 40ms 发送一个音频 chunk（≈25 chunks/s，模拟实时流）
const SAMPLE_RATE = 16000;    // 16kHz
const NUM_CHANNELS = 1;       // mono
const BIT_DEPTH = 16;         // PCM16

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 时间戳，用于日志 */
function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

/** 安全日志：仅输出可安全展示的字段 */
function log(label, detail = {}) {
  const safe = { ...detail };
  // 绝不输出完整音频
  delete safe.audio;
  delete safe.rawData;
  const extra = Object.keys(safe).length ? " " + JSON.stringify(safe) : "";
  console.log(`[${ts()}] ${label}${extra}`);
}

/** 生成 PCM16 正弦波 Buffer（默认 440Hz A 音，便于快速识别协议通道是否畅通） */
function generatePcmSine({
  durationSec = 3,
  frequency = 440,
  sampleRate = SAMPLE_RATE,
  amplitude = 0.3, // 避免削波
} = {}) {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buf = Buffer.alloc(totalSamples * 2); // 16-bit = 2 bytes/sample

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // 前 100ms 做淡入，最后 50ms 做淡出，避免爆音
    let envelope = 1.0;
    const fadeInSamples = Math.floor(sampleRate * 0.1);
    const fadeOutSamples = Math.floor(sampleRate * 0.05);
    if (i < fadeInSamples) {
      envelope = i / fadeInSamples;
    } else if (i > totalSamples - fadeOutSamples) {
      envelope = (totalSamples - i) / fadeOutSamples;
    }

    const sample = Math.floor(
      amplitude * envelope * 32767 * Math.sin(2 * Math.PI * frequency * t),
    );
    // Little-endian 16-bit signed
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
  }

  return buf;
}

/** 读取 WAV 文件的 PCM 数据和格式信息 */
async function readWavFile(filePath) {
  const fd = createReadStream(filePath, { highWaterMark: 44 }); // 先读 header
  return new Promise((resolve, reject) => {
    fd.on("error", reject);
    fd.on("readable", () => {
      const header = fd.read(44);
      if (!header || header.length < 44) {
        reject(new Error("WAV 文件太小，无法读取 header"));
        return;
      }

      const riff = header.toString("ascii", 0, 4);
      if (riff !== "RIFF") {
        reject(new Error(`不是有效的 WAV 文件（缺少 RIFF 标记，读到: ${riff}）`));
        return;
      }

      const wavFormat = header.readUInt16LE(20); // 1 = PCM
      const numChannels = header.readUInt16LE(22);
      const wavSampleRate = header.readUInt32LE(24);
      const bitsPerSample = header.readUInt16LE(34);

      log("WAV 文件信息", {
        filePath,
        format: wavFormat === 1 ? "PCM" : `其他(${wavFormat})`,
        numChannels,
        sampleRate: wavSampleRate,
        bitsPerSample,
      });

      if (wavFormat !== 1) {
        console.warn("  ⚠ 非 PCM 格式，火山 ASR 可能无法识别，继续尝试…");
      }
      if (wavSampleRate !== SAMPLE_RATE) {
        console.warn(`  ⚠ 采样率 ${wavSampleRate}Hz ≠ 16kHz，火山 ASR 可能无法识别，继续尝试…`);
      }

      fd.destroy();

      // 重新打开，跳过 header 读取所有 PCM 数据
      const fullFd = createReadStream(filePath, { start: 44 });
      const chunks = [];
      fullFd.on("data", (c) => chunks.push(c));
      fullFd.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      fullFd.on("error", reject);
    });
  });
}

// ---------------------------------------------------------------------------
// 主测试流程
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       AvaCoach — WebSocket 流式 ASR 本地测试                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();

  // ---------- 1. 准备音频数据 ----------
  const wavPath = process.argv.find((a) => a.endsWith(".wav"));
  const durationArg = process.argv
    .find((a) => a.startsWith("--duration="))
    ?.split("=")[1];
  const durationSec = durationArg ? Number(durationArg) : 3;

  let audioBuffer;
  let audioSource;

  if (wavPath) {
    log("📂 读取 WAV 文件…", { filePath: wavPath });
    audioBuffer = await readWavFile(wavPath);
    audioSource = "file";
  } else {
    log("🔊 生成测试音频…", {
      type: "440Hz 正弦波",
      durationSec,
      sampleRate: SAMPLE_RATE,
      bitDepth: BIT_DEPTH,
      channels: NUM_CHANNELS,
    });
    audioBuffer = generatePcmSine({ durationSec });
    audioSource = "sine";
  }

  const totalChunks = Math.ceil(
    audioBuffer.length / (SAMPLE_RATE * (BIT_DEPTH / 8) * (CHUNK_DURATION_MS / 1000)),
  );
  const bytesPerChunk = Math.ceil(
    SAMPLE_RATE * (BIT_DEPTH / 8) * (CHUNK_DURATION_MS / 1000),
  );

  log("📊 音频数据就绪", {
    totalBytes: audioBuffer.length,
    totalDurationSec: (audioBuffer.length / (SAMPLE_RATE * (BIT_DEPTH / 8))).toFixed(2),
    bytesPerChunk,
    estimatedChunks: totalChunks,
  });

  // ---------- 2. 连接 WebSocket ----------
  log("🔗 正在连接 WebSocket…", { url: WS_URL });

  const ws = new WebSocket(WS_URL);
  ws.binaryType = "nodebuffer";

  let chunkIndex = 0;
  let partialCount = 0;
  let finalReceived = false;
  let readyReceived = false;
  let chunkTimer = null;

  const done = new Promise((resolve) => {
    // ---------- WebSocket 事件处理 ----------
    ws.on("open", () => {
      log("✅ WebSocket 已连接，等待后端 ASR ready…");

      // 连接成功后开始发送音频 chunk
      chunkTimer = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          clearInterval(chunkTimer);
          return;
        }

        const start = chunkIndex * bytesPerChunk;
        const end = Math.min(start + bytesPerChunk, audioBuffer.length);

        if (start >= audioBuffer.length) {
          // 所有音频已发送完毕
          clearInterval(chunkTimer);
          chunkTimer = null;
          log("🏁 音频已全部发送，发送 stop 指令…", {
            totalChunksSent: chunkIndex,
            totalBytesSent: audioBuffer.length,
          });
          ws.send("stop");
          return;
        }

        const chunk = audioBuffer.subarray(start, end);
        ws.send(chunk);

        chunkIndex++;
        if (chunkIndex % 50 === 0 || chunkIndex === 1) {
          log("📤 发送音频 chunk", {
            chunkIndex,
            bytesThisChunk: chunk.length,
            totalBytesSent: end,
            progressPercent: ((end / audioBuffer.length) * 100).toFixed(1) + "%",
          });
        }
      }, CHUNK_DURATION_MS);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "ready":
            readyReceived = true;
            log("🟢 ASR 后端就绪 (ready)", msg.debug ?? {});
            break;

          case "debug":
            // 服务端发来的调试信息（包含火山原始响应字节分析）
            if (msg.debug?.parseDebug) {
              log("🔬 " + msg.debug.parseDebug);
            } else {
              log("🐛 debug", msg.debug ?? {});
            }
            break;

          case "partial":
            partialCount++;
            log(`📝 Partial #${partialCount}`, {
              text: msg.text ?? "",
              textLength: (msg.text ?? "").length,
              ...(msg.debug ?? {}),
            });
            break;

          case "final":
            finalReceived = true;
            log("✅ 最终识别结果 (final)", {
              text: msg.text ?? "",
              textLength: (msg.text ?? "").length,
              ...(msg.debug ?? {}),
            });
            // 收到 final 后主动关闭连接
            setTimeout(() => ws.close(), 500);
            break;

          case "fallback":
            log("⚠️  ASR 回退/降级 (fallback)", {
              message: msg.message ?? "",
              ...(msg.debug ?? {}),
            });
            break;

          case "error":
            log("❌ ASR 错误 (error)", {
              message: msg.message ?? "",
              ...(msg.debug ?? {}),
            });
            break;

          default:
            log("❓ 未知消息类型", { rawType: msg.type, ...msg });
        }
      } catch {
        log("⚠️  收到非 JSON 消息，可能是二进制数据");
      }
    });

    ws.on("error", (err) => {
      log("💥 WebSocket 连接错误", { message: err.message });
      clearInterval(chunkTimer);
      resolve({ ok: false, error: err.message });
    });

    ws.on("close", (code, reason) => {
      log("🔌 WebSocket 连接关闭", {
        code,
        reason: reason?.toString() ?? "",
      });

      clearInterval(chunkTimer);
      resolve({ ok: finalReceived });
    });
  });

  // 超时处理：基于实际音频时长 + 充足余量
  const audioDurationSec = audioBuffer.length / (SAMPLE_RATE * (BIT_DEPTH / 8));
  const timeoutMs = Math.max(20000, audioDurationSec * 1000 + 20000);
  const result = await Promise.race([
    done,
    new Promise((resolve) =>
      setTimeout(() => {
        log("⏰ 超时", { timeoutMs });
        ws.close();
        resolve({ ok: false, error: "timeout" });
      }, timeoutMs),
    ),
  ]);

  // ---------- 3. 输出测试摘要 ----------
  console.log();
  console.log("════════════════════════════════════════════════════════════");
  console.log("                    测试结果摘要");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  WebSocket 地址    : ${WS_URL}`);
  console.log(`  音频来源          : ${audioSource === "file" ? (wavPath ?? "未知") : "440Hz 正弦波"}`);
  console.log(`  音频时长          : ${(audioBuffer.length / (SAMPLE_RATE * 2)).toFixed(2)}s`);
  console.log(`  发送 chunk 数     : ${chunkIndex}`);
  console.log(`  Partial 数        : ${partialCount}`);
  console.log(`  Ready 收到        : ${readyReceived ? "✅ 是" : "❌ 否"}`);
  console.log(`  Final 收到        : ${finalReceived ? "✅ 是" : "❌ 否"}`);
  console.log(`  整体结果          : ${result.ok ? "✅ 通过" : "❌ 未通过"}`);
  console.log("════════════════════════════════════════════════════════════");

  if (!readyReceived) {
    console.log();
    console.log("💡 提示: 未收到 'ready' 事件，请检查:");
    console.log("   1. server/.env 中 VOLCANO_ASR_ENABLED 是否为 true");
    console.log("   2. VOLCANO_ASR_API_KEY / RESOURCE_ID 是否正确");
    console.log("   3. 火山引擎控制台 ASR 服务是否已开通");
  }

  if (!finalReceived && readyReceived) {
    console.log();
    console.log("💡 提示: 收到 ready 但未收到 final，可能原因:");
    console.log("   1. 测试音频为合成正弦波，ASR 未识别到语音内容");
    console.log("   2. 尝试传入真实语音 WAV 文件: node scripts/test-asr-stream.mjs ./speech.wav");
    console.log("   3. 检查火山引擎 ASR 模型配置 (modelName) 是否支持中文");
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("测试脚本异常:", err.message);
  process.exit(2);
});
