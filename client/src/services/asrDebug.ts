/**
 * AvaCoach — ASR 音频诊断工具（仅开发环境）
 *
 * 功能：
 *   - 记录 PCM 数据并输出诊断统计
 *   - 提供 downloadLastAsrPcm() 下载录音为 .wav 文件
 *
 * 安全：
 *   - 只在 import.meta.env.DEV 下激活
 *   - 不自动保存任何录音文件
 *   - 不输出完整音频到控制台
 */

export interface AsrDebugStats {
  recordedDurationMs: number
  pcmChunkCount: number
  pcmBytesTotal: number
  estimatedDurationSec: number
  averageBytesPerSecond: number
  first10SampleValues: number[]
  rmsLevel: number
  peakLevel: number
  silenceRatio: number
}

interface AsrDebugSession {
  chunks: ArrayBuffer[]
  startTime: number
  endTime: number
}

let currentSession: AsrDebugSession | null = null
let lastPcmBuffer: ArrayBuffer | null = null

const SILENCE_THRESHOLD = 0.01 // RMS 低于此值视为静音

export function isAsrDebugEnabled(): boolean {
  return import.meta.env.DEV
}

export function startAsrDebugSession(): void {
  if (!isAsrDebugEnabled()) return

  currentSession = {
    chunks: [],
    startTime: performance.now(),
    endTime: 0,
  }
  lastPcmBuffer = null

  console.info('[AvaCoach ASR Debug] 录音调试会话已启动')
}

export function recordAsrDebugChunk(chunk: ArrayBuffer): void {
  if (!isAsrDebugEnabled() || !currentSession) return
  currentSession.chunks.push(chunk)
}

export function stopAsrDebugSession(): AsrDebugStats | null {
  if (!isAsrDebugEnabled() || !currentSession) return null

  currentSession.endTime = performance.now()

  const allChunks = currentSession.chunks
  const totalLength = allChunks.reduce((sum, c) => sum + c.byteLength, 0)
  const pcm16 = new Int16Array(totalLength / 2)
  let offset = 0
  for (const chunk of allChunks) {
    pcm16.set(new Int16Array(chunk), offset)
    offset += chunk.byteLength / 2
  }

  lastPcmBuffer = pcm16.buffer

  const stats = computeStats(
    pcm16,
    currentSession.startTime,
    currentSession.endTime,
    allChunks.length,
    totalLength,
  )

  console.info('[AvaCoach ASR Debug] 录音调试统计', stats)

  currentSession = null
  return stats
}

function computeStats(
  pcm16: Int16Array,
  startTime: number,
  endTime: number,
  chunkCount: number,
  bytesTotal: number,
): AsrDebugStats {
  const recordedDurationMs = endTime - startTime
  const estimatedDurationSec = bytesTotal / 32000 // 16kHz * 2 bytes/sample = 32000 bytes/s
  const averageBytesPerSecond =
    recordedDurationMs > 0 ? (bytesTotal / recordedDurationMs) * 1000 : 0

  // 前10个样本值
  const first10SampleValues: number[] = []
  for (let i = 0; i < Math.min(10, pcm16.length); i++) {
    first10SampleValues.push(pcm16[i])
  }

  // RMS 和 Peak
  let sumSquares = 0
  let peakAbsolute = 0
  let silentSamples = 0
  for (let i = 0; i < pcm16.length; i++) {
    const normalized = pcm16[i] / 32768
    sumSquares += normalized * normalized
    const abs = Math.abs(pcm16[i])
    if (abs > peakAbsolute) {
      peakAbsolute = abs
    }
    if (Math.abs(normalized) < SILENCE_THRESHOLD) {
      silentSamples += 1
    }
  }
  const rmsLevel = Math.sqrt(sumSquares / Math.max(1, pcm16.length))
  const peakLevel = peakAbsolute / 32768
  const silenceRatio = pcm16.length > 0 ? silentSamples / pcm16.length : 1

  return {
    recordedDurationMs: Math.round(recordedDurationMs),
    pcmChunkCount: chunkCount,
    pcmBytesTotal: bytesTotal,
    estimatedDurationSec: Math.round(estimatedDurationSec * 100) / 100,
    averageBytesPerSecond: Math.round(averageBytesPerSecond),
    first10SampleValues,
    rmsLevel: Math.round(rmsLevel * 10000) / 10000,
    peakLevel: Math.round(peakLevel * 10000) / 10000,
    silenceRatio: Math.round(silenceRatio * 10000) / 10000,
  }
}

/**
 * 下载最后一次录音为 WAV 文件（仅开发环境）
 * 可在浏览器控制台调用：downloadLastAsrPcm()
 */
export function downloadLastAsrPcm(): void {
  if (!isAsrDebugEnabled()) {
    console.warn('[AvaCoach ASR Debug] downloadLastAsrPcm 仅在开发环境可用')
    return
  }

  if (!lastPcmBuffer || lastPcmBuffer.byteLength === 0) {
    console.warn('[AvaCoach ASR Debug] 没有可下载的录音数据，请先完成一次录音')
    return
  }

  const pcmData = new Uint8Array(lastPcmBuffer)
  const wav = pcm16ToWav(pcmData, 16000, 1, 16)
  const blob = new Blob([wav], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ava-coach-debug-${Date.now()}.wav`
  a.click()
  URL.revokeObjectURL(url)

  console.info('[AvaCoach ASR Debug] 已下载调试录音 WAV 文件', {
    pcmBytes: lastPcmBuffer.byteLength,
    wavBytes: wav.byteLength,
    fileName: a.download,
  })
}

function pcm16ToWav(
  pcm: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt subchunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // subchunk size
  view.setUint16(20, 1, true) // audio format (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data subchunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM data
  const uint8View = new Uint8Array(buffer)
  uint8View.set(pcm, 44)

  return buffer
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

// 暴露到全局 window 对象，方便在浏览器控制台调用
if (isAsrDebugEnabled()) {
  ;(window as unknown as Record<string, unknown>).downloadLastAsrPcm = downloadLastAsrPcm
  console.info(
    '[AvaCoach ASR Debug] 开发模式已激活。可在控制台调用 downloadLastAsrPcm() 下载最后一次录音。',
  )
}
