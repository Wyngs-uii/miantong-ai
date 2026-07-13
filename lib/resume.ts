export type ExperienceType = "project" | "competition" | "campus" | "internship";

export type FactStatus = "confirmed" | "needs_confirmation";

export type ResumeFact = {
  id: string;
  category: "task" | "action" | "tool" | "problem" | "result";
  content: string;
  status: FactStatus;
  sourceText: string;
};

export type Experience = {
  id: string;
  type: ExperienceType;
  title: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
  rawDescription: string;
  facts: ResumeFact[];
  technologies: string[];
  resumeBullets: string[];
  followUpQuestions: string[];
};

export type JobAnalysis = {
  responsibilities: string[];
  skills: string[];
  bonusItems: string[];
  coveredKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  score?: number;
  scoreBreakdown?: {
    responsibilityCoverage: number;
    skillCoverage: number;
    experienceRelevance: number;
    contentCompleteness: number;
  };
};

export type ResumeData = {
  profile: {
    name: string;
    phone: string;
    email: string;
    location?: string;
    targetRole: string;
  };
  education: Array<{
    school: string;
    major: string;
    degree: string;
    startDate: string;
    endDate: string;
  }>;
  experiences: Experience[];
  skills: string[];
  jobDescription?: string;
  jobAnalysis?: JobAnalysis;
  updatedAt: string;
};

export type AnalyzeExperienceRequest = {
  targetRole: string;
  jobDescription?: string;
  experienceType: ExperienceType;
  rawDescription: string;
  existingBullets?: string[];
};

export type AnalyzeExperienceResponse = {
  facts: ResumeFact[];
  followUpQuestions: string[];
  resumeBullets: string[];
  jobAnalysis?: JobAnalysis;
  safety: {
    inventedFactsDetected: boolean;
    blockedStatements: string[];
  };
};

export function calculateMatchScore(input: JobAnalysis): JobAnalysis {
  const breakdown = input.scoreBreakdown;
  if (!breakdown) return { ...input, score: undefined };

  const score = Math.round(
    breakdown.responsibilityCoverage * 0.4 +
      breakdown.skillCoverage * 0.25 +
      breakdown.experienceRelevance * 0.25 +
      breakdown.contentCompleteness * 0.1,
  );

  return { ...input, score: Math.max(0, Math.min(100, score)) };
}
