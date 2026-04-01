"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ChangelogImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setVisible(false);
    // Wait for fade-out transition before unmounting
    setTimeout(() => setOpen(false), 150);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Trigger fade-in on next frame so the transition plays
    requestAnimationFrame(() => setVisible(true));
    overlayRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  return (
    <>
      <figure className="changelog-figure">
        <button
          type="button"
          className="changelog-zoom-button"
          aria-label={props.alt ? `Zoom: ${props.alt}` : "Zoom image"}
          onClick={() => setOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...props} alt={props.alt ?? ""} />
          <span className="changelog-zoom-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="11" y1="8" x2="11" y2="14" />
            </svg>
          </span>
        </button>
        {props.alt && <figcaption className="changelog-caption">{props.alt}</figcaption>}
      </figure>
      {open &&
        createPortal(
          <div
            ref={overlayRef}
            role="dialog"
            aria-label={props.alt ?? "Image preview"}
            tabIndex={-1}
            className="changelog-lightbox"
            data-visible={visible}
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            <button
              type="button"
              className="changelog-lightbox-close"
              aria-label="Close preview"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {/* Stop clicks on the image from closing the overlay */}
            <div
              className="contents"
              role="presentation"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.src} alt={props.alt ?? ""} className="changelog-lightbox-image" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
