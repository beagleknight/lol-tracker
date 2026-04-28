"use client";

import { Suspense } from "react";

import { LoginContent, LegalLink } from "@/app/login/login-forms";
import { LoginModal } from "@/components/login-modal";

export function InterceptedLoginContent() {
  return (
    <LoginModal>
      <div className="flex flex-col items-center gap-4">
        <Suspense>
          <LoginContent />
        </Suspense>
        <LegalLink />
      </div>
    </LoginModal>
  );
}
