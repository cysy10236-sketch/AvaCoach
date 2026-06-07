import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import asrRouter from "./routes/asr.js";
import { attachAsrStreamRoute } from "./routes/asrStream.js";
import interviewRouter from "./routes/interview.js";
import questionBankRouter from "./routes/questionBank.js";
import spatiusRouter from "./routes/spatius.js";
import ttsRouter from "./routes/tts.js";

const app = express();
const server = createServer(app);

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
app.use("/api/asr", asrRouter);

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

attachAsrStreamRoute(server);

server.listen(env.port, () => {
  console.log(`AvaCoach API listening on http://localhost:${env.port}`);
});
