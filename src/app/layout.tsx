import type { Metadata } from "next";

import { ThemeProvider } from "next-themes";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LevelRise",
  description:
    "Clarity for your climb. Track your League of Legends games, coaching sessions, and improve your gameplay.",
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
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NODE_ENV === "production" && (
          <script
            defer
            data-domain="levelrise.app"
            src="https://stats.thegreenvintage.com/js/script.js"
          />
        )}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          {auth}
        </ThemeProvider>
      </body>
    </html>
  );
}
