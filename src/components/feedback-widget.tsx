"use client";

import { MessageSquarePlus, X, Loader2 } from "lucide-react";
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

export function FeedbackWidget() {
  const t = useTranslations("Feedback");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cannyContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const renderCannyWidget = useCallback(async () => {
    if (!BOARD_TOKEN) return;

    setIsLoading(true);

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

  const handleToggle = useCallback(() => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);

    if (willOpen) {
      // Render widget after panel opens (need the DOM element to exist)
      requestAnimationFrame(() => {
        void renderCannyWidget();
      });
    }
  }, [isOpen, renderCannyWidget]);

  if (!BOARD_TOKEN) return null;

  return (
    <>
      {/* Floating button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={t("buttonLabel")}
        aria-expanded={isOpen}
        aria-controls="feedback-panel"
        className="text-gold-foreground fixed right-6 bottom-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-gold shadow-lg transition-all duration-200 hover:scale-105 hover:bg-gold/90 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:h-14 md:w-14"
      >
        {isOpen ? (
          <X className="h-5 w-5 md:h-6 md:w-6" />
        ) : (
          <MessageSquarePlus className="h-5 w-5 md:h-6 md:w-6" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        id="feedback-panel"
        role="dialog"
        aria-label={t("panelTitle")}
        aria-modal="true"
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col bg-card shadow-2xl transition-transform duration-300 ease-in-out sm:w-[480px] md:w-[560px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground">{t("panelTitle")}</h2>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label={t("close")}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Canny widget container */}
        <div className="relative flex-1 overflow-y-auto">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="sr-only">{t("loading")}</span>
            </div>
          )}
          <div ref={cannyContainerRef} data-canny className="h-full p-4" />
        </div>
      </div>
    </>
  );
}
