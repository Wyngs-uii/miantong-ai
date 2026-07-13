import { NextResponse } from "next/server";
import { LEGACY_DEEPSEEK_KEY_COOKIE, PROVIDERS, PROVIDER_COOKIE, isProvider, keyCookie, modelCookie, testProviderApiKey, type ProviderId } from "../../../lib/ai-provider";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function readCookie(request: Request, name: string) {
  const entry = (request.headers.get("cookie") || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!entry) return undefined;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return undefined; }
}

function cookie(request: Request, name: string, value: string, maxAge = 60 * 60 * 24 * 30) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function responseWithCookies(request: Request, body: unknown, provider: ProviderId, model: string, apiKey?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", cookie(request, PROVIDER_COOKIE, provider));
  headers.append("Set-Cookie", cookie(request, modelCookie(provider), model));
  if (apiKey) headers.append("Set-Cookie", cookie(request, keyCookie(provider), apiKey));
  return new NextResponse(JSON.stringify(body), { status: 200, headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "请求来源无效。" }, { status: 403 });
  let input: { provider?: string; model?: string; apiKey?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效。" }, { status: 400 }); }
  if (!isProvider(input.provider)) return NextResponse.json({ error: "请选择有效的模型供应商。" }, { status: 400 });
  const provider = input.provider;
  const spec = PROVIDERS[provider];
  const model = input.model && spec.models.includes(input.model as never) ? input.model : spec.defaultModel;
  const apiKey = input.apiKey?.trim() || readCookie(request, keyCookie(provider));
  if (!apiKey) return NextResponse.json({ error: `请输入 ${spec.label} API Key。` }, { status: 400 });
  if (apiKey.length < 16 || apiKey.length > 512) return NextResponse.json({ error: "API Key 格式不正确。" }, { status: 400 });

  try {
    await testProviderApiKey(provider, model, apiKey);
    return responseWithCookies(request, { provider, model, configured: true, apiKeyHint: `••••${apiKey.slice(-4)}` }, provider, model, input.apiKey ? apiKey : undefined);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "检测失败，请检查 Key。" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "请求来源无效。" }, { status: 403 });
  let input: { provider?: string } = {};
  try { input = await request.json(); } catch { /* DELETE can omit a body */ }
  if (!isProvider(input.provider)) return NextResponse.json({ error: "请选择有效的模型供应商。" }, { status: 400 });
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", cookie(request, keyCookie(input.provider), "", 0));
  if (input.provider === "deepseek") headers.append("Set-Cookie", cookie(request, LEGACY_DEEPSEEK_KEY_COOKIE, "", 0));
  return new NextResponse(JSON.stringify({ removed: true }), { status: 200, headers });
}
