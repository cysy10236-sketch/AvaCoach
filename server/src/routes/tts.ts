import { Router } from "express";
import { createSpeechAudio } from "../services/tts/ttsService.js";
import type { TtsRequest } from "../types/tts.js";

const ttsRouter = Router();

ttsRouter.post("/", async (req, res) => {
  const body = req.body as Partial<TtsRequest>;
  const text = String(body.text ?? "").trim();

  if (!text) {
    res.status(400).json({
      source: "browser-fallback",
      fallback: true,
      text: "",
      message: "text is required",
    });
    return;
  }

  const result = await createSpeechAudio(text);

  if (result.fallback) {
    res.json(result);
    return;
  }

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-AvaCoach-Voice-Source", result.source);
  res.send(result.audio);
});

export default ttsRouter;
