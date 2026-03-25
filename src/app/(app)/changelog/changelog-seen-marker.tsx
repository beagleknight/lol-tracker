"use client";

import { useEffect } from "react";

const LAST_SEEN_KEY = "changelog-last-seen";

/**
 * Invisible client component that marks the latest changelog version
 * as seen in localStorage when the changelog page is visited.
 */
export function ChangelogSeenMarker({ version }: { version: string }) {
  useEffect(() => {
    localStorage.setItem(LAST_SEEN_KEY, version);
  }, [version]);

  return null;
}
