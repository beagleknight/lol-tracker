"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

// Extend Window to include the Canny SDK
declare global {
  interface Window {
    Canny?: (command: string, options?: Record<string, unknown>) => void;
  }
}

const BOARD_TOKEN = process.env.NEXT_PUBLIC_CANNY_BOARD_TOKEN;
const LOAD_TIMEOUT_MS = 10_000;

function loadCannySDK(): Promise<void> {
  return new Promise((resolve, reject) => {
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
    e.onerror = () => reject(new Error("Failed to load Canny SDK"));
    f?.parentNode?.insertBefore(e, f);
  });
}

export function FeedbackClient() {
  const t = useTranslations("Feedback");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const cannyContainerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderCannyWidget = useCallback(async () => {
    if (!BOARD_TOKEN) return;

    setIsLoading(true);
    setHasError(false);

    // Start a timeout — if the widget hasn't loaded after LOAD_TIMEOUT_MS, show error
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
    }, LOAD_TIMEOUT_MS);

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
          basePath: "/feedback",
          ssoToken,
          theme: "dark",
          onLoadCallback: () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsLoading(false);
            setHasError(false);
          },
        });
      } else {
        // Container not available or SDK not ready — clear loading
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLoading(false);
        setHasError(true);
      }
    } catch {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsLoading(false);
      setHasError(true);
    }
  }, [sdkLoaded]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
      {hasError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("loadError")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void renderCannyWidget();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("retry")}
            </Button>
          </div>
        </div>
      )}
      <div ref={cannyContainerRef} data-canny className="-mx-[20px]" />
    </div>
  );
}

/** Returns true if the Canny board token is configured */
export function isFeedbackEnabled(): boolean {
  return !!BOARD_TOKEN;
}
