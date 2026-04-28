import type { Metadata } from "next";

import { ThemeProvider } from "next-themes";
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
  description: "Track your League of Legends games, coaching sessions, and improve your gameplay.",
};

export default async function RootLayout({
  children,
  auth,
}: Readonly<{
  children: React.ReactNode;
  auth: React.ReactNode;
}>) {
  // Note: html lang is hardcoded "en" to keep the root layout static for PPR.
  // The actual lang attribute is updated client-side by HtmlLangSync (in the
  // app layout) once the locale is resolved from the cookie/Accept-Language.
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          {auth}
        </ThemeProvider>
      </body>
    </html>
  );
}
