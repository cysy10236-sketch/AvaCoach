# AvaCoach Demo Script

## 现场启动

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

如果现场只出现 AvatarKit WASM / chunk size warning，可以说明这是已知非阻塞 warning，build 通过且 demo 可运行。

## 2-4 分钟演示顺序

1. 打开页面，介绍 AvaCoach 是中文 IT 数字人模拟面试训练系统。
2. 说明 Spatius 是 avatar rendering / lip-sync layer，不是 LLM，也不是 TTS。
3. 点击 Connect Avatar，等待 Avatar Connected。
4. 点击 Send Sample Audio，说明这是官方 SDK 验证音频，用来证明 AvatarKit `controller.send()` 能驱动口型。
5. 选择 IT 题库 / Frontend / React / 中等。
6. 点击 Start Interview。
7. 展示数字人用中文提问和口型同步。
8. 说明当前面试官回复来自 LLM 或题库逻辑，语音来自 Volcano TTS，口型由 Spatius AvatarKit 驱动。
9. 点击开始语音回答，说一段中文回答。
10. 展示 Volcano Streaming ASR partial / final transcript 实时回填到回答框。
11. 手动编辑回答，说明系统不会自动提交，候选人始终有确认权。
12. 点击 Submit Answer。
13. 展示右侧 score、coveredPoints、missingPoints、improvementTips、scoringReason。
14. 第二轮可以演示：“我不会，可以换一道吗？”
15. Ava 会温和换一个相关问题或降低角度，不会强行结束。
16. 也可以演示候选人问薪资/福利，Ava 会简短回应并拉回技术面试。
17. 完成三轮后，系统提示生成最终报告。
18. 点击 End Interview，展示 Final Report。
19. 说明 ended 后不会继续生成新问题，只能查看报告或 Reset Demo。
20. 点击 Reset Demo，展示状态清空。

## 面试官讲解话术

可以这样介绍：

> AvaCoach 不是一个简单聊天机器人，而是一个完整中文 IT 面试训练闭环。前端负责数字人、对话、ASR 录音和反馈展示；后端负责 LLM、TTS、ASR proxy、Spatius Session Token、题库评分和面试状态机。所有敏感 key 都只在后端。

可以这样解释 Spatius：

> Spatius 在这里负责数字人渲染和口型同步。LLM 负责生成问题和反馈，Volcano TTS 负责生成 16k PCM 音频，AvatarKit 接收 PCM 后驱动数字人的嘴型。

可以这样解释状态机：

> 最新一轮修复后，面试状态由后端 session 控制。三轮后后端会返回 ended、nextAllowed=false、reportReady=true。即使前端再次提交，后端也不会再生成下一题。

可以这样解释评分：

> 题库模式不是只让模型主观打分。每道题都有 expectedPoints，系统会判断回答覆盖了哪些点、缺了哪些点，再用 scoringReason 解释分数来源。

## 推荐演示回答

Frontend / React / medium:

> 我在一个后台系统里做过 React 性能优化。当时列表页有大量筛选条件和表格渲染，首屏和交互都有卡顿。我先用 React Profiler 和浏览器 Performance 定位重渲染来源，然后把表格行组件拆分，用 memo 控制重复渲染，把筛选计算放到 useMemo，并对接口结果做分页和缓存。上线后首屏耗时大概降低了 30%，用户操作卡顿明显减少。

换题演示：

> 这个点我不太熟，可以换一道相关但更基础的题吗？

薪资/流程演示：

> 这个岗位薪资和福利怎么样？

## 重点展示点

- 真实 Avatar 可连接。
- 官方 sample PCM 可验证 SDK。
- Volcano TTS 可驱动 Avatar lip-sync。
- Volcano Streaming ASR 可实时回填回答。
- Submit Answer 后只生成一个自然追问。
- ended 后不会继续追问。
- 评分是 0-100，并有 expectedPoints 解释。
- fallback 保证 demo 稳定。

## Fallback 解释

如果现场某个外部服务不可用：

- AvatarKit 不可用：使用 placeholder / text mode。
- TTS 不可用：browser speech 或 silent text mode。
- ASR 不可用：browser ASR 或手动输入。
- LLM 不可用：mock provider。
- Spatius token 不可用：fallback demo still usable。

核心话术：

> Fallback 是为了保证演示稳定性。即使某个外部 provider 失败，完整面试流程仍然可以展示。
