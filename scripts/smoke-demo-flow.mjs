#!/usr/bin/env node

/**
 * AvaCoach — Smoke Demo Flow Test
 *
 * 用途:
 *   验证 interview 核心通路在不依赖真实 Avatar / TTS / ASR 的情况下仍然稳定。
 *
 * 测试项:
 *   1. Server health
 *   2. Spatius session-token fallback
 *   3. TTS fallback
 *   4. Interview start (bank mode)
 *   5. Interview next — normal answer
 *   6. Interview next — change question
 *   7. Interview next — salary redirect
 *   8. Three-round → ended
 *   9. Ended next no-op
 *   10. Final report
 *
 * 运行方式:
 *   node scripts/smoke-demo-flow.mjs
 *   node scripts/smoke-demo-flow.mjs --url http://localhost:3001
 *
 * 安全设计:
 *   - 不读取任何 .env 或 API key
 *   - 不连接真实 Spatius / Volcano
 *   - 仅验证 interview flow / question bank / scoring / report
 *   - 输出 PASS / FAIL
 */

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const BASE_URL = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3001";

const TIMEOUT_MS = 60_000;
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const SKIP = "\x1b[33mSKIP\x1b[0m";

const results = [];

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

async function post(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    // TTS may return binary PCM audio, not JSON
    if (contentType.includes("application/json") || !contentType.includes("audio/")) {
      const data = await response.json();
      return { status: response.status, data };
    }
    return { status: response.status, data: null, binary: true, contentType };
  } catch (error) {
    return { status: 0, data: null, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function get(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
    });
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, data: null, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

function record(name, passed, detail = "") {
  const marker = passed ? PASS : FAIL;
  console.log(`  ${marker}  ${name}${detail ? ` — ${detail}` : ""}`);
  results.push({ name, passed, detail });
}

function summarize() {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${total} total`);
  console.log(`${"=".repeat(60)}`);
  if (failed > 0) {
    console.log(`\n  Failed tests:`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`    ✗ ${r.name} — ${r.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

async function testHealth() {
  console.log("\n1. Health Check");
  const { status, data, error } = await get("/health");
  record("Server responds", status === 200 && data?.ok === true, error);
}

async function testSpatiusToken() {
  console.log("\n2. Spatius Session Token");
  const { status, data, error } = await get("/api/spatius/session-token");

  if (error) {
    record("Spatius endpoint reachable", false, error);
    return;
  }

  // 不管真实额度如何，不应该崩溃，应该返回 fallback 或真实 token
  const hasValidResponse =
    data !== null &&
    (data.fallback === true || typeof data.sessionToken === "string");

  record("Returns safe response (no crash)", hasValidResponse);
  record(
    "Has fallback field",
    typeof data?.fallback === "boolean",
    `fallback=${data?.fallback}`,
  );
  record(
    "No raw API key in response",
    !JSON.stringify(data).includes("sk-"),
  );
}

async function testTts() {
  console.log("\n3. TTS Endpoint");
  const { status, data, error, binary } = await post("/api/tts", {
    text: "你好，我是 AvaCoach。",
  });

  if (error) {
    record("TTS endpoint reachable", false, error);
    return;
  }

  // TTS 可能返回 PCM audio 或 fallback JSON，两种都算通过
  const isFallbackJson = data?.fallback === true;
  const isBinaryAudio = binary === true;

  record(
    "Returns valid response (PCM or fallback JSON)",
    isFallbackJson || isBinaryAudio || (status === 200 && data !== null),
    isFallbackJson ? "fallback JSON mode" : isBinaryAudio ? "PCM audio (binary)" : "other",
  );

  if (isFallbackJson) {
    record(
      "Fallback has source field",
      typeof data?.source === "string",
      `source=${data?.source}`,
    );
  }
}

async function testInterviewStart() {
  console.log("\n4. Interview Start (Bank Mode)");
  const { status, data, error } = await post("/api/interview/start", {
    role: "frontend",
    questionSource: "bank",
    difficulty: "medium",
    topic: "React",
    sessionId: "smoke-test-session",
  });

  if (error) {
    record("Start endpoint reachable", false, error);
    return false;
  }

  record("Returns HTTP 200", status === 200);
  record("status in_progress", data?.status === "in_progress");
  record("nextAllowed true", data?.nextAllowed === true);
  record("Has question text", typeof data?.question === "string" && data.question.length > 0);
  record("Has questionMeta", data?.questionMeta !== undefined && data?.questionMeta !== null);
  record("Source is bank", data?.source === "bank");
  record("Has replyText", typeof data?.replyText === "string" && data.replyText.length > 0);

  return data;
}

async function testInterviewNextNormal(startData) {
  console.log("\n5. Interview Next — Normal Answer");
  const questionMeta = startData?.questionMeta;
  const question = startData?.question ?? "";

  if (!questionMeta) {
    record("Has questionMeta from start", false, "Skipping next tests");
    return null;
  }

  const { status, data, error } = await post("/api/interview/next", {
    role: "frontend",
    answer:
      "React Context 适合全局主题、用户认证状态等跨组件传递的场景。但在频繁更新时会导致所有消费者重渲染，需要通过拆分 Context 或搭配 useMemo 来优化性能。",
    history: [
      { speaker: "interviewer", text: question },
    ],
    sessionId: "smoke-test-session",
    questionMeta,
  });

  if (error) {
    record("Next endpoint reachable", false, error);
    return null;
  }

  record("Returns HTTP 200", status === 200);
  record("Has score 0-100", typeof data?.score === "number" && data.score >= 0 && data.score <= 100, `score=${data?.score}`);
  record("Has feedback", typeof data?.feedback === "string" && data.feedback.length > 0);
  record("Has coveredPoints", Array.isArray(data?.coveredPoints));
  record("Has missingPoints", Array.isArray(data?.missingPoints));
  record("Has improvementTips", Array.isArray(data?.improvementTips));
  record("Has scoringReason", typeof data?.scoringReason === "string");
  record("status not ended", data?.status !== "ended");
  record("nextAllowed true", data?.nextAllowed === true);
  record("shouldEnd false", data?.shouldEnd === false);
  record("Has nextQuestion", typeof data?.nextQuestion === "string" && data.nextQuestion.length > 0);

  return data;
}

async function testInterviewNextChangeQuestion(startData) {
  console.log("\n6. Interview Next — Change Question");
  const questionMeta = startData?.questionMeta;
  const question = startData?.question ?? "";

  if (!questionMeta) {
    record("Has questionMeta", false, "Skipping");
    return;
  }

  const { data, error } = await post("/api/interview/next", {
    role: "frontend",
    answer: "我不会，可以换一道吗？",
    history: [
      { speaker: "interviewer", text: question },
    ],
    sessionId: "smoke-test-session-change",
    questionMeta,
  });

  if (error) {
    record("Change question — no crash", false, error);
    return;
  }

  record("Status not ended", data?.status !== "ended");
  record("shouldEnd false", data?.shouldEnd === false);
  record(
    "No end phrase",
    !(data?.replyText ?? "").includes("面试结束"),
  );
}

async function testInterviewNextSalary(startData) {
  console.log("\n7. Interview Next — Salary Redirect");
  const questionMeta = startData?.questionMeta;
  const question = startData?.question ?? "";

  if (!questionMeta) {
    record("Has questionMeta", false, "Skipping");
    return;
  }

  const { data, error } = await post("/api/interview/next", {
    role: "frontend",
    answer: "我们能不能先聊薪资？",
    history: [
      { speaker: "interviewer", text: question },
    ],
    sessionId: "smoke-test-session-salary",
    questionMeta,
  });

  if (error) {
    record("Salary redirect — no crash", false, error);
    return;
  }

  record("Status not ended", data?.status !== "ended");
  record("shouldEnd false", data?.shouldEnd === false);
  record(
    "Redirects back to tech",
    /薪资|福利|HR|后续/.test(data?.replyText ?? ""),
    data?.replyText?.slice(0, 80),
  );
}

async function testThreeRounds() {
  console.log("\n8. Three-Round → Ended");

  // Start fresh session
  const startRes = await post("/api/interview/start", {
    role: "frontend",
    questionSource: "bank",
    difficulty: "medium",
    topic: "React",
    sessionId: "smoke-test-3round",
  });

  if (!startRes.data?.questionMeta) {
    record("Start for 3-round", false, "No questionMeta");
    return;
  }

  const meta = startRes.data.questionMeta;
  const q = startRes.data.question;
  let history = [{ speaker: "interviewer", text: q }];
  const answers = [
    "Context 用于全局状态共享，但需要注意性能风险。可以通过拆分 Context 和 useMemo 来优化。",
    "在实际项目中，我们会将不同关注点的状态拆分到独立的 Context 中，避免不必要的重渲染。结合 React.memo 进一步减少渲染次数。",
    "我们遇到过主题切换导致整棵树重渲染的问题。通过将主题状态和 UI 状态拆分为两个独立的 Context，配合 useMemo 缓存 value，上线后交互延迟降低了约 40%。",
  ];

  let finalData = null;
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    const round = i + 1;
    const candidateMsg = { speaker: "candidate", text: answer };
    const nextHistory = [...history, candidateMsg];

    const { data } = await post("/api/interview/next", {
      role: "frontend",
      answer,
      history: nextHistory,
      sessionId: "smoke-test-3round",
      questionMeta: meta,
    });

    if (data?.replyText) {
      history = [...nextHistory, { speaker: "interviewer", text: data.replyText }];
    }

    if (round < 3) {
      record(
        `Round ${round} — in_progress`,
        data?.status === "in_progress" && data?.nextAllowed === true,
        `score=${data?.score}`,
      );
    } else {
      record(
        `Round ${round} — ended`,
        data?.status === "ended" && data?.nextAllowed === false,
        `score=${data?.score}`,
      );
      finalData = data;
    }
  }

  record("Round 3 reportReady true", finalData?.reportReady === true);

  return finalData;
}

async function testEndedNextNoOp() {
  console.log("\n9. Ended Next — No-Op");
  const { data, error } = await post("/api/interview/next", {
    role: "frontend",
    answer: "再答一题试试",
    history: [
      { speaker: "interviewer", text: "Q1" },
      { speaker: "candidate", text: "A1" },
      { speaker: "interviewer", text: "Q2" },
      { speaker: "candidate", text: "A2" },
      { speaker: "interviewer", text: "Q3" },
      { speaker: "candidate", text: "A3" },
    ],
    sessionId: "smoke-test-3round",
  });

  if (error) {
    record("Ended next no-op — no crash", false, error);
    return;
  }

  record("status ended", data?.status === "ended");
  record("nextAllowed false", data?.nextAllowed === false);
  record("shouldEnd true", data?.shouldEnd === true);
  record("Has message", typeof data?.message === "string" && data.message.length > 0);
}

async function testReport() {
  console.log("\n10. Final Report");

  const { status, data, error } = await post("/api/interview/report", {
    role: "frontend",
    history: [
      { speaker: "interviewer", text: "请说明 React Context 的适用场景和性能风险。" },
      { speaker: "candidate", text: "Context 适合全局状态共享，但需要注意性能风险。" },
      { speaker: "interviewer", text: "实际项目中如何优化？" },
      { speaker: "candidate", text: "拆分 Context，配合 useMemo 减少不必要的重渲染。" },
      { speaker: "interviewer", text: "举一个具体项目案例。" },
      { speaker: "candidate", text: "主题切换性能问题，拆分后延迟降低40%。" },
    ],
    sessionId: "smoke-test-3round",
    questionMetas: [
      {
        id: "frontend-react-context-013",
        role: "frontend",
        difficulty: "medium",
        topic: "React",
        expectedPoints: ["Context 适用场景", "性能风险识别", "优化方案"],
        followUps: [],
        tags: ["React", "Context"],
      },
    ],
  });

  if (error) {
    record("Report endpoint reachable", false, error);
    return;
  }

  record("Returns HTTP 200", status === 200, `status=${status}`);
  record("status ended", data?.status === "ended");
  record("nextAllowed false", data?.nextAllowed === false);
  record("reportReady true", data?.reportReady === true);
  record(
    "Has overallScore",
    typeof data?.overallScore === "number" ||
      (typeof data?.score === "number" && data.score >= 0 && data.score <= 100),
  );
  record("Has strengths", Array.isArray(data?.strengths));
  record("Has bankReport", data?.bankReport !== undefined);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  console.log(`AvaCoach Smoke Demo Flow Test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`${"=".repeat(60)}`);

  await testHealth();
  await testSpatiusToken();
  await testTts();

  const startData = await testInterviewStart();
  await testInterviewNextNormal(startData);
  await testInterviewNextChangeQuestion(startData);
  await testInterviewNextSalary(startData);
  await testThreeRounds();
  await testEndedNextNoOp();
  await testReport();

  summarize();
}

main().catch((error) => {
  console.error("Smoke test crashed:", error.message);
  process.exit(1);
});
