# Interview Checklist

## Install & Build

- [ ] `npm install` succeeds.
- [ ] `npm run build` passes.
- [ ] Only known AvatarKit WASM / chunk size warnings appear.
- [ ] `.env` files are not tracked by git.
- [ ] No real API Key, session token, or Avatar ID appears in docs or code.

## Startup

- [ ] `npm run dev` starts frontend and backend.
- [ ] Frontend opens at `http://localhost:5173`.
- [ ] Backend health check works at `http://localhost:3001/health`.
- [ ] Vite proxy routes `/api/*` to the backend.

## Main Demo Flow

- [ ] Select role.
- [ ] Select Topic.
- [ ] Click `Connect Avatar`.
- [ ] Avatar becomes connected, or placeholder fallback remains usable.
- [ ] Click `Start Interview`.
- [ ] First question matches the selected role/topic.
- [ ] The page does not expose an `IT Question Bank` mode in the main UI.
- [ ] The right panel does not show rigid covered/missing point lists.
- [ ] Candidate can type an answer.
- [ ] Candidate can record voice if ASR is configured.
- [ ] ASR transcript fills the answer box.
- [ ] User can edit transcript before submission.
- [ ] `Submit Answer` generates feedback, scoring reason, suggestions, and one natural next question.
- [ ] The follow-up is based on the answer, not a fixed question-bank script.
- [ ] After planned rounds, `End Interview` generates the final report.
- [ ] `Reset Demo` clears state and allows a new run.

## Full Demo Mode

- [ ] `/api/spatius/session-token` returns direct mode when configured.
- [ ] `Connect Avatar` loads real Avatar.
- [ ] `Send Sample Audio` can validate AvatarKit lip-sync.
- [ ] Volcano TTS returns `audio/pcm; rate=16000; channels=1; encoding=signed-integer; bits=16`.
- [ ] Start Interview voice drives Avatar lip-sync.
- [ ] Submit Answer follow-up voice drives Avatar lip-sync.
- [ ] No double audio plays.
- [ ] Volcano Streaming ASR partial/final transcript works.

## Safe Fallback Mode

- [ ] Missing Spatius config does not block the interview.
- [ ] Missing TTS config falls back to browser speech or text.
- [ ] Missing ASR config falls back to browser ASR or manual input.
- [ ] Missing LLM config falls back to mock provider.
- [ ] The full text interview flow still works.

## Question Bank Asset

- [ ] `server/src/data/interviewQuestionBank.json` remains in the repository.
- [ ] The bank is documented as a retained knowledge asset.
- [ ] The bank is not presented as the main user-facing demo mode.
- [ ] Future evaluator/rubric use is documented.

## UX Consistency

- [ ] Buttons are visible and disabled states are clear.
- [ ] Submit Answer is prominent when an answer is ready.
- [ ] Final Report appears inside the right panel without layout jump.
- [ ] Topic options are visible in the left panel without inner scrollbar.
- [ ] No horizontal page scrolling.

## Edge Cases

- [ ] “我不知道” lowers difficulty or changes angle.
- [ ] “可以换题吗” changes to a related question, not end.
- [ ] Salary/benefit questions are answered briefly and redirected to interview.
- [ ] Ended sessions do not generate new questions.
