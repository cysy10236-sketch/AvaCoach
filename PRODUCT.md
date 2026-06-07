# Product

## Register

AvaCoach — AI Digital Human Mock Interview Training System

## Users

AvaCoach 面向面试练习场景中的候选人用户。用户通过桌面浏览器打开系统，连接数字人面试官，选择岗位和题目来源，用语音或文字回答面试问题，查看评分反馈和最终报告。主要使用场景是 Demo 演示和技术展示。

## Product Purpose

AvaCoach 展示一个完整的 AI 数字人面试教练 Demo。它将数字人渲染与口型同步、实时语音识别、LLM 追问评分、结构化题库结合为一个可用产品。成功标准是 Demo 稳定、专业、易于演示讲解。

## Brand Personality

专业、沉稳、技术可信。界面应呈现精炼的 SaaS 工作台风格（面试训练系统），而非休闲聊天页或营销 landing page。

## Anti-References

避免暗黑科幻仪表盘、花哨渐变、拥挤聊天 UI、隐藏关键操作按钮、布局不稳、内容变化时页面跳动。

## Design Principles

1. **面试流程清晰可见** — 配置区、数字人区、对话区、回答输入区、反馈区各有稳定位置
2. **关键操作易于发现** — Start Interview 和 Submit Answer 始终显眼
3. **Fallback 是设计特性** — 状态徽章提供信息，不制造警报感
4. **Demo 稳定性优先** — 内容在面板内滚动，不用 resize 整个页面
5. **技术可信度** — 克制配色、清晰层级、精准标签、可靠交互状态

## Current Capabilities (已实现)

- Spatius AvatarKit Direct Mode 数字人渲染 + 口型同步
- Volcano TTS 16kHz PCM16 驱动 AvatarKit
- Volcano Streaming ASR 实时语音识别
- DeepSeek / OpenAI / Mock LLM provider
- 110 道中文 IT 面试题库 + 知识点评分
- 结构化反馈 + 最终报告
- Fallback 全覆盖（Avatar / TTS / ASR / LLM）
- 三栏 SaaS 工作台 UI
- 语音 + 文字双输入

## Accessibility & Inclusion

使用可读对比度、可见焦点态、键盘可操作控件、减少动画偏好支持。中文 UI 为主，技术术语可保留英文。
