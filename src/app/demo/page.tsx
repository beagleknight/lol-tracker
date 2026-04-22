"use client";

import { useEffect } from "react";

import { demoLogin } from "@/app/actions/demo-login";

/** Fixed demo user ID — must match seed-demo.ts and lib/demo-user.ts */
const DEMO_USER_ID = "demo-user-0001-0001-000000000001";

/**
 * Public demo entry point — auto-signs in as the demo user and redirects
 * to /dashboard. Uses the existing demoLogin server action.
 *
 * This replaces the old (demo) route group: the demo user now uses the
 * real (app) routes with isDemoUser=true in the session, making all links,
 * router.push calls, and server actions work without special-casing.
 */
export default function DemoPage() {
  useEffect(() => {
    void demoLogin(DEMO_USER_ID);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading demo...</p>
    </div>
  );
}
