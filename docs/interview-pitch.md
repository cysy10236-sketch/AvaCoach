# 3-Minute Interview Pitch

## 1. 产品介绍

AvaCoach 是一个 AI 数字人模拟面试官。用户可以选择目标岗位，比如前端工程师、产品经理、AI 工程师，系统会以面试官的形式发起问题，根据用户回答进行追问和评分，最后生成一份面试报告。

我做这个项目时，重点不是做一个普通聊天机器人，而是做一个更像真实面试场景的练习产品。所以它有对话记录、岗位选择、评分反馈、语音朗读、最终报告，以及数字人展示区域。

## 2. 为什么选择这个场景

我觉得面试陪练很适合数字人。因为面试不只是回答内容对不对，还包括表达、节奏、压力感和临场感。

如果只是文本 chatbot，用户更像是在写答案。但数字人面试官可以让用户更有“被面试”的感觉，更适合练习自我介绍、项目表达、STAR 结构和追问应对。

所以 AvaCoach 的核心价值是：让用户在一个更接近真实面试的环境里反复练习，并且得到结构化反馈。

## 3. 技术架构

技术上我用了 React + Vite + TypeScript 做前端，Node.js + Express + TypeScript 做后端。

整体链路是：

```text
用户回答 -> Interview API -> LLM Provider / Mock Fallback -> TTS / 浏览器语音 fallback -> Spatius Avatar Layer -> 数字人面试官 UI
```

目前前端只调用固定的 interview API。后端 LLM 层已经改成 provider-based 架构，可以通过 `LLM_PROVIDER` 切换 OpenAI、DeepSeek 或 Mock。无论使用哪个 provider，前端收到的 JSON 格式都保持一致。

如果没有配置 key，或者 provider 调用失败，系统会自动切到 mock fallback，demo 仍然可以完整展示。

## 4. Spatius 接入理解

我对 Spatius 在这个系统里的定位是：它不是 LLM，也不是业务逻辑层，而是数字人 avatar rendering 和 driving layer。

也就是说，AvaCoach 后端负责面试逻辑、LLM provider、TTS 和 Session Token。前端拿到短期 Session Token 后，后续会初始化 Spatius Avatar SDK，用真实数字人替换现在的 placeholder，并用 TTS 音频驱动数字人说话、口型同步和状态变化。

目前我已经完成了后端 Session Token 接口，并且把 API Key 限制在 `server/.env`。因为暂时还没有 Avatar ID，所以我没有假装完成 SDK 初始化，而是保留了 fallback avatar placeholder，保证当前 demo 可用。

## 5. 产品建议和后续优化

基于这次接入体验，我觉得 Spatius SDK 可以重点优化几个方向。

第一，提供端到端业务模板，比如 AI 面试官、AI 老师、客服数字人。模板里最好包含前端、token server、LLM、TTS 和 Avatar SDK。

第二，补充音频格式指导。开发者接 TTS 后最关心的是 SDK 支持什么音频格式、采样率、mp3/wav/pcm 怎么处理，以及能不能支持 stream。

第三，提供更清晰的 Direct Mode quickstart 和错误排查，比如 token 过期、region 错误、App ID 不匹配、Avatar ID 缺失等。

后续如果拿到 Avatar ID，我的下一步就是接入 Spatius Web Avatar SDK，把现在的 placeholder 替换成真实数字人，并把 TTS 音频接到 avatar driving 流程里。
## Structured IT Question Bank Update

AvaCoach now supports a structured IT question bank in addition to AI Generated questions.

The question bank is local demo seed data. Each question has:

- role
- topic
- difficulty
- expectedPoints
- followUps
- tags

This makes the demo more like a real interview training system. The interviewer can ask a controlled frontend/backend/AI/behavioral question, evaluate the candidate answer against expected knowledge points, show covered and missing points, and generate topic-level report summaries.

The seed bank does not scrape login-only, paid, restricted, or anti-scraping content. It does not mirror external websites or store full pages. It is a replaceable demo layer that can later become an enterprise role bank, a JD-generated question bank, or a user-customized practice bank.
