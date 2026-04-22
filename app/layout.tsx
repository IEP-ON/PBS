import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "./pwa-register";
import VisualEditorWrapper from "./components/VisualEditorWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "말로 모으는 하루",
  description: "말 일기와 통합학급 연계를 중심으로 운영하는 특수학급 지원 플랫폼",
  applicationName: "말로 모으는 하루",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "말모하",
  },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4FA3E8" },
    { media: "(prefers-color-scheme: dark)", color: "#1E2A44" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
        <VisualEditorWrapper />
      </body>
    </html>
  );
}
