import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditorX — Code quality intelligence",
  description: "AI-powered source code quality auditing for engineering teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
