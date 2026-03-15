import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/react'; // Vercel 통계 도구

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 앱 이름과 설명도 우리 기획에 맞게 수정했습니다. (카톡 공유할 때 뜨는 문구)
export const metadata: Metadata = {
  title: "WE US | 우리가 되어가는 5분의 시간",
  description: "실수해도 괜찮아, 5분 뒤면 사라질 인연이니까. 익명 실시간 대화 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko"> {/* 영어(en)에서 한국어(ko)로 변경 */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics /> {/* 방문자 통계 수집기 작동! */}
      </body>
    </html>
  );
}