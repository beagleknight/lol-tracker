"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

// Extend Window to include the Canny SDK
declare global {
  interface Window {
    Canny?: (command: string, options?: Record<string, unknown>) => void;
  }
}

const BOARD_TOKEN = process.env.NEXT_PUBLIC_CANNY_BOARD_TOKEN;

function loadCannySDK(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.Canny === "function") {
      resolve();
      return;
    }

    // Canny SDK loader snippet (from their docs)
    const w = window as Window;
    const d = document;
    const i = "canny-jssdk";
    const s = "script";

    if (d.getElementById(i)) {
      resolve();
      return;
    }

    const c = function (...args: unknown[]) {
      (c as unknown as { q: unknown[] }).q.push(args);
    };
    (c as unknown as { q: unknown[] }).q = [];
    w.Canny = c as unknown as Window["Canny"];

    const f = d.getElementsByTagName(s)[0];
    const e = d.createElement(s);
    e.type = "text/javascript";
    e.async = true;
    e.id = i;
    e.src = "https://sdk.canny.io/sdk.js";
    e.onload = () => resolve();
    f?.parentNode?.insertBefore(e, f);
  });
}

export function FeedbackClient() {
  const t = useTranslations("Feedback");
  const [isLoading, setIsLoading] = useState(true);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const cannyContainerRef = useRef<HTMLDivElement>(null);

  const renderCannyWidget = useCallback(async () => {
    if (!BOARD_TOKEN) return;

    try {
      // Load SDK if not already loaded
      if (!sdkLoaded) {
        await loadCannySDK();
        setSdkLoaded(true);
      }

      // Fetch SSO token from our API
      let ssoToken: string | null = null;
      try {
        const res = await fetch("/api/canny/sso");
        if (res.ok) {
          const data = await res.json();
          ssoToken = data.token;
        }
      } catch {
        // SSO is optional — widget still works without it, just won't identify the user
      }

      // Render the widget into the container
      if (window.Canny && cannyContainerRef.current) {
        window.Canny("render", {
          boardToken: BOARD_TOKEN,
          basePath: null,
          ssoToken,
          theme: "dark",
          onLoadCallback: () => {
            setIsLoading(false);
          },
        });
      }
    } catch {
      setIsLoading(false);
    }
  }, [sdkLoaded]);

  // Render Canny widget on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      void renderCannyWidget();
    });
  }, [renderCannyWidget]);

  if (!BOARD_TOKEN) return null;

  return (
    <div className="relative min-h-[600px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="sr-only">{t("loading")}</span>
        </div>
      )}
      <div ref={cannyContainerRef} data-canny />
    </div>
  );
}

/** Returns true if the Canny board token is configured */
export function isFeedbackEnabled(): boolean {
  return !!BOARD_TOKEN;
}
