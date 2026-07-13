import type { AnalyzeExperienceRequest, AnalyzeExperienceResponse, ResumeFact } from "./resume";
import { calculateMatchScore } from "./resume";
import { EXTRACT_EXPERIENCE_PROMPT, GENERATE_BULLETS_PROMPT, PROFESSIONAL_LANGUAGE_GUIDE } from "./prompts";

export type ProviderId = "deepseek" | "openai" | "gemini";

export const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
    envKey: "DEEPSEEK_API_KEY",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6-luna",
    models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
    envKey: "OPENAI_API_KEY",
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.5-flash",
    models: ["gemini-3.5-flash"],
    envKey: "GEMINI_API_KEY",
  },
} as const;

export const PROVIDER_COOKIE = "shili_ai_provider";
export const LEGACY_DEEPSEEK_KEY_COOKIE = "shili_ai_key";
export const keyCookie = (provider: ProviderId) => `shili_ai_key_${provider}`;
export const modelCookie = (provider: ProviderId) => `shili_ai_model_${provider}`;

type OpenAICompatibleCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

type GeminiCompletion = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  const entry = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!entry) return undefined;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return undefined; }
}

export function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && value in PROVIDERS;
}

export function getSelectedProvider(request: Request): ProviderId {
  const cookieProvider = readCookie(request, PROVIDER_COOKIE);
  if (isProvider(cookieProvider)) return cookieProvider;
  const envProvider = process.env.AI_PROVIDER;
  return isProvider(envProvider) ? envProvider : "deepseek";
}

function getEnvironmentKey(provider: ProviderId) {
  const specific = process.env[PROVIDERS[provider].envKey];
  if (specific) return specific;
  return process.env.AI_PROVIDER === provider ? process.env.AI_API_KEY : undefined;
}

export function getProviderCredentials(request: Request, provider = getSelectedProvider(request)) {
  const spec = PROVIDERS[provider];
  const cookieKey = readCookie(request, keyCookie(provider)) || (provider === "deepseek" ? readCookie(request, LEGACY_DEEPSEEK_KEY_COOKIE) : undefined);
  const cookieModel = readCookie(request, modelCookie(provider));
  const model = cookieModel && spec.models.includes(cookieModel as never)
    ? cookieModel
    : process.env.AI_PROVIDER === provider && process.env.AI_MODEL
      ? process.env.AI_MODEL
      : spec.defaultModel;
  return {
    provider,
    model,
    apiKey: cookieKey || getEnvironmentKey(provider),
    source: cookieKey ? "browser" : getEnvironmentKey(provider) ? "environment" : null,
  };
}

