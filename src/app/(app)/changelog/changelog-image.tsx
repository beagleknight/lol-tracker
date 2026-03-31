"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChangelogImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] p-2 sm:max-w-[85vw]" showCloseButton>
          <DialogHeader className="sr-only">
            <DialogTitle>{props.alt ?? "Image"}</DialogTitle>
            <DialogDescription>Full-size image preview</DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.src} alt={props.alt ?? ""} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}
