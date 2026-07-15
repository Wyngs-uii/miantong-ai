import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function fetchBuilt(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Miantong AI product page", async () => {
  const response = await fetchBuilt();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>面通 AI｜大学生简历助手<\/title>/);
  assert.match(html, /把真实经历，写成一份/);
  assert.match(html, /AI 只优化你确认过的信息/);
  assert.match(html, /A4 · ATS 单栏/);
  assert.match(html, /class="brand-mark">面<\/span>/);
  assert.match(html, /icon-32\.png\?v=5/);
  assert.match(html, /apple-touch-icon\.png\?v=5/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("the analysis API returns traceable facts and an explainable score", async () => {
  const response = await fetchBuilt("/api/analyze-experience", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetRole: "AI 产品实习生",
      jobDescription: "负责需求分析和产品迭代",
      experienceType: "project",
      rawDescription: "我设计了一个帮助大学生整理项目经历的简历工具。",
    }),
  });

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.facts[0].status, "confirmed");
  assert.equal(result.facts[0].sourceText, result.facts[0].content);
  assert.ok(result.followUpQuestions.length <= 4);
  assert.equal(typeof result.jobAnalysis.score, "number");
  assert.equal(result.safety.inventedFactsDetected, false);
});

test("the analysis API rejects an empty experience", async () => {
  const response = await fetchBuilt("/api/analyze-experience", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetRole: "产品实习生", experienceType: "project", rawDescription: "" }),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /请先描述/);
});

test("AI provider status exposes three switchable providers without keys", async () => {
  const response = await fetchBuilt("/api/ai-status");
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(status.selectedProvider, "deepseek");
  assert.deepEqual(status.providers.map((provider) => provider.id), ["deepseek", "openai", "gemini"]);
  assert.ok(status.providers.every((provider) => provider.configured === false));
  assert.ok(status.providers.every((provider) => provider.apiKeyHint === null));
  assert.equal(Object.hasOwn(status.providers[0], "apiKey"), false);
});

test("model settings rejects missing keys and can clear browser storage", async () => {
  const missing = await fetchBuilt("/api/model-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "deepseek" }),
  });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /请输入 DeepSeek API Key/);

  const removed = await fetchBuilt("/api/model-settings", {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "deepseek" }),
  });
  assert.equal(removed.status, 200);
  assert.match(removed.headers.get("set-cookie") ?? "", /shili_ai_key_deepseek=;.*HttpOnly.*SameSite=Strict.*Max-Age=0/i);
});

