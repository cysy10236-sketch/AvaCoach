# AvaCoach Demo Script

## 现场启动

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

如果出现 AvatarKit WASM / chunk size warning，可以说明这是已知非阻塞 warning，`npm run build` 通过即可。

## 1-2 分钟项目介绍

AvaCoach 是一个中文 AI 数字人模拟面试训练系统。它不是普通聊天机器人，而是把 LLM、数字人 Avatar、TTS、ASR 和面试反馈组合成一条完整链路：LLM 生成问题，火山 TTS 生成中文语音，Spatius AvatarKit 驱动数字人口型，候选人语音回答通过火山 ASR 转文字，再由 LLM 评估回答并生成追问、评分依据和最终报告。

## 标准演示顺序

1. 打开页面，介绍三栏 SaaS 工作台。
2. 点击 `Connect Avatar`。
3. 等待 Avatar Connected。
4. 可点击 `Send Sample Audio`，说明这是官方 PCM 验证音频，只用于验证 SDK lip-sync。
5. 选择岗位和 Topic，例如 `AI Engineer` + `Vector Database`。
6. 点击 `Start Interview`。
7. 说明：当前第一题由 LLM 根据岗位和 Topic 生成，不再机械使用固定题库。
8. 等数字人播报完问题。
9. 点击开始语音回答，口述一段中文回答。
10. 停止录音，展示 ASR transcript 回填。
11. 手动微调回答，强调用户确认后才提交。
12. 点击 `Submit Answer`。
13. 展示右侧综合评价、评分依据和改进建议。
14. 展示 Ava 根据回答自然追问，而不是固定下一题。
15. 完成多轮后点击 `End Interview`。
16. 展示 Final Report。
17. 最后说明 fallback：任一外部 provider 失败，文字面试主流程仍然可用。

## 如何解释题库

可以这样说：

> 早期版本把题库直接暴露在 UI 里，每轮都展示覆盖点和缺失点。这样便于验证评分，但实际面试体验会显得机械。所以现在主流程改成 LLM 动态面试，题库保留为底层结构化知识资产。它仍然有大约 110 道中文 IT 题和 expectedPoints，可以用于未来 evaluator、企业 JD 题库和离线测试，但不再干扰当前 demo 的自然对话体验。

## 如何解释 Spatius

可以这样说：

> Spatius 负责 avatar rendering 和 lip-sync，不负责生成问题。问题和反馈来自 LLM，声音来自 Volcano TTS，AvatarKit 接收 16k PCM 后驱动数字人的口型。

## 如何解释 fallback

可以这样说：

> Fallback 是为了保证现场演示稳定。比如 Avatar 额度不够时可以显示 placeholder，TTS 失败时仍显示文字，ASR 失败时仍可手动输入，LLM 失败时走 mock provider。核心面试闭环不会因为单个外部服务失败而崩掉。

## 推荐测试回答

Vector Database:

> 向量数据库相比普通数据库存数组，核心价值在于高维相似度检索和工程化能力。它通常会内置 ANN 索引，比如 HNSW 或 IVF，避免全量暴力计算；也支持 metadata filter 和向量相似度组合查询，适合 RAG 场景。同时它会考虑向量压缩、分片、增量索引和多租户隔离，这些都是普通数据库自己存数组时需要额外实现的。

HTTP / Network:

> CORS 是浏览器同源策略下的跨域访问控制机制。预检请求一般在非简单请求时触发，比如 PUT、DELETE、application/json 或自定义 Header。排查时我会先看 OPTIONS 是否返回正确，再对比真实请求是否也带 Access-Control-Allow-Origin、Allow-Credentials、Allow-Headers，同时检查网关、异常响应和缓存配置。

## 面试官可能追问

**为什么不用题库固定问？**

因为真实面试不是背题。题库适合作为结构化知识资产和评测参考，但现场互动更需要根据候选人的回答动态推进。当前版本把题库保留在底层，主流程用 LLM 做自然追问。

**项目高级性体现在哪里？**

不是单点接 API，而是完整 provider 架构：LLM、TTS、ASR、Avatar、Token、安全边界、fallback、状态机和报告都拆开了。任何一层替换或失败，都不会拖垮整个 demo。

**下一步怎么增强？**

把题库升级成 evaluator/rubric 层，让 LLM 的自然反馈和题库的结构化评测做校准；再加入用户历史、练习计划和 JD 定制题库。
