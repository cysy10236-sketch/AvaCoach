# Interview Checklist

克隆仓库后的逐项验证清单，确保项目可以正常运行。

---

## 安装与环境

- [ ] `npm install` 成功（无报错）
- [ ] `server/.env` 已配置
  - Safe Fallback 模式：`LLM_PROVIDER=mock`、`TTS_PROVIDER=mock`、`ASR_PROVIDER=mock`
  - Full Demo 模式：所有外部服务 Key 已填写
- [ ] `client/.env` 已配置
  - Safe Fallback 模式：留空即可（Avatar 区显示 placeholder）
  - Full Demo 模式：填写 `VITE_SPATIUS_APP_ID` 和 `VITE_SPATIUS_AVATAR_ID`
- [ ] 确认 `.env` 文件没有被 git 追踪（`git status` 中不出现）
- [ ] 不在 README、docs 或代码注释中写真实 API Key、sessionToken 或 Avatar ID

## 构建检查

- [ ] `npm run build` 通过
- [ ] 仅出现 AvatarKit WASM / chunk size warning（已知非阻塞，可接受）
- [ ] 无 TypeScript 错误

## 启动检查

- [ ] `npm run dev` 两个服务正常启动
- [ ] 前端 `http://localhost:5173` 可打开，三栏布局正常
- [ ] 后端 `http://localhost:3001/health` 返回 `{"ok":true}`
- [ ] Vite dev proxy 正常（前端 `/api/*` 请求正确代理到后端）

## 冒烟测试

- [ ] 后端已启动
- [ ] `node scripts/smoke-demo-flow.mjs` 运行
- [ ] 44 项测试全部 PASS，0 FAIL

## Safe Fallback Mode 检查（无外部 Key）

适用于没有 Spatius / Volcano / LLM API Key 的情况：

- [ ] Avatar 区显示 placeholder（"A" 标记 + "Placeholder avatar is ready"）
- [ ] System Notice 显示 "Avatar fallback 可用"
- [ ] Start Interview 可正常生成题目（mock LLM 或题库）
- [ ] 可以手动输入回答
- [ ] Submit Answer → 右侧 Feedback 展示 score / coveredPoints / missingPoints / improvementTips / scoringReason
- [ ] Voice mode 显示 "文本模式 fallback" 或 "浏览器语音 fallback"
- [ ] "我不会，可以换一道吗？" → 换题，不结束
- [ ] "我们能不能先聊薪资？" → 拉回技术，不结束
- [ ] 三轮后 status=ended / nextAllowed=false / reportReady=true
- [ ] End Interview → Final Report 正常展示
- [ ] Reset Demo → 状态完全清空，可重新开始
- [ ] 整个流程不报错、不崩溃

## Full Demo Mode 检查（有完整 Key 和额度）

在 Safe Fallback 基础上，额外检查：

- [ ] 点击 Connect Avatar → Avatar 加载成功，显示 "Avatar Connected"
- [ ] Spatius Token state 显示 "Direct Ready"
- [ ] 点击 Send Sample Audio → 数字人口型同步播放官方示例音频
- [ ] Start Interview → 面试官提问文字出现在对话区 + 数字人口型同步播报 TTS 音频
- [ ] Voice mode 显示 "Avatar TTS Lip-Sync"
- [ ] 开始语音回答 → 麦克风录音正常
- [ ] 停止录音 → partial / final transcript 回填到回答框
- [ ] ASR mode 显示 "Volcano Streaming Ready" 或 "Streaming ASR Ready"
- [ ] 不出现双声音（Avatar TTS 和 Browser Speech 不同时播放）

## Flow Edge Cases

- [ ] 候选人说"不会"或"没做过"：Ava 温和降难度或换角度，不结束面试
- [ ] 候选人说"可以换一道吗"：Ava 换相关但更基础的问题，不结束面试
- [ ] 候选人问薪资/福利/流程：Ava 简短回应并拉回技术面试，不结束
- [ ] 第三轮后：不再生成新题，只引导查看报告
- [ ] Ended 后再次 Submit：返回 no-op，提示 Reset
- [ ] Report 生成后：只能查看报告或 Reset Demo

## Scoring Check

- [ ] 分数始终显示为 0-100
- [ ] 不出现 `8 / 100` 等量纲错误
- [ ] 完整回答覆盖多个 expectedPoints 时，分数合理偏高
- [ ] "不会"类简短回答分数受限（≤55），但反馈语气友好
- [ ] scoringReason 解释自然（不出现"LLM 基础分""覆盖度校准分""加权""公式"等内部术语）
- [ ] feedbackSummary 不使用机械统计句式（不出现"已覆盖 X 个，遗漏 X 个"）

## UI Stability

- [ ] 三栏布局不重叠、不横向滚动
- [ ] Submit / End / Reset 按钮状态与面试流程一致
- [ ] End 后 Submit 按钮和语音按钮同时禁用
- [ ] 面试配置（岗位/来源/难度/知识点）在面试运行中锁定
- [ ] Reset Demo 后所有状态回归 idle

## Known Warnings

- AvatarKit WASM warning：已知非阻塞，可接受
- Chunk size warning：AvatarKit SDK 体积导致，已知非阻塞
- LF/CRLF warning（Windows）：换行符自动转换，无害
- 只要 `npm run build` 通过即可
