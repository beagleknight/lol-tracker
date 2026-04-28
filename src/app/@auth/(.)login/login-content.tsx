"use client";

import { Suspense } from "react";

import { LoginContent } from "@/app/login/login-forms";
import { LoginModal } from "@/components/login-modal";

export function InterceptedLoginContent() {
  return (
    <LoginModal>
      <Suspense>
        <LoginContent />
      </Suspense>
    </LoginModal>
  );
}