test("print, local draft, and provider switching behaviors remain wired", async () => {
  const [client, css, providerSource, prompts] = await Promise.all([
    readFile(new URL("../app/resume-builder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/prompts.ts", import.meta.url), "utf8"),
  ]);

  assert.match(client, /window\.localStorage\.setItem/);
  assert.match(client, /window\.localStorage\.removeItem/);
  assert.match(client, /window\.print\(\)/);
  assert.match(client, /exportJpg/);
  assert.match(client, /exportWord/);
  assert.match(client, /image\/jpeg/);
  assert.match(client, /wordprocessingml\.document/);
  assert.match(client, /createZip/);
  assert.match(client, /2480/);
  assert.match(client, /导出简历/);
  assert.match(client, /fetch\("\/api\/analyze-experience"/);
  assert.match(client, /模型设置/);
  assert.match(providerSource, /DeepSeek/);
  assert.match(providerSource, /OpenAI/);
  assert.match(providerSource, /Gemini/);
  assert.match(prompts, /动作动词 \+ 具体对象\/问题 \+ 方法或工具 \+ 可验证结果/);
  assert.match(prompts, /参与\/协助不能改写为主导\/牵头/);
  assert.match(prompts, /禁用空泛“大厂黑话”/);
  assert.match(client, /保存、检测并切换/);
  assert.match(client, /检测并切换/);
  assert.match(client, /删除 Key/);
  assert.match(client, /followUpAnswers/);
  assert.match(client, /activeFollowUpAnswers/);
  assert.match(client, /requestAnalysis\(experienceId/);
  assert.match(client, /mergeResumeBullets\(item\.bullets, result\.resumeBullets\)/);
  assert.match(client, /for \(const candidate of \[\.\.\.existing, \.\.\.incoming\]/);
  assert.match(client, /return merged\.slice\(0, 8\)/);
  assert.match(client, /mergeAnalysisResult\(current\[experienceId\], result\)/);
  assert.match(client, /bullets: mergeResumeBullets\(\[\], experience\.bullets \|\| \[\]\)/);
  assert.match(client, /bulletSimilarity\(item, candidate\) >= 0\.52/);
  assert.match(client, /ANALYSIS_STORAGE_KEY/);
  assert.match(client, /analyzedExperiences/);
  assert.match(client, /existingBullets/);
  assert.match(client, /EXPERIENCE_TYPE_API\[experienceType\]/);
  assert.match(client, /confirmedDetails/);
  assert.match(client, /用户此前补充确认的信息/);
  assert.match(client, /generated-experience-tabs/);
  assert.match(client, /已完善要点/);
  assert.match(client, /用户补充确认的信息/);
  assert.match(client, /使用补充信息重新生成/);
  assert.match(client, /addExperience/);
  assert.match(client, /removeExperience/);
  assert.match(client, /添加经历/);
  assert.match(client, /修改意见/);
  assert.match(client, /addInternshipExperience/);
  assert.match(client, /添加实习经历/);
  assert.match(client, /全部经历关键词覆盖/);
  assert.match(client, /matchSummary/);
  assert.match(client, /semanticKeywordMatch/);
  assert.match(client, /KEYWORD_CONCEPTS/);
  assert.match(client, /用户访谈/);
  assert.match(client, /版本优化/);
  assert.match(client, /suggestedRoles/);
  assert.match(client, /AI 推荐职责词/);
  assert.match(client, /保存修改/);
  assert.match(client, /添加一条要点/);
  assert.match(client, /删除要点/);
  assert.match(client, /type="month"/);
  assert.match(client, /updateExperienceMonth/);
  assert.match(client, /开始年月/);
  assert.match(client, /结束年月/);
  assert.match(client, /className="experience-meta"/);
  assert.match(css, /\.experience-meta\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.month-range\{[^}]*grid-template-columns:minmax\(0,1fr\) 18px minmax\(0,1fr\)/);
  assert.match(client, /选择照片/);
  assert.match(client, /工作室证件照/);
  assert.match(client, /function getContactLine/);
  assert.match(client, /const contactLine = getContactLine\(draft\)/);
  assert.match(client, /contactLine \? para\(contactLine\) : ""/);
  assert.match(client, /if \(contactLine\) drawText\(contactLine/);
  assert.match(client, /\{contactLine && <p>\{contactLine\}<\/p>\}/);
  const photoStudio = await readFile(new URL("../app/photo-studio.tsx", import.meta.url), "utf8");
  assert.match(photoStudio, /ImageSegmenter/);
  assert.match(photoStudio, /outputCategoryMask: true/);
  assert.match(photoStudio, /categories\[index\] === 0 \? 0 : 255/);
  assert.match(photoStudio, /照片仅在当前设备处理/);
  assert.match(photoStudio, /白色/);
  assert.match(photoStudio, /蓝色/);
  assert.match(client, /项目 \/ 实训经历/);
  assert.match(client, /校园经历 \/ 证书/);
  assert.match(css, /@media print/);
  assert.match(css, /size:A4/);
  assert.match(css, /padding:11\.5mm 14\.5mm 11mm!important/);
  assert.match(css, /font-size:8\.2pt!important/);
  assert.match(css, /list-style:disc outside!important/);
  assert.match(css, /\.resume-header\{[^}]*border:0/);
});

test("AI role suggestions can be toggled on and off", async () => {
  const source = await readFile(new URL("../app/resume-builder.tsx", import.meta.url), "utf8");
  assert.match(source, /function toggleRoleKeyword/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /再次点击可取消/);
  assert.doesNotMatch(source, /onClick=\{\(\) => updateExperience\(\{ role: mergeRoleKeywords\(activeExperience\.role, \[role\]\) \}\)\}/);
});
