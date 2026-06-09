# AvaCoach Demo Strategy

## Goal

AvaCoach should be demo-ready even when some external services are unavailable. The user should still understand the product value: a Chinese digital human interviewer that asks questions, listens to answers, evaluates performance, and produces a report.

## Current Demo Positioning

The main demo path is now:

```text
Role + Topic
→ LLM dynamic first question
→ Candidate answer
→ LLM turn planning and evaluation
→ Natural follow-up or close
→ Feedback and final report
```

The question bank is no longer shown as a user-facing mode in the main demo. It remains as a structured knowledge asset for future evaluator design.

This positioning makes the demo feel more natural and professional. A real interviewer does not mechanically compare every answer against a fixed checklist in front of the candidate. Ava should use the candidate's answer to decide what to ask next.

## Why Keep The Question Bank

The question bank is still valuable and should stay in the project:

- It proves the team has structured IT interview domain knowledge.
- It can seed Topic and first-question design.
- It can support offline smoke tests and regression cases.
- It can become a future rubric/evaluator layer.
- It can be expanded into JD-specific or enterprise-owned question sets.

The bank is not a discarded feature. It is a retained assessment asset, just not the main demo interaction model.

## Fallback Strategy

Fallback is part of the product design:

- Spatius token failure -> Avatar placeholder, interview still usable.
- AvatarKit failure -> text interview remains available.
- TTS failure -> browser speech or silent text mode.
- ASR failure -> browser ASR or manual input.
- LLM failure -> mock provider.

The core interview flow should not depend on any single provider.

## Current Demo Flow

1. Open the page.
2. Connect Avatar.
3. Select role and Topic.
4. Start Interview.
5. Ava asks a Topic-guided first question.
6. Candidate answers by voice or text.
7. ASR transcript is editable before submission.
8. Submit Answer.
9. Ava gives natural feedback, a score, a user-friendly scoring reason, and one next question if needed.
10. After the planned rounds, End Interview generates the final report.

## Future Direction

Next improvements should focus on:

- Interview Turn Planner as an explicit decision layer.
- Question bank as pluggable rubric/evaluator data.
- Better calibration between LLM evaluation and structured rubrics.
- JD-specific topic plans.
- Candidate history and personalized practice plans.
