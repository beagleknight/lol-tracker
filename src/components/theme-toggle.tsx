"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled aria-label="Toggle theme">
        <Moon className="h-4 w-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  const icon =
    theme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : theme === "light" ? (
      <Sun className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  const label = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={cycleTheme}
      title={`Theme: ${label}. Click to switch.`}
      aria-label="Toggle theme"
    >
      {icon}
    </Button>
  );
}
