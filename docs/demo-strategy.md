# AvaCoach Demo Strategy

## Goal

The first milestone should be demo-ready without depending on external vendors. AvaCoach should feel like a digital human mock interview product even before Spatius Web SDK, LLM, and TTS are integrated.

## Why Mock/Fallback First

Mock and fallback behavior lets the product prove the core interview loop before vendor integration begins. It also protects the demo from API keys, SDK loading issues, network instability, rate limits, and latency while the product direction is still being shaped.

This stage focuses on the user experience:

- Can a candidate choose a role and start an interview?
- Does the digital human area communicate interviewer state?
- Can the user answer questions and receive feedback?
- Can the session end with a useful report?
- Does the product remain presentable when real services are unavailable?

## Current Approach

- Use role-specific mock interview openings and questions.
- Use simple mock scoring based on answer length, role keywords, and response structure.
- Keep all provider-facing logic on the backend.
- Show a fallback digital human area in the frontend while the Spatius SDK is not available.
- Keep the demo flow usable even if external APIs are missing, slow, or unavailable.
- The current fallback demo does not depend on Spatius being configured.
- If Spatius Session Token retrieval fails, the user can still complete the full mock interview flow.
- If OpenAI or DeepSeek LLM generation fails, or the selected provider key is missing, the backend automatically falls back to deterministic mock interview logic.

## Current Demo Flow

1. The user selects a target role.
2. The frontend calls `POST /api/interview/start`.
3. Ava displays a role-specific opening and first question.
4. The candidate submits an answer.
5. The frontend calls `POST /api/interview/next`.
6. The backend returns mock feedback, a score, and the next follow-up question.
7. After three candidate rounds, Ava suggests ending the interview.
8. The frontend calls `POST /api/interview/report`.
9. The final mock report shows overall score, strengths, weaknesses, and suggestions.

## Planned Fallback Layers

1. Digital human fallback
   - Before Spatius is connected, render a polished placeholder interviewer state.
   - After Spatius is connected, detect SDK load/init failures and fall back to the placeholder.

2. Interview intelligence fallback
   - Before LLM integration, use predefined interview questions and simple rubric feedback.
   - After LLM integration, return mock feedback if the selected provider request fails.
   - Preserve the existing response shape so the frontend does not break when switching between LLM and mock.
   - Support `LLM_PROVIDER=openai`, `LLM_PROVIDER=deepseek`, and `LLM_PROVIDER=mock`.

3. Voice fallback
   - Before TTS integration, use text-only interviewer responses.
   - After TTS integration, continue showing text responses when TTS fails.
   - If backend TTS fails, use browser SpeechSynthesis.
   - If browser speech fails, use silent text mode.

## Later Spatius SDK Integration Plan

- Add SDK loading and initialization inside the frontend.
- Request any needed session/token data from the backend.
- Keep Spatius credentials and signing logic on the backend.
- Document setup steps, required environment variables, error states, and fallback behavior in `docs/spatius-integration.md`.
- Preserve the existing static avatar as a stable fallback so interview demos can continue even during SDK, token, or network failures.

## Replacing Mock Layers Later

- Replace the static avatar card with a Spatius SDK component while preserving the same `AvatarStatus` states.
- Replace backend mock question generation with an LLM service behind `/api/interview/start` and `/api/interview/next`.
- Replace mock scoring with LLM rubric evaluation, keeping the existing `Feedback` response shape where possible.
- Replace text-only interviewer replies with TTS audio playback, while keeping text visible for accessibility and fallback.
- Keep the current mock functions as a safe fallback path when Spatius, LLM, or TTS fails.

## LLM Fallback Strategy

The LLM layer is valuable for dynamic follow-up questions and richer final reports, but it should not be a hard dependency for the interview demo. Network failures, quota limits, JSON parse errors, model errors, and missing provider keys all fall back to mock logic inside the backend provider layer.

This keeps the product demo stable: a candidate can always start an interview, answer three rounds, receive feedback, and generate a report even when the LLM is unavailable.

## TTS Fallback Strategy

Voice improves the digital human illusion, but audio is not required for the interview to work. AvaCoach now tries backend TTS first, then browser SpeechSynthesis, then silent text mode.

This means a TTS provider failure, missing `OPENAI_API_KEY`, browser autoplay issue, or unsupported SpeechSynthesis implementation does not block the demo. The conversation text, feedback, and final report remain visible.

## Product Notes To Capture Later

- SDK onboarding clarity.
- Initialization and error handling experience.
- Latency and perceived responsiveness.
- Avatar customization needs for interview scenarios.
- Recommended SDK improvements based on integration friction.
