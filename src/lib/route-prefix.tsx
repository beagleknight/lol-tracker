"use client";

import { createContext, useContext } from "react";

const RoutePrefixContext = createContext("");

export function RoutePrefixProvider({
  prefix,
  children,
}: {
  prefix: string;
  children: React.ReactNode;
}) {
  return <RoutePrefixContext value={prefix}>{children}</RoutePrefixContext>;
}

/**
 * Returns a function that prepends the current route prefix to a path.
 * In demo mode the prefix is "/demo", otherwise "".
 *
 * Usage:
 *   const appHref = useAppHref();
 *   <Link href={appHref("/matches/123")} />
 */
export function useAppHref() {
  const prefix = useContext(RoutePrefixContext);
  return (path: string) => {
    if (path === "/dashboard" && prefix === "/demo") return "/demo";
    return `${prefix}${path}`;
  };
}
