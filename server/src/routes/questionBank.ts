import { Router } from "express";
import {
  getQuestionBankQuestions,
  getQuestionBankRoles,
  getQuestionBankTopics,
  normalizeBankRole,
  normalizeDifficulty,
  pickQuestion,
} from "../services/questionBank/questionBankService.js";

const questionBankRouter = Router();

questionBankRouter.get("/roles", (_req, res) => {
  res.json({
    roles: getQuestionBankRoles(),
  });
});

questionBankRouter.get("/topics", (req, res) => {
  const role = normalizeBankRole(req.query.role);

  res.json({
    role,
    topics: getQuestionBankTopics(role),
  });
});

questionBankRouter.get("/questions", (req, res) => {
  const role = normalizeBankRole(req.query.role);
  const difficulty = normalizeDifficulty(req.query.difficulty);
  const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;

  res.json({
    questions: getQuestionBankQuestions({
      role,
      difficulty,
      topic,
    }),
  });
});

questionBankRouter.post("/pick", (req, res) => {
  const body = req.body as {
    role?: unknown;
    difficulty?: unknown;
    topic?: unknown;
  };
  const role = normalizeBankRole(body.role);
  const difficulty = normalizeDifficulty(body.difficulty);
  const topic = typeof body.topic === "string" ? body.topic : undefined;

  res.json({
    question: pickQuestion({
      role,
      difficulty,
      topic,
    }),
  });
});

export default questionBankRouter;
