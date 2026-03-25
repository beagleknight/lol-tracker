import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LoL Tracker",
  description:
    "Track your League of Legends games, coaching sessions, and improve your gameplay.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Note: html lang is set dynamically by next-intl's plugin at request time.
  // We hardcode "en" here to keep the root layout static for PPR compatibility.
  // The actual locale is determined by the cookie/Accept-Language in i18n/request.ts.
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
