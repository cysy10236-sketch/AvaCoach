import { Router } from "express";
import {
  generateFinalReport,
  generateFollowUp,
  generateOpeningAndFirstQuestion,
} from "../services/llm/llmService.js";
import type {
  InterviewRole,
  NextInterviewRequest,
  ReportInterviewRequest,
  StartInterviewRequest,
} from "../types/interview.js";

const interviewRouter = Router();

const validRoles: InterviewRole[] = ["frontend", "product", "ai", "behavioral"];

interviewRouter.post("/start", async (req, res) => {
  const body = req.body as Partial<StartInterviewRequest>;
  const role = normalizeRole(body.role);

  res.json(await generateOpeningAndFirstQuestion(role));
});

interviewRouter.post("/next", async (req, res) => {
  const body = req.body as Partial<NextInterviewRequest>;
  const role = normalizeRole(body.role);
  const answer = String(body.answer ?? "").trim();
  const history = Array.isArray(body.history) ? body.history : [];

  if (!answer) {
    res.status(400).json({ error: "answer is required" });
    return;
  }

  res.json(await generateFollowUp(role, answer, history));
});

interviewRouter.post("/report", async (req, res) => {
  const body = req.body as Partial<ReportInterviewRequest>;
  const role = normalizeRole(body.role);
  const history = Array.isArray(body.history) ? body.history : [];

  res.json(await generateFinalReport(role, history));
});

function normalizeRole(role: unknown): InterviewRole {
  return validRoles.includes(role as InterviewRole) ? (role as InterviewRole) : "behavioral";
}

export default interviewRouter;
