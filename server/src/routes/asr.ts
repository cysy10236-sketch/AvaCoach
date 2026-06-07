import express, { Router } from "express";
import { transcribeSpeech } from "../services/asr/asrService.js";
import type { AsrTranscribeRequest } from "../types/asr.js";

const asrRouter = Router();

asrRouter.use(
  express.raw({
    limit: "30mb",
    type: ["audio/*", "application/octet-stream"],
  }),
);

asrRouter.post("/transcribe", async (req, res) => {
  const contentType = String(req.headers["content-type"] ?? "");

  try {
    if (contentType.includes("application/json")) {
      const body = req.body as Partial<AsrTranscribeRequest>;
      const result = await transcribeSpeech({
        audioBase64: body.audioBase64 ?? body.audio?.base64 ?? body.audio?.data,
        audioFormat: body.audio?.format,
        audioUrl: body.audioUrl ?? body.audio?.url,
        callbackData: body.callbackData,
        callbackUrl: body.callbackUrl,
        language: body.language,
        mockText: body.mockText,
        request: body.request,
        user: body.user,
      });

      res.json(result);
      return;
    }

    const rawAudio = Buffer.isBuffer(req.body) ? req.body : undefined;
    const result = await transcribeSpeech({
      audio: rawAudio,
      contentType,
      language:
        typeof req.query.language === "string" ? req.query.language : "zh-CN",
    });

    res.json(result);
  } catch (error) {
    res.status(200).json({
      transcript: "",
      provider: "mock",
      fallback: true,
      message:
        error instanceof Error
          ? error.message
          : "ASR failed. Please use manual typing.",
    });
  }
});

export default asrRouter;
