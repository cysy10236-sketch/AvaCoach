import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import interviewRouter from "./routes/interview.js";
import questionBankRouter from "./routes/questionBank.js";
import spatiusRouter from "./routes/spatius.js";
import ttsRouter from "./routes/tts.js";

const app = express();

app.use(
  cors({
    origin: env.clientOrigin,
  }),
);
app.use(express.json());
app.use("/api/interview", interviewRouter);
app.use("/api/question-bank", questionBankRouter);
app.use("/api/spatius", spatiusRouter);
app.use("/api/tts", ttsRouter);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "AvaCoach API",
  });
});

app.get("/api/mock/interview", (_req, res) => {
  res.json({
    mode: "mock",
    interviewer: {
      name: "Ava",
      role: "AI Digital Human Mock Interviewer",
    },
    question: "Tell me about a project where you solved a difficult technical problem.",
    fallback: {
      spatius: true,
      llm: true,
      tts: true,
    },
  });
});

app.listen(env.port, () => {
  console.log(`AvaCoach API listening on http://localhost:${env.port}`);
});
