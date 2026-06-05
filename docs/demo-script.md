# AvaCoach Demo Script

## Demo Order

1. Introduce AvaCoach as an AI digital human interview coach, not just a chatbot.
2. Explain the architecture boundary: Spatius is the avatar rendering and lip-sync layer, not the LLM or TTS provider.
3. Start the project with `npm run dev`.
4. Open `http://localhost:5173`.
5. Point out the layout: avatar area, live conversation, feedback panel, and controls.
6. Click Connect Avatar.
7. Wait for the real Avatar to appear and the status to reach Avatar Connected.
8. Click Send Sample Audio and explain that this is the official SDK validation PCM, used only to verify AvatarKit rendering, Motion Server connection, and lip-sync.
9. Select a role, such as Frontend Engineer.
10. Set Question Source to IT Question Bank.
11. Choose Difficulty, such as Medium.
12. Choose a Topic, such as React.
13. Click Start Interview.
14. Explain that the first question comes from the structured seed bank, while follow-up and scoring can still use the LLM with expected points as context.
15. Explain that the voice comes from Volcano TTS or another backend TTS provider, and Spatius drives mouth motion from the PCM audio.
16. Type a concise candidate answer.
17. Click Submit Answer.
18. Show the candidate bubble, AI follow-up, score, feedback, covered points, missing points, and improvement tips.
19. Repeat until round 3 or until the UI suggests ending.
20. Click End Interview.
21. Show the final report: Overall Score, Strengths, Weaknesses, Suggestions, Strong Topics, Weak Topics, Missed Knowledge Points, and Recommended Practice Topics.
22. Explain fallback behavior and the next plans: ASR voice answers and larger enterprise/JD/custom question banks.
23. Click Reset Demo to prove the flow is reusable.

## Live Startup

```powershell
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3001
```

## Explaining The Avatar Placeholder

Say:

```text
Spatius is the rendering and lip-sync layer. Connect Avatar fetches a backend-minted Direct Mode Session Token, initializes AvatarKit, loads the Avatar ID, and connects to the Motion Server. If any SDK step fails, the placeholder remains active and the AI interview flow is still fully usable.
```

## Explaining LLM And Mock Fallback

Say:

```text
The same interview endpoints can use OpenAI when OPENAI_API_KEY is configured. If the key is missing, the model fails, or JSON parsing fails, the backend automatically returns mock interview logic. The UI shows AI Mode or Mock Fallback Mode based on the response source.
```

## Explaining The IT Question Bank

Say:

```text
AvaCoach now supports two question sources: AI Generated and IT Question Bank. The question bank is structured seed data with role, topic, difficulty, expected points, follow-ups, and tags. This changes the product from a random AI Q&A demo into a controllable interview training system. The seed bank is not scraped from a restricted site; it is manually structured demo data inspired by common public interview topics and can later be replaced by an enterprise-owned question bank, JD-generated questions, or user-customized questions.
```

## Explaining TTS Providers

Say:

```text
The TTS layer is provider-based. Volcano TTS V3 HTTP Chunked is now integrated for Chinese interviewer speech and returns 16 kHz mono PCM16 audio. OpenAI TTS is also supported. If backend TTS is unavailable, the demo falls back to browser speech or silent text mode.
```

## Explaining Voice Modes

Say:

```text
Ava first tries backend TTS. When a real avatar is connected, the TTS audio is normalized to 16 kHz mono PCM16 and sent to AvatarKit for lip-sync. Volcano already returns that PCM format. If backend TTS is unavailable, browser SpeechSynthesis is used, but browser speech does not drive avatar lip-sync. If the browser cannot speak, Ava stays in Silent Text Mode. The text interview remains fully usable in every case.
```

## Likely Interviewer Questions

Q: Why not put API keys in the frontend?

A: Frontend environment variables are bundled into browser assets. AvaCoach keeps OpenAI and Spatius API keys on the Express backend and only returns short-lived or non-secret outputs to the browser.

Q: Why build fallback before real SDK integration?

A: The fallback proves the product loop and protects the demo from vendor setup, network failures, quota issues, and SDK initialization risk.

Q: How does the app know whether it is using AI or mock?

A: The backend adds `source: "llm"` or `source: "mock"` to interview API responses. The Header displays the current mode.

Q: What is Spatius responsible for here?

A: Spatius handles avatar rendering, Motion Server connection, audio-driven motion, and lip-sync. It does not generate questions or synthesize speech.

Q: Why use bundled sample audio before TTS?

A: The official quickstart sample PCM isolates the Spatius path: App ID, Avatar ID, Session Token, avatar loading, Motion Server connection, PCM send, local rendering, and lip sync. Once that works, product TTS can be connected confidently.

Q: How does real interview speech drive the avatar?

A: The interviewer replyText is sent to backend TTS. The frontend decodes the returned audio, mixes it to mono, resamples to 16 kHz, converts it to PCM16, and calls AvatarKit `controller.send(pcm, true)`. Browser speech fallback is only an audible fallback and does not move the avatar mouth.

Q: How are expectedPoints used?

A: In question bank mode, each question has expectedPoints. The backend compares the candidate answer against those points and returns coveredPoints, missingPoints, and improvementTips. The LLM also receives the expected points as context so its feedback and follow-up can stay aligned with the structured rubric.

Q: What changed after integrating Volcano TTS?

A: Volcano TTS V3 HTTP Chunked now returns 16 kHz mono PCM16 audio from the backend. That audio can be sent into AvatarKit without using browser SpeechSynthesis, so Start Interview and Submit Answer can drive digital human lip-sync.

Q: What lifecycle bug did you fix?

A: AvatarKit connected successfully but was destroyed immediately after Start Interview. The cause was an `AvatarStage` cleanup effect depending on an inline callback from `App.tsx`. State updates changed the callback identity, React ran the old cleanup, and the runtime was destroyed. I fixed it by storing the callback in a ref and making cleanup run only on true unmount.

Q: How would you improve this for production?

A: Add persisted sessions, auth, rate limits, structured logs, token refresh, TTS caching, SDK telemetry, deployment config, ASR voice answers, and stronger IT interview rubrics.
