# Interview Checklist

## Before Demo

- `npm install` 已完成。
- `npm run build` 通过。
- `server/.env` 使用占位或本地真实配置，不提交。
- `client/.env` 配置 `VITE_SPATIUS_APP_ID` 和 `VITE_SPATIUS_AVATAR_ID`。
- 不在 README 或 docs 中写真实 key、sessionToken、Avatar ID。

## Runtime Check

1. `npm run dev`
2. 打开 `http://localhost:5173`
3. 检查后端 `http://localhost:3001/health`
4. Connect Avatar
5. 等待 Avatar Connected
6. Send Sample Audio
7. Start Interview
8. 数字人提问并口型同步
9. 开始语音回答
10. ASR partial / final transcript 回填
11. Submit Answer
12. Feedback 展示 score / coveredPoints / missingPoints / improvementTips / scoringReason
13. 三轮后状态进入 ended / reportReady
14. End Interview
15. Final Report 展示
16. ended 后不再继续追问
17. Reset Demo 状态清空

## Flow Edge Cases

- 候选人说“不会”或“没做过”：Ava 应温和降难度或换角度追问。
- 候选人说“可以换一道吗”：Ava 应换相关问题，不强行结束。
- 候选人问薪资/福利/流程：Ava 应简短回应并拉回技术面试。
- 第三轮后：不再生成新题，只引导查看报告。
- Report 后：只查看报告或 Reset Demo。

## Scoring Check

- 分数显示为 0-100。
- 不应出现 `8 / 100`。
- 完整回答覆盖 expectedPoints 时，分数应合理上升。
- “不会”类回答分数应受限但反馈友好。
- scoringReason 能解释分数来源。

## Fallback Check

- Avatar 失败：placeholder / text mode 可继续。
- TTS 失败：browser speech / silent text 可继续。
- ASR 失败：browser ASR / manual input 可继续。
- LLM 失败：mock provider 可继续。
- Spatius token 失败：fallback demo still usable。

## Known Warnings

- AvatarKit WASM warning：已知非阻塞。
- Chunk size warning：AvatarKit 资源导致，已知非阻塞。
- 只要 `npm run build` 通过即可接受。
