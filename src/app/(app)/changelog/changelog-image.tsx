"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function ChangelogImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    // Focus the overlay so screen readers announce it
    overlayRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className="m-0 cursor-zoom-in border-0 bg-transparent p-0"
        aria-label={props.alt ? `Zoom: ${props.alt}` : "Zoom image"}
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...props} alt={props.alt ?? ""} />
      </button>
      {open && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-label={props.alt ?? "Image preview"}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          {/* Stop clicks on the image from closing the overlay */}
          <div
            className="contents"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.src}
              alt={props.alt ?? ""}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