export function getAllProviderStatus(request: Request) {
  const selectedProvider = getSelectedProvider(request);
  const providers = (Object.keys(PROVIDERS) as ProviderId[]).map((provider) => {
    const credentials = getProviderCredentials(request, provider);
    return {
      id: provider,
      label: PROVIDERS[provider].label,
      model: credentials.model,
      models: [...PROVIDERS[provider].models],
      configured: Boolean(credentials.apiKey),
      apiKeyHint: credentials.apiKey ? `••••${credentials.apiKey.slice(-4)}` : null,
      source: credentials.source,
    };
  });
  return { selectedProvider, active: providers.find((item) => item.id === selectedProvider), providers };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeResponse(raw: unknown, input: AnalyzeExperienceRequest): AnalyzeExperienceResponse {
  if (!raw || typeof raw !== "object") throw new Error("模型返回的 JSON 结构无效。");
  const value = raw as Record<string, unknown>;
  const rawFacts = Array.isArray(value.facts) ? value.facts : [];
  const facts: ResumeFact[] = rawFacts
    .filter((fact): fact is Record<string, unknown> => Boolean(fact && typeof fact === "object"))
    .map((fact) => ({
      id: crypto.randomUUID(),
      category: ["task", "action", "tool", "problem", "result"].includes(String(fact.category))
        ? (String(fact.category) as ResumeFact["category"]) : "task",
      content: String(fact.content || "").trim(), status: "confirmed", sourceText: input.rawDescription.trim(),
    })).filter((fact) => fact.content);
  if (!facts.length) throw new Error("模型没有提取出可确认的事实，请补充经历细节。");

  const followUpQuestions = isStringArray(value.followUpQuestions) ? value.followUpQuestions.filter(Boolean).slice(0, 4) : [];
  const resumeBullets = isStringArray(value.resumeBullets) ? value.resumeBullets.filter(Boolean).slice(0, 6) : [];
  const rawJob = value.jobAnalysis && typeof value.jobAnalysis === "object" ? value.jobAnalysis as Record<string, unknown> : null;
  const rawBreakdown = rawJob?.scoreBreakdown && typeof rawJob.scoreBreakdown === "object" ? rawJob.scoreBreakdown as Record<string, unknown> : null;
  const number = (candidate: unknown) => Math.max(0, Math.min(100, Number(candidate) || 0));
  const jobAnalysis = input.jobDescription?.trim() && rawJob ? calculateMatchScore({
    responsibilities: isStringArray(rawJob.responsibilities) ? rawJob.responsibilities : [],
    skills: isStringArray(rawJob.skills) ? rawJob.skills : [],
    bonusItems: isStringArray(rawJob.bonusItems) ? rawJob.bonusItems : [],
    coveredKeywords: isStringArray(rawJob.coveredKeywords) ? rawJob.coveredKeywords : [],
    missingKeywords: isStringArray(rawJob.missingKeywords) ? rawJob.missingKeywords : [],
    suggestions: isStringArray(rawJob.suggestions) ? rawJob.suggestions : [],
    scoreBreakdown: rawBreakdown ? {
      responsibilityCoverage: number(rawBreakdown.responsibilityCoverage), skillCoverage: number(rawBreakdown.skillCoverage),
      experienceRelevance: number(rawBreakdown.experienceRelevance), contentCompleteness: number(rawBreakdown.contentCompleteness),
    } : undefined,
  }) : undefined;
  return { facts, followUpQuestions, resumeBullets, jobAnalysis, safety: { inventedFactsDetected: false, blockedStatements: [] } };
}

function promptPayload(input: AnalyzeExperienceRequest) {
  const expectedJson = {
    facts: [{ category: "task", content: "用户明确提供的事实" }], followUpQuestions: ["最多四个具体问题"],
    resumeBullets: ["三至五条整合 existingBullets 且无重复的简历要点"],
    jobAnalysis: { responsibilities: [], skills: [], bonusItems: [], coveredKeywords: [], missingKeywords: [], suggestions: [],
      scoreBreakdown: { responsibilityCoverage: 0, skillCoverage: 0, experienceRelevance: 0, contentCompleteness: 0 } },
  };
  return `${EXTRACT_EXPERIENCE_PROMPT}\n\n${GENERATE_BULLETS_PROMPT}\n\n岗位化表达参考：\n${PROFESSIONAL_LANGUAGE_GUIDE}\nJSON 示例：${JSON.stringify(expectedJson)}\n用户输入：${JSON.stringify(input)}`;
}

async function callOpenAICompatible(provider: "deepseek" | "openai", model: string, apiKey: string, prompt: string) {
  const spec = PROVIDERS[provider];
  const body: Record<string, unknown> = {
    model, messages: [{ role: "system", content: "你是严格输出 JSON 的简历信息分析器。" }, { role: "user", content: prompt }],
    response_format: { type: "json_object" }, temperature: 0.2, max_tokens: 1800, stream: false,
  };
  if (provider === "deepseek") body.thinking = { type: "disabled" };
  const response = await fetch(`${spec.baseUrl}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const completion = await response.json() as OpenAICompatibleCompletion;
  if (!response.ok) throw new Error(completion.error?.message || `${spec.label} 请求失败（${response.status}）`);
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${spec.label} 返回了空内容。`);
  return content;
}

async function callGemini(model: string, apiKey: string, prompt: string) {
  const response = await fetch(`${PROVIDERS.gemini.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 1800 },
    }), signal: AbortSignal.timeout(30000),
  });
  const completion = await response.json() as GeminiCompletion;
  if (!response.ok) throw new Error(completion.error?.message || `Gemini 请求失败（${response.status}）`);
  const content = completion.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!content) throw new Error("Gemini 返回了空内容。");
  return content;
}

async function callProvider(provider: ProviderId, model: string, apiKey: string, prompt: string) {
  return provider === "gemini" ? callGemini(model, apiKey, prompt) : callOpenAICompatible(provider, model, apiKey, prompt);
}

export async function analyzeExperienceWithAI(input: AnalyzeExperienceRequest, request: Request) {
  const credentials = getProviderCredentials(request);
  if (!credentials.apiKey) return null;
  const content = await callProvider(credentials.provider, credentials.model, credentials.apiKey, promptPayload(input));
  return normalizeResponse(JSON.parse(content), input);
}

export async function testProviderApiKey(provider: ProviderId, model: string, apiKey: string) {
  const content = await callProvider(provider, model, apiKey, "只输出 json：{\"ok\":true}");
  JSON.parse(content);
  return true;
}
