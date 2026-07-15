"use client";
/* User-selected data URLs need native img elements for immediate local preview and printing. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import PhotoStudio from "./photo-studio";

type ExperienceDraft = {
  id: string;
  type: "项目" | "实习" | "校园" | "竞赛";
  title: string;
  role: string;
  dateRange: string;
  rawDescription: string;
  bullets: string[];
  confirmedDetails: string[];
};

type ResumeDraft = {
  name: string;
  phone: string;
  email: string;
  school: string;
  major: string;
  graduationDate: string;
  availability: string;
  wechat: string;
  photoDataUrl: string;
  courses: string;
  educationSummary: string;
  selfSummary: string;
  skills: string;
  campusTitle: string;
  campusDate: string;
  campusDescription: string;
  certificates: string;
  targetRole: string;
  jobDescription: string;
  experiences: ExperienceDraft[];
};

type ProviderId = "deepseek" | "openai" | "gemini";
type ProviderStatus = { id: ProviderId; label: string; model: string; models: string[]; configured: boolean; apiKeyHint: string | null; source?: string | null };
type AIStatus = { selectedProvider: ProviderId; active: ProviderStatus; providers: ProviderStatus[] };
type AnalysisResult = {
  facts: Array<{ id: string; category: string; content: string; status: string }>;
  followUpQuestions: string[];
  suggestedRoles: string[];
  resumeBullets: string[];
  jobAnalysis?: {
    score?: number;
    coveredKeywords: string[];
    missingKeywords: string[];
    suggestions: string[];
    scoreBreakdown?: Record<string, number>;
  };
};

const initialDraft: ResumeDraft = {
  name: "林晓雨",
  phone: "138 0000 0000",
  email: "xiaoyu@example.com",
  school: "华南理工大学",
  major: "信息管理与信息系统 · 本科 · 2023—2027",
  graduationDate: "2027 年 6 月",
  availability: "可立即到岗",
  wechat: "xiaoyu_resume",
  photoDataUrl: "",
  courses: "产品设计、数据分析、程序设计、用户研究",
  educationSummary: "具备技术理解、信息检索和数据敏感度，能够快速熟悉新工具与业务场景。",
  selfSummary: "关注 AI 产品与效率工具，能够从用户需求、内容结构和使用流程角度拆解问题。",
  skills: "AI 工具：ChatGPT、Codex、Gemini；产品：需求分析、流程设计、原型与验证；办公：Word、Excel、PPT",
  campusTitle: "学院学生会 · 项目成员",
  campusDate: "2024.10—2025.11",
  campusDescription: "协助组织学院活动、人员协调、通知传达与现场执行。",
  certificates: "大学英语四级、计算机二级",
  targetRole: "AI 产品实习生",
  jobDescription: "负责 AI 产品需求分析、功能设计、用户反馈整理与产品迭代。",
  experiences: [
    { id: "exp-1", type: "项目", title: "AI 大学生简历生成与岗位匹配工具", role: "产品构思 / AI 工具搭建 / 内容优化", dateRange: "2026.5—2026.6",
      rawDescription: "我用 ChatGPT、Codex 和 Gemini 做了一个给大学生用的简历生成器，梳理需求并设计了填写、生成和修改流程。", confirmedDetails: [],
      bullets: ["面向缺少实习经历的大学生梳理求职痛点，聚焦经历挖掘困难、表达不专业及岗位匹配度低等问题。", "设计求职目标、经历采集、AI 提炼、岗位匹配与在线编辑的核心流程，降低用户整理简历的输入成本。"] },
    { id: "exp-2", type: "校园", title: "校园活动内容传播项目", role: "活动策划 / 内容运营 / 现场执行", dateRange: "2024.4—2025.4",
      rawDescription: "参与组织多场校园活动，负责流程协调、物料对接、内容制作和现场执行。", confirmedDetails: [],
      bullets: ["参与组织多场校园活动，协助完成流程协调、人员沟通、物料对接与现场执行。", "围绕活动主题制作传播内容并整理反馈，为后续活动复盘提供信息。"] },
  ],
};

const STORAGE_KEY = "shili-ai-draft-v1";
const ANALYSIS_STORAGE_KEY = "shili-ai-analysis-v1";
const JD_KEYWORDS = ["需求分析", "用户调研", "用户反馈", "功能设计", "产品设计", "产品迭代", "原型设计", "项目管理", "数据分析", "数据验证", "竞品分析", "内容运营", "内容策划", "活动策划", "活动运营", "社群运营", "用户运营", "沟通协调", "跨部门协作", "流程优化", "复盘", "文案", "新媒体", "短视频", "公众号", "小红书", "B站", "Excel", "Python", "SQL", "Figma", "Axure", "ChatGPT", "DeepSeek", "Gemini"];
const KEYWORD_CONCEPTS: Array<{ label: string; aliases: string[] }> = [
  { label: "需求分析", aliases: ["需求分析", "需求梳理", "需求拆解", "需求调研", "用户需求", "痛点分析", "业务需求"] },
  { label: "用户调研", aliases: ["用户调研", "用户研究", "用户访谈", "问卷调查", "可用性测试", "焦点小组"] },
  { label: "用户反馈", aliases: ["用户反馈", "意见收集", "反馈整理", "客诉分析", "问题收集", "用户建议"] },
  { label: "功能设计", aliases: ["功能设计", "功能规划", "模块设计", "产品方案", "流程设计", "交互设计", "信息架构"] },
  { label: "产品迭代", aliases: ["产品迭代", "版本迭代", "版本优化", "持续优化", "迭代改进", "根据反馈修改", "功能优化"] },
  { label: "原型设计", aliases: ["原型设计", "交互原型", "页面原型", "线框图", "Figma", "Axure"] },
  { label: "项目管理", aliases: ["项目管理", "项目推进", "进度管理", "任务排期", "资源协调", "项目交付"] },
  { label: "数据分析", aliases: ["数据分析", "数据统计", "指标分析", "效果分析", "数据洞察", "数据复盘"] },
  { label: "数据验证", aliases: ["数据验证", "效果验证", "A/B测试", "AB测试", "指标验证", "测试验证"] },
  { label: "竞品分析", aliases: ["竞品分析", "竞品调研", "竞对分析", "产品对比", "市场调研"] },
  { label: "内容运营", aliases: ["内容运营", "内容策划", "选题策划", "文案编辑", "内容发布", "账号运营"] },
  { label: "活动运营", aliases: ["活动运营", "活动策划", "活动执行", "现场执行", "活动复盘", "物料对接"] },
  { label: "用户运营", aliases: ["用户运营", "用户增长", "用户激活", "用户维护", "用户留存", "拉新"] },
  { label: "社群运营", aliases: ["社群运营", "社群维护", "群运营", "粉丝群", "社区运营"] },
  { label: "沟通协调", aliases: ["沟通协调", "跨部门协作", "跨团队协作", "协同推进", "对接协调", "人员协调"] },
  { label: "流程优化", aliases: ["流程优化", "流程改进", "效率优化", "环节简化", "操作优化"] },
  { label: "复盘", aliases: ["复盘", "经验总结", "问题回顾", "项目总结", "活动总结"] },
];
const EXPERIENCE_TYPE_API = { 项目: "project", 实习: "internship", 校园: "campus", 竞赛: "competition" } as const;

const emptyDraft: ResumeDraft = {
  name: "",
  phone: "",
  email: "",
  school: "",
  major: "",
  graduationDate: "",
  availability: "",
  wechat: "",
  photoDataUrl: "",
  courses: "",
  educationSummary: "",
  selfSummary: "",
  skills: "",
  campusTitle: "",
  campusDate: "",
  campusDescription: "",
  certificates: "",
  targetRole: "",
  jobDescription: "",
  experiences: [],
};

const steps = ["求职目标", "基础信息", "经历采集", "修改意见", "生成简历"];

const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const textBytes = (value: string) => new TextEncoder().encode(value);

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: Array<{ name: string; data: Uint8Array }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const write16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const write32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
  for (const file of files) {
    const name = textBytes(file.name);
    const checksum = crc32(file.data);
    const local = new Uint8Array(30 + name.length + file.data.length);
    const lv = new DataView(local.buffer);
    write32(lv, 0, 0x04034b50); write16(lv, 4, 20); write16(lv, 6, 0x0800); write16(lv, 8, 0);
    write32(lv, 14, checksum); write32(lv, 18, file.data.length); write32(lv, 22, file.data.length); write16(lv, 26, name.length);
    local.set(name, 30); local.set(file.data, 30 + name.length); localParts.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    write32(cv, 0, 0x02014b50); write16(cv, 4, 20); write16(cv, 6, 20); write16(cv, 8, 0x0800);
    write32(cv, 16, checksum); write32(cv, 20, file.data.length); write32(cv, 24, file.data.length); write16(cv, 28, name.length); write32(cv, 42, offset);
    central.set(name, 46); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  write32(ev, 0, 0x06054b50); write16(ev, 8, files.length); write16(ev, 10, files.length); write32(ev, 12, centralSize); write32(ev, 16, offset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
}

function parseMonthRange(value: string) {
  const matches = [...value.matchAll(/(\d{4})[.\-/年](\d{1,2})/g)].map((match) => `${match[1]}-${match[2].padStart(2, "0")}`);
  return { start: matches[0] || "", end: matches[1] || "" };
}

function formatMonthRange(start: string, end: string) {
  const display = (value: string) => value ? value.replace("-", ".") : "";
  if (start && end) return `${display(start)}—${display(end)}`;
  return display(start || end);
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() || "";
}

function cleanContactPiece(value: string) {
  return value
    .replace(/^(?:电话|手机|联系电话|邮箱|电子邮箱|邮件|微信|wechat|wx)\s*[:：]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getContactLine(draft: Pick<ResumeDraft, "phone" | "email" | "wechat">) {
  const sources = [draft.phone, draft.email, draft.wechat].map((item) => item.trim()).filter(Boolean);
  const combined = sources.join(" · ");
  const email = firstMatch(combined, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const wechat =
    firstMatch(combined, /(?:微信|wechat|wx)\s*[:：]?\s*([A-Za-z0-9_-]{3,})/i) ||
    (!/@/.test(draft.wechat) ? cleanContactPiece(draft.wechat) : "");
  const phoneSource = combined
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:微信|wechat|wx)\s*[:：]?\s*[A-Za-z0-9_-]{3,}/gi, "")
    .split(/[·|｜,，;；\n]/)
    .map(cleanContactPiece)
    .find((piece) => /\d{5,}/.test(piece)) || "";
  const seen = new Set<string>();
  return [
    phoneSource,
    email,
    wechat ? `微信：${wechat}` : "",
  ].filter((piece) => {
    const key = piece.replace(/\s+/g, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" · ");
}

async function photoAsJpeg(src: string) {
  if (!src) return null;
  const image = await loadImage(src);
  const canvas = document.createElement("canvas"); canvas.width = 708; canvas.height = 944;
  const context = canvas.getContext("2d"); if (!context) return null;
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale; const height = image.height * scale;
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

function normalizeDraft(value: Partial<ResumeDraft> & { projectTitle?: string; rawExperience?: string; bullets?: string[] }): ResumeDraft {
  const legacyExperience = value.projectTitle || value.rawExperience ? [{
    id: "exp-migrated", type: "项目" as const, title: value.projectTitle || "未命名经历", role: "", dateRange: "",
    rawDescription: value.rawExperience || "", bullets: value.bullets || [], confirmedDetails: [],
  }] : initialDraft.experiences;
  const experiences = (value.experiences?.length ? value.experiences : legacyExperience).map((experience) => ({
    ...experience,
    bullets: mergeResumeBullets([], experience.bullets || []),
    confirmedDetails: experience.confirmedDetails || [],
  }));
  return { ...initialDraft, ...value, experiences };
}

function normalizeBullet(value: string) {
  return value.replace(/[\s，。；、,.!?！？;：:（）()“”"'·/\\—-]/g, "").toLowerCase();
}

function bulletBigrams(value: string) {
  const normalized = normalizeBullet(value);
  const grams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) grams.add(normalized.slice(index, index + 2));
  return grams;
}

function bulletSimilarity(left: string, right: string) {
  const a = bulletBigrams(left);
  const b = bulletBigrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const gram of a) if (b.has(gram)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function mergeResumeBullets(existing: string[], incoming: string[]) {
  const merged: string[] = [];
  for (const candidate of [...existing, ...incoming].map((item) => item.trim()).filter(Boolean)) {
    const duplicateIndex = merged.findIndex((item) => normalizeBullet(item) === normalizeBullet(candidate) || bulletSimilarity(item, candidate) >= 0.52);
    if (duplicateIndex < 0) merged.push(candidate);
  }
  return merged.slice(0, 8);
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[\s、，。；：,.!?;:()（）/\\—_-]/g, "");
}

function conceptForKeyword(keyword: string) {
  const normalized = normalizeMatchText(keyword);
  return KEYWORD_CONCEPTS.find((concept) => concept.aliases.some((alias) => {
    const candidate = normalizeMatchText(alias);
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  }));
}

function canonicalKeyword(keyword: string) {
  return conceptForKeyword(keyword)?.label || keyword.trim();
}

function semanticKeywordMatch(keyword: string, source: string) {
  const normalizedSource = normalizeMatchText(source);
  const concept = conceptForKeyword(keyword);
  const aliases = concept?.aliases || [keyword];
  return aliases.some((alias) => normalizedSource.includes(normalizeMatchText(alias)));
}

function extractJdKeywords(jobDescription: string) {
  const concepts = KEYWORD_CONCEPTS.filter((concept) => concept.aliases.some((alias) => semanticKeywordMatch(alias, jobDescription))).map((concept) => concept.label);
  const exact = JD_KEYWORDS.filter((word) => semanticKeywordMatch(word, jobDescription)).map(canonicalKeyword);
  const latin = jobDescription.match(/[A-Za-z][A-Za-z0-9.+#-]{1,20}/g) || [];
  return [...new Set([...concepts, ...exact, ...latin])];
}

function mergeRoleKeywords(existing: string, suggested: string[]) {
  const current = existing.split(/[\/／、,，;；|｜]/).map((item) => item.trim()).filter(Boolean);
  return [...new Set([...current, ...suggested.map((item) => item.trim()).filter(Boolean)])].slice(0, 6).join(" / ");
}

function roleKeywords(value: string) {
  return value.split(/[\/／、,，;；|｜]/).map((item) => item.trim()).filter(Boolean);
}

function hasRoleKeyword(value: string, role: string) {
  const normalizedRole = normalizeMatchText(role);
  return roleKeywords(value).some((item) => normalizeMatchText(item) === normalizedRole);
}

function toggleRoleKeyword(value: string, role: string) {
  const normalizedRole = normalizeMatchText(role);
  const current = roleKeywords(value);
  const exists = current.some((item) => normalizeMatchText(item) === normalizedRole);
  const next = exists
    ? current.filter((item) => normalizeMatchText(item) !== normalizedRole)
    : [...current, role.trim()];
  return [...new Set(next)].slice(0, 6).join(" / ");
}

function mergeAnalysisResult(existing: AnalysisResult | undefined, incoming: AnalysisResult): AnalysisResult {
  if (!existing) return incoming;
  const facts = [...existing.facts];
  for (const fact of incoming.facts) {
    if (!facts.some((item) => normalizeMatchText(item.content) === normalizeMatchText(fact.content))) facts.push(fact);
  }
  return {
    ...incoming,
    facts,
    suggestedRoles: [...new Set([...(existing.suggestedRoles || []), ...(incoming.suggestedRoles || [])])].slice(0, 6),
    resumeBullets: mergeResumeBullets(existing.resumeBullets || [], incoming.resumeBullets || []),
  };
}

export default function ResumeBuilder() {
  const [draft, setDraft] = useState(initialDraft);
  const [activeStep, setActiveStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsProvider, setSettingsProvider] = useState<ProviderId>("deepseek");
  const [settingsModel, setSettingsModel] = useState("deepseek-v4-flash");
  const [activeExperienceId, setActiveExperienceId] = useState(initialDraft.experiences[0].id);
  const [analysisByExperience, setAnalysisByExperience] = useState<Record<string, AnalysisResult>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, Record<string, string>>>({});
  const [photoError, setPhotoError] = useState("");
  const [photoStudioOpen, setPhotoStudioOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<"jpg" | "word" | null>(null);
  const resumeRef = useRef<HTMLElement>(null);

  const activeExperience = draft.experiences.find((item) => item.id === activeExperienceId) || draft.experiences[0] || null;
  const analysis = activeExperience ? analysisByExperience[activeExperience.id] || null : null;
  const activeFollowUpAnswers = activeExperience ? followUpAnswers[activeExperience.id] || {} : {};
  const contactLine = getContactLine(draft);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const restored = normalizeDraft(JSON.parse(stored));
        setDraft(restored);
        setActiveExperienceId(restored.experiences[0]?.id || "");
        const storedAnalysis = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
        if (storedAnalysis) {
          const parsed = JSON.parse(storedAnalysis) as Record<string, AnalysisResult>;
          setAnalysisByExperience(Object.fromEntries(Object.entries(parsed).filter(([id]) => restored.experiences.some((experience) => experience.id === id))));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(ANALYSIS_STORAGE_KEY);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function refreshAIStatus() {
    return fetch("/api/ai-status", { cache: "no-store" })
      .then((response) => response.json())
      .then((status) => setAiStatus(status))
      .catch(() => setAiStatus(null));
  }

  useEffect(() => {
    refreshAIStatus();
  }, []);

  const selectedProviderStatus = aiStatus?.providers.find((item) => item.id === settingsProvider) || null;

  function chooseSettingsProvider(provider: ProviderId) {
    const status = aiStatus?.providers.find((item) => item.id === provider);
    setSettingsProvider(provider);
    setSettingsModel(status?.model || "");
    setApiKey("");
    setSettingsMessage("");
  }

  function openSettings() {
    const provider = aiStatus?.selectedProvider || "deepseek";
    const status = aiStatus?.providers.find((item) => item.id === provider);
    setSettingsProvider(provider);
    setSettingsModel(status?.model || "deepseek-v4-flash");
    setSettingsMessage("");
    setSettingsOpen(true);
  }

  async function saveAndTestKey(useExisting = false) {
    setSettingsBusy(true);
    setSettingsMessage("");
    try {
      const response = await fetch("/api/model-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: settingsProvider, model: settingsModel, apiKey: useExisting ? undefined : apiKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "检测失败。");
      setApiKey("");
      setSettingsMessage(`${selectedProviderStatus?.label || settingsProvider} 连接成功，已设为当前模型。`);
      await refreshAIStatus();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "检测失败。");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeKey() {
    setSettingsBusy(true);
    const response = await fetch("/api/model-settings", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: settingsProvider }),
    });
    setSettingsBusy(false);
    if (response.ok) {
      setApiKey("");
      setSettingsMessage("浏览器中的 Key 已删除。");
      await refreshAIStatus();
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(analysisByExperience));
  }, [analysisByExperience]);

  const coveredKeywords = useMemo(() => {
    return extractJdKeywords(draft.jobDescription).slice(0, 12);
  }, [draft.jobDescription]);

  const matchSummary = useMemo(() => {
    const analyzedExperiences = draft.experiences.filter((experience) => Boolean(analysisByExperience[experience.id]) || experience.bullets.some((bullet) => bullet.trim()));
    const results = analyzedExperiences.map((experience) => analysisByExperience[experience.id]?.jobAnalysis).filter(Boolean) as NonNullable<AnalysisResult["jobAnalysis"]>[];
    const experienceText = draft.experiences.map((experience) => [experience.title, experience.role, experience.rawDescription, ...experience.confirmedDetails, ...experience.bullets].join(" ")).join(" ").toLowerCase();
    const modelKeywords = results.flatMap((item) => [...(item.coveredKeywords || []), ...(item.missingKeywords || [])]);
    const jdKeywords = extractJdKeywords(draft.jobDescription);
    const latinKeywords = draft.jobDescription.match(/[A-Za-z][A-Za-z0-9.+#-]{1,20}/g) || [];
    const candidates = [...new Set([...modelKeywords, ...jdKeywords, ...latinKeywords].map(canonicalKeyword))].filter((word) => word.length > 1);
    const covered = candidates.filter((word) => semanticKeywordMatch(word, experienceText));
    const missing = candidates.filter((word) => !semanticKeywordMatch(word, experienceText));
    const suggestions = [...new Set(results.flatMap((item) => item.suggestions || []))];
    const completeness = analyzedExperiences.length ? analyzedExperiences.reduce((sum, experience) => sum + (experience.title.trim() ? 10 : 0) + (experience.role.trim() ? 15 : 0) + (experience.dateRange.trim() ? 10 : 0) + (experience.rawDescription.trim() ? 25 : 0) + Math.min(40, experience.bullets.filter((bullet) => bullet.trim()).length * 10), 0) / analyzedExperiences.length : 0;
    const coverage = candidates.length ? (covered.length / candidates.length) * 100 : 0;
    const score = analyzedExperiences.length ? Math.min(96, Math.round(coverage * 0.7 + completeness * 0.3)) : 0;
    return { score, covered, missing, suggestions, analyzedCount: analyzedExperiences.length };
  }, [analysisByExperience, draft.experiences, draft.jobDescription]);

  function update<K extends keyof ResumeDraft>(key: K, value: ResumeDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateExperience(patch: Partial<ExperienceDraft>, id = activeExperienceId) {
    setDraft((current) => ({ ...current, experiences: current.experiences.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function updateExperienceMonth(boundary: "start" | "end", value: string) {
    if (!activeExperience) return;
    const current = parseMonthRange(activeExperience.dateRange);
    updateExperience({ dateRange: formatMonthRange(boundary === "start" ? value : current.start, boundary === "end" ? value : current.end) });
  }

  function addExperience() {
    const id = `exp-${Date.now()}`;
    setDraft((current) => ({ ...current, experiences: [...current.experiences, { id, type: "项目", title: "新经历", role: "", dateRange: "", rawDescription: "", bullets: [], confirmedDetails: [] }] }));
    setActiveExperienceId(id);
    setActiveStep(2);
  }

  function addInternshipExperience() {
    const id = `exp-${Date.now()}`;
    setDraft((current) => ({ ...current, experiences: [...current.experiences, { id, type: "实习", title: "实习经历", role: "", dateRange: "", rawDescription: "", bullets: [], confirmedDetails: [] }] }));
    setActiveExperienceId(id);
    setActiveStep(2);
  }

  function removeExperience(id: string) {
    const experiences = draft.experiences.filter((item) => item.id !== id);
    setDraft((current) => ({ ...current, experiences }));
    if (id === activeExperienceId) setActiveExperienceId(experiences[0]?.id || "");
    setAnalysisByExperience((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  function handlePhoto(file?: File) {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhotoError("请选择图片文件。");
    if (file.size > 2 * 1024 * 1024) return setPhotoError("照片请控制在 2MB 以内。");
    const reader = new FileReader();
    reader.onload = () => update("photoDataUrl", String(reader.result || ""));
    reader.onerror = () => setPhotoError("照片读取失败，请重试。");
    reader.readAsDataURL(file);
  }

  async function requestAnalysis(experienceId: string, rawDescription: string, experienceType: ExperienceDraft["type"], existingBullets: string[]) {
    setIsGenerating(true);
    setGenerationError("");
    try {
      const response = await fetch("/api/analyze-experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: draft.targetRole,
          jobDescription: draft.jobDescription,
          experienceType: EXPERIENCE_TYPE_API[experienceType],
          rawDescription,
          existingBullets,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "生成失败，请稍后重试。");
      setAnalysisByExperience((current) => ({ ...current, [experienceId]: mergeAnalysisResult(current[experienceId], result) }));
      setDraft((current) => ({ ...current, experiences: current.experiences.map((item) => item.id === experienceId ? {
        ...item,
        role: item.role.trim() ? item.role : mergeRoleKeywords(item.role, result.suggestedRoles || []),
        bullets: mergeResumeBullets(item.bullets, result.resumeBullets),
      } : item) }));
      setActiveStep(3);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "生成失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateBullets() {
    if (!activeExperience) return;
    const target = activeExperience;
    setFollowUpAnswers((current) => ({ ...current, [target.id]: {} }));
    const accumulatedDescription = [target.rawDescription, ...target.confirmedDetails].filter(Boolean).join("\n\n用户此前补充确认的信息：\n");
    await requestAnalysis(target.id, accumulatedDescription, target.type, target.bullets);
  }

  async function regenerateWithAnswers() {
    if (!activeExperience || !analysis?.followUpQuestions?.length) return;
    const target = activeExperience;
    const confirmedAnswers = analysis.followUpQuestions
      .map((question) => ({ question, answer: activeFollowUpAnswers[question]?.trim() }))
      .filter((item) => item.answer);
    if (!confirmedAnswers.length) return;
    const supplement = confirmedAnswers.map((item) => `问题：${item.question}\n回答：${item.answer}`).join("\n");
    const confirmedDetails = [...target.confirmedDetails, supplement];
    updateExperience({ confirmedDetails }, target.id);
    await requestAnalysis(target.id, `${target.rawDescription}\n\n用户补充确认的信息：\n${confirmedDetails.join("\n\n")}`, target.type, target.bullets);
  }

  function saveCurrentProgress() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(analysisByExperience));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
    if (activeStep < 4) setActiveStep((step) => Math.min(4, step + 1));
  }

  function clearDraft() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ANALYSIS_STORAGE_KEY);
    setDraft(emptyDraft);
    setAnalysisByExperience({});
    setFollowUpAnswers({});
    setActiveStep(0);
  }

  function downloadBlob(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(draft.name || "面通AI简历").replace(/[\\/:*?"<>|]/g, "-")}-简历.${extension}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportWord() {
    setExportBusy("word");
    try {
      const contactLine = getContactLine(draft);
      const photo = await photoAsJpeg(draft.photoDataUrl);
      const run = (text: string, bold = false, size = 17) => `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
      const para = (text: string, options: { bold?: boolean; size?: number; after?: number; bullet?: boolean } = {}) => `<w:p><w:pPr>${options.bullet ? "<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr>" : ""}<w:spacing w:after="${options.after ?? 45}" w:line="250" w:lineRule="auto"/></w:pPr>${run(text, options.bold, options.size)}</w:p>`;
      const heading = (text: string) => `<w:p><w:pPr><w:keepNext/><w:spacing w:before="150" w:after="70"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="111111"/></w:pBdr></w:pPr>${run(text, true, 22)}</w:p>`;
      const twoCol = (left: string, right: string) => `<w:tbl><w:tblPr><w:tblW w:w="10100" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="7300"/><w:gridCol w:w="2800"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="7300" w:type="dxa"/></w:tcPr>${para(left, { bold: true })}</w:tc><w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run(right, false, 17)}</w:p></w:tc></w:tr></w:tbl>`;
      const drawing = photo ? `<w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="1219200"/><wp:docPr id="1" name="证件照" descr="求职者证件照"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="photo.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="1219200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>` : "";
      const header = `<w:tbl><w:tblPr><w:tblW w:w="10100" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="8500"/><w:gridCol w:w="1600"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="8500" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${para(draft.name || "你的姓名", { bold: true, size: 36, after: 90 })}${para(`求职意向：${draft.targetRole || "目标岗位"}`, { bold: true })}${contactLine ? para(contactLine) : ""}${para(`到岗时间：${draft.availability || "待填写"} · 毕业时间：${draft.graduationDate || "待填写"}`)}</w:tc><w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${drawing}</w:p></w:tc></w:tr></w:tbl>`;
      let body = header + heading("教育经历") + twoCol(draft.school, draft.major);
      if (draft.courses) body += para(`相关课程：${draft.courses}`); if (draft.educationSummary) body += para(draft.educationSummary);
      if (draft.selfSummary) body += heading("自我评价") + para(draft.selfSummary);
      body += heading("项目 / 实训经历");
      for (const exp of draft.experiences) { body += twoCol(exp.title, exp.dateRange); if (exp.role) body += para(`项目角色：${exp.role}`); for (const bullet of exp.bullets) body += para(bullet, { bullet: true }); }
      if (draft.skills) body += heading("专业技能") + para(draft.skills);
      if (draft.campusTitle || draft.certificates) { body += heading("校园经历 / 证书"); if (draft.campusTitle) body += twoCol(draft.campusTitle, draft.campusDate) + para(draft.campusDescription); if (draft.certificates) body += para(`证书：${draft.certificates}`); }
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="650" w:right="820" w:bottom="650" w:left="820" w:header="0" w:footer="0"/></w:sectPr></w:body></w:document>`;
      const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
      const rootRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
      const docRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${photo ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/photo.jpeg"/>' : ""}</Relationships>`;
      const numbering = `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="300"/></w:tabs><w:ind w:left="300" w:hanging="220"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
      const files = [{ name: "[Content_Types].xml", data: textBytes(contentTypes) }, { name: "_rels/.rels", data: textBytes(rootRels) }, { name: "word/document.xml", data: textBytes(documentXml) }, { name: "word/numbering.xml", data: textBytes(numbering) }, { name: "word/_rels/document.xml.rels", data: textBytes(docRels) }];
      if (photo) files.push({ name: "word/media/photo.jpeg", data: photo });
      downloadBlob(createZip(files), "docx"); setExportOpen(false);
    } catch { window.alert("Word 生成失败，请重新选择照片后再试。"); } finally { setExportBusy(null); }
  }

  async function exportJpg() {
    setExportBusy("jpg");
    try {
      const contactLine = getContactLine(draft);
      const canvas = document.createElement("canvas"); canvas.width = 2480; canvas.height = 3508;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持图片导出");
      context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#111";
      const left = 171, right = 2309, maxWidth = right - left; let y = 136;
      const font = (size: number, bold = false) => { context.font = `${bold ? 700 : 400} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`; };
      const lines = (text: string, width: number) => { const result: string[] = []; let line = ""; for (const char of text) { const next = line + char; if (context.measureText(next).width > width && line) { result.push(line); line = char; } else line = next; } if (line) result.push(line); return result; };
      const drawText = (text: string, x: number, width: number, size = 34, bold = false, gap = 14) => { font(size, bold); for (const line of lines(text, width)) { context.fillText(line, x, y); y += size + gap; } };
      const section = (title: string) => { y += 30; drawText(title, left, maxWidth, 42, true, 8); context.fillRect(left, y, maxWidth, 5); y += 44; };
      const row = (a: string, b: string) => { font(35, true); context.fillText(a, left, y); font(33); context.fillText(b, right - context.measureText(b).width, y); y += 54; };
      font(72, true); context.fillText(draft.name || "你的姓名", left, y); y += 88;
      drawText(`求职意向：${draft.targetRole || "目标岗位"}`, left, 1650, 35, true, 14); if (contactLine) drawText(contactLine, left, 1650, 34); drawText(`到岗时间：${draft.availability || "待填写"} · 毕业时间：${draft.graduationDate || "待填写"}`, left, 1650, 34);
      if (draft.photoDataUrl) { const image = await loadImage(draft.photoDataUrl); const w = 283, h = 378; context.drawImage(image, right - w, 136, w, h); }
      y = Math.max(y + 20, 560); section("教育经历"); row(draft.school, draft.major); if (draft.courses) drawText(`相关课程：${draft.courses}`, left, maxWidth); if (draft.educationSummary) drawText(draft.educationSummary, left, maxWidth);
      if (draft.selfSummary) { section("自我评价"); drawText(draft.selfSummary, left, maxWidth); }
      section("项目 / 实训经历"); for (const exp of draft.experiences) { row(exp.title, exp.dateRange); if (exp.role) drawText(`项目角色：${exp.role}`, left, maxWidth, 32); for (const bullet of exp.bullets) drawText(`• ${bullet}`, left + 12, maxWidth - 12, 33); y += 16; }
      if (draft.skills) { section("专业技能"); drawText(draft.skills, left, maxWidth); }
      if (draft.campusTitle || draft.certificates) { section("校园经历 / 证书"); if (draft.campusTitle) { row(draft.campusTitle, draft.campusDate); drawText(draft.campusDescription, left, maxWidth); } if (draft.certificates) drawText(`证书：${draft.certificates}`, left, maxWidth); }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96));
      if (!blob) throw new Error("JPG 生成失败");
      downloadBlob(blob, "jpg");
      setExportOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "JPG 导出失败，请重试。");
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="面通 AI 首页">
          <span className="brand-mark">面</span>
          <span>面通 AI</span>
        </a>
        <div className="topbar-actions">
          <button className={`ai-status ${aiStatus?.active?.configured ? "connected" : ""}`} onClick={openSettings}>
            <i />{aiStatus?.active?.configured ? `${aiStatus.active.label} · ${aiStatus.active.model}` : "模型设置"}
          </button>
          <span className={`save-status ${saved ? "visible" : ""}`}>草稿已保存</span>
          <button className="text-button clear-button" onClick={clearDraft}>清除草稿</button>
          <div className="export-menu">
            <button className="ghost-button" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)}>导出简历 ▾</button>
            {exportOpen && <div className="export-options" role="menu">
              <button role="menuitem" onClick={() => { setExportOpen(false); window.print(); }}><strong>PDF</strong><span>打印或保存为 PDF</span></button>
              <button role="menuitem" onClick={exportJpg} disabled={Boolean(exportBusy)}><strong>JPG</strong><span>{exportBusy === "jpg" ? "正在生成…" : "高清简历图片"}</span></button>
              <button role="menuitem" onClick={exportWord} disabled={Boolean(exportBusy)}><strong>Word</strong><span>{exportBusy === "word" ? "正在生成…" : "标准可编辑 .docx"}</span></button>
            </div>}
          </div>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <span className="eyebrow">为低经验大学生设计</span>
          <h1>把真实经历，写成一份<br />值得投递的简历。</h1>
          <p>不编造，不套话。通过引导式提问挖掘课程、项目和校园经历，再结合目标岗位调整表达重点。</p>
        </div>
        <div className="promise-card">
          <span>真实性承诺</span>
          <strong>AI 只优化你确认过的信息</strong>
          <p>数据、奖项、技术与结果未经确认，不会写入正式简历。</p>
        </div>
      </section>

      <nav className="stepper" aria-label="创建步骤">
        {steps.map((step, index) => (
          <button
            key={step}
            className={index === activeStep ? "active" : index < activeStep ? "done" : ""}
            onClick={() => setActiveStep(index)}
          >
            <span>{index < activeStep ? "✓" : index + 1}</span>{step}
          </button>
        ))}
      </nav>

      <section className="workspace">
        <div className="form-panel">
          <div className="section-heading">
            <div><span>STEP {activeStep + 1}</span><h2>{steps[activeStep]}</h2></div>
            <small>所有内容都可以稍后修改</small>
          </div>

          {activeStep === 0 && (
            <div className="form-grid single">
              <label>目标岗位<input value={draft.targetRole} onChange={(e) => update("targetRole", e.target.value)} /></label>
              <label>岗位描述（JD）<textarea rows={7} value={draft.jobDescription} onChange={(e) => update("jobDescription", e.target.value)} /></label>
              <div className="keyword-box"><span>已识别关键词</span><div>{coveredKeywords.map((word) => <em key={word}>{word}</em>)}</div></div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="profile-editor">
              <div className="photo-uploader">
                <div className="photo-preview">{draft.photoDataUrl ? <img src={draft.photoDataUrl} alt="简历证件照预览" /> : <span>证件照</span>}</div>
                <label className="upload-button">选择照片<input type="file" accept="image/*" onChange={(event) => handlePhoto(event.target.files?.[0])} /></label>
                <button className="studio-entry" onClick={() => setPhotoStudioOpen(true)}><span>AI</span>工作室证件照</button>
                {draft.photoDataUrl && <button className="text-button" onClick={() => update("photoDataUrl", "")}>移除</button>}
                <small>建议正面证件照，2MB 以内；仅保存到本设备草稿。</small>
                {photoError && <p className="error-message">{photoError}</p>}
              </div>
              <div className="form-grid">
                <label>姓名<input value={draft.name} onChange={(e) => update("name", e.target.value)} /></label>
                <label>联系电话<input value={draft.phone} onChange={(e) => update("phone", e.target.value)} /></label>
                <label>电子邮箱<input value={draft.email} onChange={(e) => update("email", e.target.value)} /></label>
                <label>微信<input value={draft.wechat} onChange={(e) => update("wechat", e.target.value)} /></label>
                <label>到岗时间<input value={draft.availability} onChange={(e) => update("availability", e.target.value)} /></label>
                <label>毕业时间<input value={draft.graduationDate} onChange={(e) => update("graduationDate", e.target.value)} /></label>
                <label>学校<input value={draft.school} onChange={(e) => update("school", e.target.value)} /></label>
                <label>专业、学历与时间<input value={draft.major} onChange={(e) => update("major", e.target.value)} /></label>
                <label className="wide">相关课程<input value={draft.courses} onChange={(e) => update("courses", e.target.value)} /></label>
                <label className="wide">教育背景补充<textarea rows={3} value={draft.educationSummary} onChange={(e) => update("educationSummary", e.target.value)} /></label>
                <label className="wide">自我评价<textarea rows={3} value={draft.selfSummary} onChange={(e) => update("selfSummary", e.target.value)} /></label>
                <label className="wide">专业技能<textarea rows={3} value={draft.skills} onChange={(e) => update("skills", e.target.value)} /></label>
                <label>校园经历/组织<input value={draft.campusTitle} onChange={(e) => update("campusTitle", e.target.value)} /></label>
                <label>校园经历时间<input value={draft.campusDate} onChange={(e) => update("campusDate", e.target.value)} /></label>
                <label className="wide">校园经历描述<textarea rows={3} value={draft.campusDescription} onChange={(e) => update("campusDescription", e.target.value)} /></label>
                <label className="wide">证书<input value={draft.certificates} onChange={(e) => update("certificates", e.target.value)} /></label>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="experience-editor">
              <div className="experience-tabs">
                {draft.experiences.map((item, index) => <button key={item.id} className={item.id === activeExperienceId ? "active" : ""} onClick={() => setActiveExperienceId(item.id)}>
                  <span>{index + 1}. {item.title || "未命名经历"}</span><small>{item.type} · {item.dateRange || "未填时间"}</small>
                </button>)}
                <button className="add-experience" onClick={addExperience}>＋ 添加经历</button>
              </div>
              {activeExperience ? <div className="form-grid single experience-fields">
                <div className="experience-meta">
                  <label>经历类型<select value={activeExperience.type} onChange={(e) => updateExperience({ type: e.target.value as ExperienceDraft["type"] })}><option>项目</option><option>实习</option><option>校园</option><option>竞赛</option></select></label>
                  <fieldset className="month-range"><legend>时间范围</legend><label>开始年月<input type="month" value={parseMonthRange(activeExperience.dateRange).start} onChange={(e) => updateExperienceMonth("start", e.target.value)} /></label><span>至</span><label>结束年月<input type="month" value={parseMonthRange(activeExperience.dateRange).end} onChange={(e) => updateExperienceMonth("end", e.target.value)} /></label></fieldset>
                </div>
                <label>经历名称<input value={activeExperience.title} onChange={(e) => updateExperience({ title: e.target.value })} /></label>
                <label>项目角色 / 职责关键词 <span className="field-hint">AI 提炼后会自动联想，也可手动调整</span><input value={activeExperience.role} onChange={(e) => updateExperience({ role: e.target.value })} placeholder="AI 将根据经历描述和 JD 自动推荐" /></label>
                {analysis?.suggestedRoles?.length ? <div className="role-suggestions"><span>AI 推荐职责词</span><div>{analysis.suggestedRoles.map((role) => {
                  const selected = hasRoleKeyword(activeExperience.role, role);
                  return <button type="button" key={role} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => updateExperience({ role: toggleRoleKeyword(activeExperience.role, role) })}>{selected ? "✓" : "＋"} {role}</button>;
                })}</div><small>点击加入，再次点击可取消。</small></div> : null}
                <label>用自己的话描述这段经历<textarea rows={7} value={activeExperience.rawDescription} onChange={(e) => updateExperience({ rawDescription: e.target.value })} /></label>
                <div className="experience-actions"><button className="danger-button" onClick={() => removeExperience(activeExperience.id)}>删除这段经历</button><button className="primary-button" onClick={generateBullets} disabled={isGenerating || !activeExperience.rawDescription.trim()}>{isGenerating ? "正在提炼…" : "AI 提炼这段经历"}</button></div>
                {generationError && <p className="error-message" role="alert">{generationError}</p>}
              </div> : <div className="empty-experience"><p>还没有经历。课程项目、竞赛、社团活动和个人作品都可以写。</p><button className="primary-button" onClick={addExperience}>添加第一段经历</button></div>}
            </div>
          )}

          {activeStep === 3 && (
            <div className="advice-panel">
              <div className="advice-score"><div><span>JD 关键词匹配</span><strong>{matchSummary.score}%</strong></div><div className="progress"><i style={{ width: `${matchSummary.score}%` }} /></div><p>已分析 {matchSummary.analyzedCount}/{draft.experiences.length} 段经历。补充与岗位真实相关的职责、工具和结果后，覆盖度会重新计算。</p></div>
              <div className="advice-grid">
                <section><span className="advice-label covered">已覆盖关键词</span><div className="advice-tags">{matchSummary.covered.length ? matchSummary.covered.map((word) => <em key={word}>{word}</em>) : <p>请先生成至少一段经历。</p>}</div></section>
                <section><span className="advice-label missing">待补充关键词</span><div className="advice-tags missing">{matchSummary.missing.length ? matchSummary.missing.map((word) => <em key={word}>{word}</em>) : <p>暂未发现明显缺失关键词。</p>}</div></section>
              </div>
              <div className="advice-suggestions"><strong>针对 JD 的修改意见</strong><ol>{(matchSummary.suggestions.length ? matchSummary.suggestions : ["补充你在项目或实习中承担的任务、使用的工具和取得的结果。"]).slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ol></div>
              <div className="advice-action"><div><strong>缺少正式实习也可以补充</strong><p>课程实训、校内岗位、志愿服务和短期实践，只要职责真实，都能帮助证明岗位能力。</p></div><button className="primary-button" onClick={addInternshipExperience}>＋ 添加实习经历</button></div>
              <button className="secondary-button" onClick={() => setActiveStep(2)}>返回经历采集继续完善</button>
            </div>
          )}

          {activeStep === 4 && (
            <div className="generated-list">
              <div className="truth-note"><strong>已通过真实性检查</strong><span>以下内容仅使用你提供的信息。</span></div>
              <div className="generated-experience-tabs" aria-label="选择要查看的经历">
                {draft.experiences.map((experience, index) => <button key={experience.id} className={experience.id === activeExperience?.id ? "active" : ""} onClick={() => setActiveExperienceId(experience.id)}>
                  <span>{index + 1}. {experience.title || "未命名经历"}</span><small>{experience.bullets.length ? `${experience.bullets.length} 条已完善要点` : "等待完善"}</small>
                </button>)}
              </div>
              {analysis?.facts?.length ? (
                <div className="analysis-block">
                  <div className="analysis-title"><strong>已提取事实</strong><span>{analysis.facts.length} 项可追溯信息</span></div>
                  <div className="fact-list">{analysis.facts.map((fact) => <div key={fact.id}><em>{fact.category}</em><span>{fact.content}</span></div>)}</div>
                </div>
              ) : null}
              {analysis?.followUpQuestions?.length ? (
                <div className="analysis-block questions-result">
                  <div className="analysis-title"><strong>建议继续补充</strong><span>信息越完整，表达越有力</span></div>
                  <div className="follow-up-form">{analysis.followUpQuestions.map((question, index) => <label key={question}>
                    <span>{index + 1}. {question}</span>
                    <input value={activeFollowUpAnswers[question] || ""} onChange={(event) => setFollowUpAnswers((current) => ({ ...current, [activeExperience!.id]: { ...activeFollowUpAnswers, [question]: event.target.value } }))} placeholder="填写真实情况；不清楚可以留空" />
                  </label>)}</div>
                  <button className="secondary-button" onClick={regenerateWithAnswers} disabled={isGenerating || !Object.values(activeFollowUpAnswers).some((answer) => answer.trim())}>
                    {isGenerating ? "正在重新提炼…" : "使用补充信息重新生成"}
                  </button>
                </div>
              ) : null}
              {analysis?.suggestedRoles?.length && activeExperience ? <div className="role-suggestions generated-role-suggestions"><span>AI 联想的角色 / 职责词</span><div>{analysis.suggestedRoles.map((role) => {
                const selected = hasRoleKeyword(activeExperience.role, role);
                return <button type="button" key={role} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => updateExperience({ role: toggleRoleKeyword(activeExperience.role, role) })}>{selected ? "✓" : "＋"} {role}</button>;
              })}</div><small>点击加入，再次点击可取消；不会影响其他职责。</small></div> : null}
              {(activeExperience?.bullets || []).map((bullet, index) => (
                <label className="bullet-editor" key={index}><span><strong>要点 {index + 1}</strong><button type="button" onClick={() => updateExperience({ bullets: activeExperience!.bullets.filter((_, bulletIndex) => bulletIndex !== index) })}>删除要点</button></span><textarea rows={4} value={bullet} onChange={(e) => {
                  const bullets = [...(activeExperience?.bullets || [])]; bullets[index] = e.target.value; updateExperience({ bullets });
                }} /></label>
              ))}
              {activeExperience && activeExperience.bullets.length < 8 ? <button type="button" className="add-bullet-button" onClick={() => updateExperience({ bullets: [...activeExperience.bullets, ""] })}>＋ 添加一条要点</button> : null}
            </div>
          )}

          <div className="form-actions">
            <button className="text-button" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>上一步</button>
            <button className="primary-button" onClick={saveCurrentProgress}>{activeStep === 4 ? "保存修改" : "保存并继续"}</button>
          </div>
        </div>

        <aside className="preview-column">
          <div className="preview-label"><span>实时预览</span><small>A4 · ATS 单栏</small></div>
          <article className="resume-page" ref={resumeRef}>
            <header className="resume-header"><div className="resume-identity"><h2>{draft.name || "你的姓名"}</h2><p><strong>求职意向：</strong>{draft.targetRole || "目标岗位"}</p>{contactLine && <p>{contactLine}</p>}<p><strong>到岗时间：</strong>{draft.availability || "待填写"} · <strong>毕业时间：</strong>{draft.graduationDate || "待填写"}</p></div>{draft.photoDataUrl && <img className="resume-photo" src={draft.photoDataUrl} alt="证件照" />}</header>
            <section><h3>教育经历</h3><div className="resume-row"><strong>{draft.school}</strong><span>{draft.major}</span></div>{draft.courses && <p>相关课程：{draft.courses}</p>}{draft.educationSummary && <p>{draft.educationSummary}</p>}</section>
            {draft.selfSummary && <section><h3>自我评价</h3><p>{draft.selfSummary}</p></section>}
            <section><h3>项目 / 实训经历</h3>{draft.experiences.map((experience) => <div className="resume-experience" key={experience.id}><div className="resume-row"><strong>{experience.title}</strong><span>{experience.dateRange}</span></div>{experience.role && <p className="resume-role">项目角色：{experience.role}</p>}<ul>{experience.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul></div>)}</section>
            {draft.skills && <section><h3>专业技能</h3><p>{draft.skills}</p></section>}
            {(draft.campusTitle || draft.certificates) && <section><h3>校园经历 / 证书</h3>{draft.campusTitle && <><div className="resume-row"><strong>{draft.campusTitle}</strong><span>{draft.campusDate}</span></div><p>{draft.campusDescription}</p></>}{draft.certificates && <p>证书：{draft.certificates}</p>}</section>}
          </article>
          <div className="match-card">
            <div><span>全部经历关键词覆盖</span><strong>{matchSummary.score}%</strong></div>
            <div className="progress"><i style={{ width: `${matchSummary.score}%` }} /></div>
            <p>{matchSummary.analyzedCount ? `已汇总 ${matchSummary.analyzedCount} 段经历；进入“修改意见”查看缺失关键词和补充建议。` : "生成经历后，进入“修改意见”查看覆盖依据和缺失关键词。"}</p>
          </div>
        </aside>
      </section>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="model-settings-title">
            <button className="modal-close" aria-label="关闭" onClick={() => setSettingsOpen(false)}>×</button>
            <span className="eyebrow">MODEL SETTINGS</span>
            <h2 id="model-settings-title">模型设置</h2>
            <p className="settings-intro">选择供应商、模型并独立管理 API Key。Key 仅保存在本浏览器的安全 Cookie 中，页面脚本无法读取。</p>
            <div className="provider-tabs">
              {aiStatus?.providers.map((provider) => (
                <button key={provider.id} className={settingsProvider === provider.id ? "active" : ""} onClick={() => chooseSettingsProvider(provider.id)}>
                  <span>{provider.label}</span><small>{provider.configured ? "已配置" : "未配置"}</small>
                </button>
              ))}
            </div>
            <div className="model-summary">
              <div><span>供应商</span><strong>{selectedProviderStatus?.label || settingsProvider}</strong></div>
              <label><span>模型</span><select value={settingsModel} onChange={(event) => setSettingsModel(event.target.value)}>
                {selectedProviderStatus?.models.map((model) => <option key={model} value={model}>{model}</option>)}
              </select></label>
              <div><span>状态</span><strong className={selectedProviderStatus?.configured ? "ok" : "waiting"}>{selectedProviderStatus?.configured ? `已配置 ${selectedProviderStatus.apiKeyHint}` : "等待设置"}</strong></div>
            </div>
            <label className="key-field">{selectedProviderStatus?.label || settingsProvider} API Key
              <input type="password" autoComplete="off" placeholder={selectedProviderStatus?.configured ? "输入新 Key 可替换当前 Key" : "输入 API Key"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            </label>
            {settingsMessage && <p className="settings-message" role="status">{settingsMessage}</p>}
            <div className="settings-actions">
              {selectedProviderStatus?.configured && <button className="danger-button" onClick={removeKey} disabled={settingsBusy}>删除 Key</button>}
              <div>
                {selectedProviderStatus?.configured && <button className="ghost-button" onClick={() => saveAndTestKey(true)} disabled={settingsBusy}>检测并切换</button>}
                <button className="primary-button" onClick={() => saveAndTestKey(false)} disabled={settingsBusy || !apiKey.trim()}>{settingsBusy ? "正在检测…" : selectedProviderStatus?.configured ? "更换 Key 并切换" : "保存、检测并切换"}</button>
              </div>
            </div>
            <small className="security-note">安全提示：不要在公共或他人设备上保存个人 API Key。你可以随时在这里删除。</small>
          </section>
        </div>
      )}
      {photoStudioOpen && <PhotoStudio onClose={() => setPhotoStudioOpen(false)} onApply={(photo) => { update("photoDataUrl", photo); setPhotoError(""); setPhotoStudioOpen(false); }} />}
    </main>
  );
}
