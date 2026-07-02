import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const thicccboi = localFont({
  variable: "--font-thicccboi",
  display: "swap",
  src: [
    { path: "../fonts/THICCCBOI-Thin.woff2", weight: "100", style: "normal" },
    { path: "../fonts/THICCCBOI-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/THICCCBOI-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/THICCCBOI-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/THICCCBOI-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/THICCCBOI-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/THICCCBOI-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "../fonts/THICCCBOI-Black.woff2", weight: "900", style: "normal" },
  ],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kubric — AI-Powered Kubernetes Troubleshooting",
  description:
    "Kubric is an autonomous SRE agent that diagnoses cluster failures, pinpoints root causes, and ships fixes — in seconds, not stand‑ups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${thicccboi.variable} ${jetbrainsMono.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
