import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "面通 AI｜大学生简历助手",
  description: "用真实经历生成专业、匹配岗位的大学生简历。",
  icons: {
    icon: [{ url: "/favicon.svg?v=4", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
