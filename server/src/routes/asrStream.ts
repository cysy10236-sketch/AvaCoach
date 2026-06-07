import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "../config/env.js";
import { VolcanoStreamingAsrClient } from "../services/asr/volcanoStreamingAsrClient.js";
import type { AsrStreamServerMessage } from "../types/asrStream.js";

export function attachAsrStreamRoute(server: {
  on: (event: "upgrade", listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) => void;
}) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/asr/stream")) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (clientSocket) => {
      wss.emit("connection", clientSocket, req);
    });
  });

  wss.on("connection", (clientSocket) => {
    const connectId = randomUUID();
    let backend: VolcanoStreamingAsrClient | null = null;

    // 前端 WebSocket 诊断计数器
    let frontAudioChunkCount = 0;
    let frontAudioBytesTotal = 0;
    let firstFrontChunkBytes = 0;
    let lastFrontChunkBytes = 0;
    let receivedStop = false;
    let sentFinalPacket = false;

    // 后端 ASR 诊断计数器
    let volcanoWsReady = false;
    let volcanoAudioChunkCount = 0;
    let volcanoAudioBytesTotal = 0;
    let partialCount = 0;
    let finalReceived = false;
    let finalTranscriptLength = 0;
    let fallbackReason: string | null = null;

    const safeDiagnostics = (): Record<string, unknown> => ({
      connectId,
      frontAudioChunkCount,
      frontAudioBytesTotal,
      firstFrontChunkBytes,
      lastFrontChunkBytes,
      receivedStop,
      sentFinalPacket,
      volcanoWsReady,
      volcanoAudioChunkCount,
      volcanoAudioBytesTotal,
      partialCount,
      finalReceived,
      finalTranscriptLength,
      fallbackReason,
    });

    const logDiagnostics = (label: string) => {
      if (env.volcanoAsr.streamDebug) {
        console.log(`[ASR Stream ${connectId.slice(0, 8)}] ${label}`, safeDiagnostics());
      }
    };

    const send = (message: AsrStreamServerMessage) => {
      if (clientSocket.readyState === clientSocket.OPEN) {
        clientSocket.send(JSON.stringify(message));
      }
    };

    backend = new VolcanoStreamingAsrClient({
      onDebug: (debug) => {
        send({ type: "ready", debug: { ...safeDiagnostics(), ...debug } });
      },
      onError: (message, debug) => {
        fallbackReason = message;
        sentFinalPacket = true;
        logDiagnostics("fallback sent to frontend");
        send({ type: "fallback", message, debug: { ...safeDiagnostics(), ...debug } });
      },
      onFinal: (text, debug) => {
        finalReceived = true;
        finalTranscriptLength = text.length;
        sentFinalPacket = true;
        logDiagnostics("final sent to frontend");
        send({ type: "final", text, debug: { ...safeDiagnostics(), ...debug } });
      },
      onOpen: (debug) => {
        volcanoWsReady = true;
        logDiagnostics("volcano ws ready");
        send({ type: "ready", debug: { ...safeDiagnostics(), ...debug } });
      },
      onPartial: (text, debug) => {
        partialCount += 1;
        send({ type: "partial", text, debug: { ...safeDiagnostics(), ...debug } });
      },
      onVolcanoAudioSent: (chunkCount, bytesTotal) => {
        volcanoAudioChunkCount = chunkCount;
        volcanoAudioBytesTotal = bytesTotal;
      },
    });
    backend.connect();

    clientSocket.on("message", (data, isBinary) => {
      if (!backend) {
        return;
      }

      if (isBinary) {
        const buf = Buffer.from(data as Buffer);
        frontAudioChunkCount += 1;
        frontAudioBytesTotal += buf.byteLength;
        if (firstFrontChunkBytes === 0) {
          firstFrontChunkBytes = buf.byteLength;
        }
        lastFrontChunkBytes = buf.byteLength;
        backend.sendAudio(buf);

        if (frontAudioChunkCount % 50 === 0) {
          logDiagnostics("frontend audio chunks progress");
        }
        return;
      }

      const text = data.toString();
      if (text === "stop") {
        receivedStop = true;
        logDiagnostics("received stop from frontend");
        backend.finish();
      }
    });

    clientSocket.on("close", () => {
      if (!sentFinalPacket) {
        fallbackReason = fallbackReason ?? "frontend ws closed before final result";
        logDiagnostics("frontend ws closed without final");
      }
      backend?.close();
      backend = null;
    });
  });
}
