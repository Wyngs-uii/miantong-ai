import type { Metadata } from "next";
import ResumeBuilder from "./resume-builder";

export const metadata: Metadata = {
  title: "面通 AI｜大学生简历助手",
  description: "从真实经历中提炼适合岗位投递的专业简历内容。",
};

export default function Home() {
  return <ResumeBuilder />;
}
