import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: "variable",
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AuditorX — Code quality intelligence",
  description: "AI-powered source code quality auditing for engineering teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={notoSansThai.variable}>
      <body suppressHydrationWarning><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
