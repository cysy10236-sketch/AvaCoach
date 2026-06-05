import { Router } from "express";
import { createSpatiusSessionToken } from "../services/spatius/spatiusTokenService.js";

const spatiusRouter = Router();

spatiusRouter.get("/session-token", async (_req, res) => {
  try {
    const token = await createSpatiusSessionToken();
    res.json(token);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create Spatius session token.";

    res.json({
      sessionToken: null,
      expireAt: null,
      mode: "fallback",
      fallback: true,
      message,
    });
  }
});

export default spatiusRouter;
