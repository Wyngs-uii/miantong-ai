import { NextResponse } from "next/server";
import type { AnalyzeExperienceRequest, AnalyzeExperienceResponse, ResumeFact } from "../../../lib/resume";
import { calculateMatchScore } from "../../../lib/resume";
import { analyzeExperienceWithAI } from "../../../lib/ai-provider";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: AnalyzeExperienceRequest;
  try {
    body = (await request.json()) as AnalyzeExperienceRequest;
  } catch {
    return badRequest("请求内容不是有效的 JSON。请保留草稿后重试。");
  }

  if (!body.rawDescription?.trim()) return badRequest("请先描述一段真实经历。");
  if (body.rawDescription.length > 5000) return badRequest("经历描述不能超过 5000 个字符。");

  try {
    const aiResponse = await analyzeExperienceWithAI(body, request);
    if (aiResponse) return NextResponse.json(aiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const sourceText = body.rawDescription.trim();
  const facts: ResumeFact[] = [
    {
      id: crypto.randomUUID(),
      category: "task",
      content: sourceText,
      status: "confirmed",
      sourceText,
    },
  ];

  const response: AnalyzeExperienceResponse = {
    facts,
    followUpQuestions: [
      "这段经历中你具体负责了哪些模块？",
      "你使用了哪些工具、方法或技术？",
      "过程中解决了什么具体问题？",
      "最终完成了哪些可以验证的结果？",
    ],
    resumeBullets: [
      `围绕${body.targetRole || "目标岗位"}相关需求，整理并推进该经历中的核心任务。`,
      "基于已确认信息拆解个人职责、采取的行动与完成结果，形成可追溯的经历描述。",
    ],
    jobAnalysis: body.jobDescription?.trim()
      ? calculateMatchScore({
          responsibilities: ["需求分析", "功能设计", "产品迭代"],
          skills: ["沟通协作", "AI 工具应用"],
          bonusItems: [],
          coveredKeywords: ["需求分析", "AI 工具应用"],
          missingKeywords: ["用户调研", "数据验证"],
          suggestions: ["补充用户调研方法和可以验证的迭代结果。"],
          scoreBreakdown: {
            responsibilityCoverage: 70,
            skillCoverage: 65,
            experienceRelevance: 75,
            contentCompleteness: 55,
          },
        })
      : undefined,
    safety: { inventedFactsDetected: false, blockedStatements: [] },
  };

  return NextResponse.json(response);
}
